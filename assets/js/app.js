/* ══════════════════════════════════════════════════════════
   치앙마이 트립 — UI
   ══════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var T = w.TRIP, S = w.Store, MV = w.MapView, TR = w.Transit;
  var PIN_HASH = 'ddb1369d147b442dd34d5a1b000084cdd96f70ca6535b8d6636fe676b6248955';

  var CATS = {
    flight:   { i:'✈️', n:'항공' },
    move:     { i:'🚕', n:'이동' },
    stay:     { i:'🏨', n:'숙소' },
    temple:   { i:'🛕', n:'사원' },
    food:     { i:'🍜', n:'식사' },
    cafe:     { i:'☕', n:'카페' },
    bar:      { i:'🍸', n:'술집' },
    nature:   { i:'🌿', n:'자연' },
    activity: { i:'🐘', n:'액티비티' },
    spa:      { i:'💆', n:'스파' },
    shop:     { i:'🛍️', n:'쇼핑' }
  };
  function catKey(k) { return CATS[k] ? k : 'move'; }
  function cat(k) { return CATS[k] || CATS.move; }

  var $  = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  /* ── SHA-256 (동기, 순수 JS) ─────────────────────────── */
  function sha256(ascii) {
    function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var K = [], H = [], p = 2, i = 0, j, m, s;
    function isP(n) { for (var k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; }
    for (p = 2, i = 0; i < 64; p++) {
      if (!isP(p)) continue;
      if (i < 8) H[i] = (Math.pow(p, .5) % 1 * 4294967296) | 0;
      K[i] = (Math.pow(p, 1 / 3) % 1 * 4294967296) | 0;
      i++;
    }
    var bytes = [], cp;
    for (i = 0; i < ascii.length; i++) {
      cp = ascii.charCodeAt(i);
      if (cp < 128) bytes.push(cp);
      else if (cp < 2048) bytes.push(192 | cp >> 6, 128 | cp & 63);
      else bytes.push(224 | cp >> 12, 128 | (cp >> 6) & 63, 128 | cp & 63);
    }
    var L = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push((i === 4 ? (L / 4294967296) | 0 : i < 4 ? (L >>> (i * 8)) : 0) & 255);
    var W = new Array(64);
    for (m = 0; m < bytes.length; m += 64) {
      for (i = 0; i < 16; i++)
        W[i] = (bytes[m+i*4] << 24) | (bytes[m+i*4+1] << 16) | (bytes[m+i*4+2] << 8) | bytes[m+i*4+3];
      for (i = 16; i < 64; i++) {
        var s0 = rr(7, W[i-15]) ^ rr(18, W[i-15]) ^ (W[i-15] >>> 3);
        var s1 = rr(17, W[i-2]) ^ rr(19, W[i-2]) ^ (W[i-2] >>> 10);
        W[i] = (W[i-16] + s0 + W[i-7] + s1) | 0;
      }
      var a=H[0],b=H[1],c=H[2],dd=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rr(6,e) ^ rr(11,e) ^ rr(25,e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        var S0 = rr(2,a) ^ rr(13,a) ^ rr(22,a);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h=g; g=f; f=e; e=(dd+t1)|0; dd=c; c=b; b=a; a=(t1+t2)|0;
      }
      H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+dd)|0;
      H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
    }
    for (s = '', i = 0; i < 8; i++) s += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return s;
  }

  /* ── 날짜 유틸 ────────────────────────────────────────── */
  var WD = ['일','월','화','수','목','금','토'];
  function dObj(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function wd(s) { return WD[dObj(s).getDay()]; }
  function md(s) { var p = s.split('-'); return +p[1] + '/' + +p[2]; }
  function dnum(s) { return +s.split('-')[2]; }
  function toMin(t) { var p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }

  /* ── 상태 ─────────────────────────────────────────────── */
  var state = { day: 0, tab: 'schedule', activeId: null, gmapMode: false };
  var mapv = null, globe = null;
  var MQ_DESK = w.matchMedia('(min-width:1024px)');
  function isDesk() { return MQ_DESK.matches; }

  /* ══════════════════════════════════════════════════════
     잠금
     ══════════════════════════════════════════════════════ */
  function initLock() {
    var lock = $('#lock');
    if (sessionStorage.getItem('cnx-ok') === '1' || localStorage.getItem('cnx-ok') === '1') {
      boot(); return;
    }
    lock.hidden = false;
    var buf = '';

    function paint() {
      $$('.pin__dot').forEach(function (el, i) { el.classList.toggle('is-on', i < buf.length); });
    }
    function fail() {
      $('#lockErr').textContent = '비밀번호가 맞지 않아요';
      lock.classList.add('is-shake');
      setTimeout(function () { lock.classList.remove('is-shake'); buf = ''; paint(); }, 420);
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    }
    function push(k) {
      $('#lockErr').innerHTML = '&nbsp;';
      if (k === 'del') buf = buf.slice(0, -1);
      else if (k === 'clear') buf = '';
      else if (buf.length < 4) buf += k;
      paint();
      if (buf.length === 4) {
        setTimeout(function () {
          if (sha256(buf) === PIN_HASH) {
            sessionStorage.setItem('cnx-ok', '1');
            if ($('#lockRemember').checked) localStorage.setItem('cnx-ok', '1');
            lock.style.transition = 'opacity .35s'; lock.style.opacity = '0';
            setTimeout(function () { lock.hidden = true; boot(); }, 340);
          } else fail();
        }, 110);
      }
    }
    $('#keypad').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]'); if (b) push(b.dataset.k);
    });
    d.addEventListener('keydown', function (e) {
      if (lock.hidden) return;
      if (/^[0-9]$/.test(e.key)) push(e.key);
      else if (e.key === 'Backspace') push('del');
      else if (e.key === 'Escape') push('clear');
    });
    paint();
  }

  /* ══════════════════════════════════════════════════════
     부팅
     ══════════════════════════════════════════════════════ */
  function boot() {
    var shared = S.load();
    $('#app').hidden = false;

    // 오늘이 여행 기간 안이면 해당 날짜로, 아니면 D0
    var today = new Date(); today.setHours(0,0,0,0);
    var idx = T.days.findIndex(function (x) { return dObj(x.date).getTime() === today.getTime(); });
    state.day = idx >= 0 ? idx : 0;

    mountGlobe();
    renderDaybar();
    placeMap();
    renderAll();
    bind();
    switchTab('schedule');
    tickCountdown();
    setInterval(tickCountdown, 60000);

    if (shared) toast('공유받은 일정을 불러왔어요 ✨');
    else if (S.stay().needsFix && !S.setting('stayNagged')) {
      setTimeout(function () {
        toast('⚙️ 설정에서 숙소 위치를 지정해 주세요');
        S.setting('stayNagged', 1);
      }, 1400);
    }
  }

  /** 지도 섹션을 모바일=일정 안쪽 / 데스크톱=오른쪽 패널로 옮긴다 */
  function placeMap() {
    var sec = $('#view-map');
    var host = isDesk() ? $('.pane--map') : $('#mapSlot');
    if (sec.parentNode !== host) {
      host.appendChild(sec);
      if (mapv) requestAnimationFrame(function () { mapv.invalidate(); renderMap(); });
    }
  }

  function mountGlobe() {
    var cv = $('#globe');
    if (cv && w.Globe) { try { globe = w.Globe.mount(cv); } catch (e) {} }
  }

  function tickCountdown() {
    var now = new Date(); now.setHours(0,0,0,0);
    var st = dObj(T.meta.start), en = dObj(T.meta.end);
    var diff = Math.round((st - now) / 86400000);
    var txt, big;
    if (diff > 0)      { big = 'D-' + diff;  txt = '출발까지 ' + diff + '일'; }
    else if (now <= en){ var n = Math.round((now - st) / 86400000) + 1; big = 'DAY ' + n; txt = '여행 ' + n + '일차'; }
    else               { big = '추억'; txt = '다녀왔습니다'; }
    var c = $('#countdown'); if (c) c.textContent = txt;
    var hb = $('#heroDday'); if (hb) hb.textContent = big;
  }

  /* ══════════════════════════════════════════════════════
     날짜 탭
     ══════════════════════════════════════════════════════ */
  function renderDaybar() {
    $('#daybar').innerHTML = T.days.map(function (x, i) {
      var isSun = dObj(x.date).getDay() === 0;
      return '<button type="button" class="daytab' + (i === state.day ? ' is-active' : '') +
        (isSun ? ' is-sun' : '') + '" data-day="' + i + '">' +
        '<div class="daytab__d">' + x.tag + '</div>' +
        '<div class="daytab__n">' + dnum(x.date) + '</div>' +
        '<div class="daytab__w">' + wd(x.date) + '</div></button>';
    }).join('');
  }

  function selectDay(i) {
    state.day = i; state.activeId = null;
    renderDaybar(); renderAll();
    var el = $('.daytab.is-active');
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function renderAll() { renderSchedule(); renderMap(); renderCal(); renderPick(); renderInfo(); }

  /* ══════════════════════════════════════════════════════
     일정 (타임라인 + 이동 구간)
     ══════════════════════════════════════════════════════ */
  function renderSchedule() {
    var day = T.days[state.day];
    var list = S.resolvedOn(day.date);

    // 헤더
    var moveMin = 0, fare = 0, spend = 0;
    for (var i = 0; i < list.length; i++) {
      spend += (+list[i].cost || 0);
      if (i > 0) {
        var lg = TR.plan(list[i-1], list[i]);
        if (lg && !lg.sameSpot) { moveMin += lg.primary.min; fare += lg.primary.fare; }
      }
    }
    $('#dayHead').innerHTML =
      '<div class="dayhead__kicker">' + day.tag + ' · ' + md(day.date) + '(' + wd(day.date) + ')</div>' +
      '<h2 class="dayhead__title">' + esc(day.title) + '</h2>' +
      '<p class="dayhead__sub">' + esc(day.sub) + '</p>' +
      '<div class="dayhead__stats">' +
        '<span class="stat">📍 일정 ' + list.length + '개</span>' +
        (moveMin ? '<span class="stat">🚕 이동 ' + TR.fmtMin(moveMin) + '</span>' : '') +
        (fare ? '<span class="stat">🚗 교통 ' + fare.toLocaleString() + '฿</span>' : '') +
        (spend ? '<span class="stat">💰 예상 ' + spend.toLocaleString() + '฿</span>' : '') +
      '</div>';

    if (!list.length) {
      $('#timeline').innerHTML =
        '<div class="empty"><div class="empty__ico">🗓️</div>' +
        '<div class="empty__t">아직 일정이 없어요</div>' +
        '<div class="empty__s">오른쪽 아래 <b>+</b> 버튼으로<br>이 날의 일정을 추가해 보세요</div></div>';
      return;
    }

    var html = '';
    list.forEach(function (it, i) {
      if (i > 0) html += legHTML(list[i-1], it);
      html += itemHTML(it);
    });
    $('#timeline').innerHTML = html;
  }

  function itemHTML(it) {
    var k = catKey(it.cat), c = CATS[k];
    return '<div class="tl-item">' +
      '<div class="tl-time"><div class="tl-time__s">' + esc(it.s || '') + '</div>' +
        (it.e ? '<div class="tl-time__e">' + esc(it.e) + '</div>' : '') + '</div>' +
      '<button type="button" class="card' + (state.activeId === it.id ? ' is-active' : '') +
        '" data-item="' + it.id + '" style="--cat:var(--c-' + k + ')">' +
        '<div class="card__top">' +
          '<div class="card__ico">' + c.i + '</div>' +
          '<div class="card__main">' +
            '<div class="card__title">' + esc(it.title) + '</div>' +
            '<div class="card__meta">' +
              '<span class="tag tag--cat">' + c.n + '</span>' +
              (it.must ? '<span class="tag tag--must">⭐ 필수</span>' : '') +
              (it.book ? '<span class="tag tag--book">📌 예약</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        (it.addr ? '<div class="card__addr">' +
          '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
          esc(it.addr) + '</div>' : '') +
        (it.note ? '<div class="card__note">' + esc(it.note) + '</div>' : '') +
        (+it.cost ? '<div class="card__cost">💰 약 ' + (+it.cost).toLocaleString() + '฿</div>' : '') +
      '</button></div>';
  }

  function legHTML(from, to) {
    var lg = TR.plan(from, to);
    if (!lg) return '';
    if (lg.sameSpot) {
      return '<div class="leg"><div class="leg__rail"></div><div class="leg__body">' +
        '<div class="leg__pill"><span class="leg__mode">📍</span>' +
        '<span>같은 장소에서 이어서</span></div></div></div>';
    }
    var p = lg.primary;
    var alts = lg.alts.filter(function (a) { return a.key !== p.key; }).slice(0, 2).map(function (a) {
      return a.emoji + ' ' + a.label + (a.fare ? ' ' + a.fare.toLocaleString() + '฿' : '') +
             (a.hint ? ' (' + a.hint + ')' : '');
    }).join('  ·  ');

    return '<div class="leg"><div class="leg__rail"></div><div class="leg__body">' +
      '<a class="leg__pill" href="' + lg.gmaps + '" target="_blank" rel="noopener">' +
        '<span class="leg__mode">' + p.emoji + '</span>' +
        '<span class="leg__label">' + p.label + '</span>' +
        '<span class="leg__dot"></span><span>' + TR.fmtMin(p.min) + '</span>' +
        '<span class="leg__dot"></span><span>' + TR.fmtKm(lg.km) + '</span>' +
        (p.fare ? '<span class="leg__dot"></span><span class="leg__fare">' + p.fare.toLocaleString() + '฿</span>' : '') +
        '<span class="leg__go">길찾기' +
          '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></span>' +
      '</a>' +
      (p.hint || alts ? '<div class="leg__alt">' +
        (p.hint ? p.hint + (alts ? ' · ' : '') : '') +
        (alts ? '또는 ' + alts : '') + '</div>' : '') +
    '</div></div>';
  }

  /* ══════════════════════════════════════════════════════
     지도
     ══════════════════════════════════════════════════════ */
  function renderMap(keepView) {
    var day = T.days[state.day];
    var list = S.resolvedOn(day.date).filter(function (i) {
      return isFinite(i.lat) && isFinite(i.lng);
    });
    var color = MV.dayColor(state.day);

    var gEl = $('#mapGoogle'), lEl = $('#mapLeaflet');

    if (state.gmapMode) {
      lEl.hidden = true; gEl.hidden = false;
      var url = MV.embedDay(list, state.activeId);
      gEl.innerHTML = url
        ? '<iframe src="' + url + '" style="width:100%;height:100%;border:0" ' +
          'loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="구글맵"></iframe>' +
          '<div class="maphint">한글 지도 · 아래 목록을 누르면 그 장소로 이동</div>'
        : '<div class="empty" style="padding-top:90px"><div class="empty__ico">🗺️</div>' +
          '<div class="empty__t">표시할 장소가 없어요</div></div>';
    } else {
      gEl.hidden = true; gEl.innerHTML = ''; lEl.hidden = false;
      if (!mapv) {
        mapv = MV.create(lEl, { onPick: function (id) {
          state.activeId = id;
          renderMap(true);                       // 보던 화면 유지한 채 선택 표시만 갱신
          renderMapList(); renderSchedule();
          var target = $('.card[data-item="' + id + '"]') || $('.mrow[data-item="' + id + '"]');
          if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }});
      }
      // 작은 인라인 지도에서는 이름표가 겹치므로 선택된 핀만 표시
      var compact = lEl.offsetHeight > 0 && lEl.offsetHeight < 300;
      var pts = mapv.render(list, color, state.activeId, { labels: !compact });
      if (!keepView && lEl.offsetWidth > 0) mapv.refresh(pts);
    }
    renderMapList();
  }

  function renderMapList() {
    var day = T.days[state.day];
    var list = S.resolvedOn(day.date).filter(function (i) {
      return isFinite(i.lat) && isFinite(i.lng);
    });
    var color = MV.dayColor(state.day);
    $('#mapList').innerHTML = list.length ? list.map(function (it, i) {
      return '<button type="button" class="mrow' + (state.activeId === it.id ? ' is-active' : '') +
        '" data-item="' + it.id + '" data-mrow="1">' +
        '<span class="mrow__pin" style="background:' + color + '">' + (i + 1) + '</span>' +
        '<span class="mrow__t">' + CATS[catKey(it.cat)].i + ' ' + esc(it.title) + '</span>' +
        '<span class="mrow__time">' + esc(it.s || '') + '</span></button>';
    }).join('') : '';
  }


  /* ══════════════════════════════════════════════════════
     달력 — 8일 × 시간 그리드
     ══════════════════════════════════════════════════════ */
  var CAL_HOUR = 46;        // 1시간당 높이(px)

  function renderCal() {
    var wrap = $('#calWrap');
    if (!wrap) return;
    var items = S.resolved();

    /* 표시할 시간 범위 */
    var lo = 24 * 60, hi = 0;
    items.forEach(function (it) {
      var a = toMin(it.s), b = it.e ? toMin(it.e) : a + 60;
      if (b <= a) b = 24 * 60;
      lo = Math.min(lo, a); hi = Math.max(hi, b);
    });
    if (!items.length) { lo = 8 * 60; hi = 22 * 60; }
    var h0 = Math.max(0, Math.floor(lo / 60) - 1);
    var h1 = Math.min(24, Math.ceil(hi / 60) + 1);
    if (h1 - h0 < 10) h1 = Math.min(24, h0 + 10);
    var rows = h1 - h0;

    /* 헤더 */
    var head = '<div class="cal__head"><div class="cal__cnr"></div>';
    T.days.forEach(function (d, i) {
      var sun = dObj(d.date).getDay() === 0;
      head += '<button type="button" class="cal__day' + (sun ? ' is-sun' : '') +
        (i === state.day ? ' is-active' : '') + '" data-calday="' + i + '">' +
        '<span class="cal__day-t">' + d.tag + '</span>' +
        '<span class="cal__day-n">' + dnum(d.date) + '</span>' +
        '<span class="cal__day-w">' + wd(d.date) + '</span></button>';
    });
    head += '</div>';

    /* 시간 눈금 */
    var gut = '<div class="cal__gutter">';
    for (var h = h0; h < h1; h++) {
      gut += '<div class="cal__hr"><span>' + (h < 10 ? '0' + h : h) + '</span></div>';
    }
    gut += '</div>';

    /* 날짜별 칼럼 */
    var cols = '';
    T.days.forEach(function (d) {
      var evs = items.filter(function (i) { return i.date === d.date; });
      cols += '<div class="cal__col" data-caldate="' + d.date + '">' +
              laneHTML(evs, h0) + '</div>';
    });

    wrap.innerHTML = head +
      '<div class="cal__body" style="--calH:' + CAL_HOUR + 'px;--calRows:' + rows + '">' +
      gut + cols + nowLineHTML(h0, h1) + '</div>';
  }

  /* 겹치는 일정은 가로로 나눠 배치 */
  function laneHTML(evs, h0) {
    var list = evs.map(function (it) {
      var a = toMin(it.s), b = it.e ? toMin(it.e) : a + 60;
      if (b <= a) b = 24 * 60;
      return { it: it, a: a, b: Math.max(b, a + 30) };
    }).sort(function (x, y) { return x.a - y.a; });

    var lanes = [];
    list.forEach(function (e) {
      var k = 0;
      while (lanes[k] != null && lanes[k] > e.a) k++;
      lanes[k] = e.b; e.lane = k;
    });
    var n = Math.max(1, lanes.length);

    return list.map(function (e) {
      var k = catKey(e.it.cat), c = CATS[k];
      var top = (e.a - h0 * 60) / 60;
      var hgt = (e.b - e.a) / 60;
      var w = 100 / n;
      return '<button type="button" class="cal__ev" data-item="' + e.it.id + '"' +
        ' style="--cat:var(--c-' + k + ');top:calc(' + top + ' * var(--calH));' +
        'height:calc(' + hgt + ' * var(--calH) - 3px);' +
        'left:' + (e.lane * w) + '%;width:calc(' + w + '% - 3px)">' +
        '<span class="cal__ev-t">' + esc(e.it.s) + '</span>' +
        '<span class="cal__ev-n">' + c.i + ' ' + esc(e.it.title) + '</span>' +
        '</button>';
    }).join('');
  }

  /* 여행 기간 중이면 현재 시각 선 */
  function nowLineHTML(h0, h1) {
    var now = new Date();
    var today = now.getFullYear() + '-' +
      ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    var idx = T.days.findIndex(function (d) { return d.date === today; });
    if (idx < 0) return '';
    var m = now.getHours() * 60 + now.getMinutes();
    if (m < h0 * 60 || m > h1 * 60) return '';
    var top = (m - h0 * 60) / 60;
    return '<div class="cal__now" style="top:calc(' + top + ' * var(--calH));' +
           'grid-column:' + (idx + 2) + '"></div>';
  }


  /* ══════════════════════════════════════════════════════
     추천 장소 — 골라서 일정에 넣기
     ══════════════════════════════════════════════════════ */
  var PCAT_HUE = { market:20, cafe:32, bar:276, food:352, activity:166, temple:44, spa:322 };
  var pickCat = 'all';

  function placeHue(p) {
    var base = PCAT_HUE[p.c] != null ? PCAT_HUE[p.c] : 200;
    var same = w.PLACES.filter(function (x) { return x.c === p.c; });
    var i = same.indexOf(p);
    return base + (i * 5) - Math.floor(same.length * 2.5);
  }

  /** 이미 일정에 넣은 추천 장소인지 */
  function pickedIds() {
    var set = {};
    S.items().forEach(function (it) { if (it.pid) set[it.pid] = 1; });
    return set;
  }

  function renderPick() {
    var catsEl = $('#pickCats'), gridEl = $('#pickGrid');
    if (!catsEl) return;

    catsEl.innerHTML = '<button type="button" class="pcat' +
      (pickCat === 'all' ? ' is-on' : '') + '" data-pcat="all">전체 ' +
      w.PLACES.length + '</button>' +
      w.PLACE_CATS.map(function (c) {
        var n = w.PLACES.filter(function (p) { return p.c === c.k; }).length;
        return '<button type="button" class="pcat' + (pickCat === c.k ? ' is-on' : '') +
          '" data-pcat="' + c.k + '">' + c.i + ' ' + c.n + ' ' + n + '</button>';
      }).join('');

    var done = pickedIds();
    var list = w.PLACES.filter(function (p) { return pickCat === 'all' || p.c === pickCat; });

    gridEl.innerHTML = list.map(function (p) {
      var h = placeHue(p);
      return '<button type="button" class="pcard" data-pick="' + p.id + '" style="--h:' + h + '">' +
        '<span class="pcard__img">' +
          '<span class="pcard__bg">' + p.e + '</span>' +
          '<span class="pcard__badge">' + catOf(p.c).i + '</span>' +
          (done[p.id] ? '<span class="pcard__done">✓ 추가됨</span>' : '') +
        '</span>' +
        '<span class="pcard__b">' +
          '<span class="pcard__n">' + esc(p.n) + '</span>' +
          '<span class="pcard__a">' + esc(p.area) + '</span>' +
          '<span class="pcard__m">' + esc(p.price) + ' · ' + TR.fmtMin(p.dur) + '</span>' +
        '</span></button>';
    }).join('');
  }

  function catOf(k) {
    for (var i = 0; i < w.PLACE_CATS.length; i++) if (w.PLACE_CATS[i].k === k) return w.PLACE_CATS[i];
    return w.PLACE_CATS[0];
  }

  /** 추천 카테고리 → 일정 카테고리 */
  var PCAT_TO_ITEM = { market:'shop', cafe:'cafe', bar:'bar', food:'food',
                       activity:'activity', temple:'temple', spa:'spa' };

  function openPick(pid) {
    var p = null;
    for (var i = 0; i < w.PLACES.length; i++) if (w.PLACES[i].id === pid) p = w.PLACES[i];
    if (!p) return;
    var h = placeHue(p), done = pickedIds()[p.id];

    var body =
      '<div class="phero" style="--h:' + h + '">' +
        '<span class="phero__bg">' + p.e + '</span>' +
        '<span class="phero__n">' + esc(p.n) + '</span>' +
        '<span class="phero__e">' + esc(p.en) + '</span>' +
      '</div>' +
      '<div class="kv"><span class="kv__k">위치</span><span class="kv__v">' + esc(p.area) + '</span></div>' +
      '<div class="kv"><span class="kv__k">영업</span><span class="kv__v">' + esc(p.hours) + '</span></div>' +
      '<div class="kv"><span class="kv__k">가격대</span><span class="kv__v">' + esc(p.price) + '</span></div>' +
      '<div class="kv"><span class="kv__k">예상 소요</span><span class="kv__v">' + TR.fmtMin(p.dur) + '</span></div>' +
      '<p class="card__note" style="margin-top:14px">' + esc(p.why) + '</p>' +
      (p.tip ? '<div class="tip" style="margin-top:12px">' + esc(p.tip) + '</div>' : '') +
      '<div class="btnrow btnrow--2" style="margin-top:16px">' +
        '<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(p.q) + '">📍 구글맵</a>' +
        '<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=' +
          encodeURIComponent(p.q) + '">📷 사진 보기</a>' +
      '</div>' +
      (done ? '<div class="tip" style="margin-top:14px">✅ 이미 일정에 들어있어요. 아래에서 한 번 더 추가할 수도 있습니다.</div>' : '') +
      '<div class="rule"></div>' +
      '<form id="pickForm">' +
        '<div class="field__l">일정에 넣기</div>' +
        '<div class="row" style="margin-bottom:10px">' +
          '<select class="input" id="p_date">' + T.days.map(function (d) {
            return '<option value="' + d.date + '"' + (d.date === T.days[state.day].date ? ' selected' : '') +
              '>' + d.tag + ' · ' + md(d.date) + '(' + wd(d.date) + ')</option>';
          }).join('') + '</select>' +
          '<input class="input" id="p_time" type="time" value="' + esc(p.s || '10:00') + '">' +
        '</div>' +
        '<div class="btnrow"><button type="submit" class="btn btn--primary">＋ 이 날짜에 추가</button></div>' +
      '</form>';

    openSheet('추천 장소', body);

    $('#pickForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var date = $('#p_date').value, st = $('#p_time').value || p.s || '10:00';
      var end = addMin(st, p.dur);
      S.addItem({
        pid: p.id, date: date, s: st, e: end,
        cat: PCAT_TO_ITEM[p.c] || 'shop',
        title: p.n, lat: p.lat, lng: p.lng, addr: p.area,
        note: p.why + (p.tip ? '\n\n' + p.tip : ''),
        book: p.book || undefined
      });
      var di = T.days.findIndex(function (d) { return d.date === date; });
      if (di >= 0) state.day = di;
      closeSheet(); renderDaybar(); renderAll(); renderPick();
      toast(p.n + ' 추가 완료 · ' + md(date) + ' ' + st);
    });
  }

  function addMin(hhmm, mins) {
    var t = toMin(hhmm) + (mins || 60);
    t = Math.min(t, 23 * 60 + 59);
    return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
  }

  /* ══════════════════════════════════════════════════════
     정보
     ══════════════════════════════════════════════════════ */
  function fmtStay(v) {
    if (!v) return '-';
    var p = String(v).split(' ');
    return md(p[0]) + '(' + wd(p[0]) + ')' + (p[1] ? ' ' + p[1] : '');
  }

  function renderInfo() {
    var st = S.stay();
    var all = S.resolved();
    var totalCost = all.reduce(function (a, b) { return a + (+b.cost || 0); }, 0);

    var h = '';

    // 항공
    h += '<div class="panel flightcard"><div class="panel__h"><em>✈️</em> 항공편</div>' +
      T.flights.map(function (f) {
        return '<div class="fl">' +
          '<div class="fl__side"><div class="fl__t">' + f.depT + '</div><div class="fl__p">' + esc(f.dep) + '</div></div>' +
          '<div class="fl__mid"><div class="fl__dur">' + f.dur + '</div><div class="fl__line"></div>' +
            '<div class="fl__no">' + f.no + ' · ' + md(f.date) + '(' + wd(f.date) + ')</div></div>' +
          '<div class="fl__side"><div class="fl__t">' + f.arrT +
            (f.plus ? '<sup style="font-size:10px">+' + f.plus + '</sup>' : '') +
            '</div><div class="fl__p">' + esc(f.arr) + '</div></div>' +
        '</div>';
      }).join('<div style="height:1px;background:rgba(240,216,154,.28);margin:14px 0"></div>') +
      '<div style="margin-top:14px;font-size:11.5px;color:#A9D2C9">예약번호 <b style="color:#F7EAC9">' +
      T.flights[0].pnr + '</b> · 이스타항공</div></div>';

    // 숙소
    h += '<div class="panel"><div class="panel__h"><em>🏨</em> 숙소</div>' +
      '<div class="kv"><span class="kv__k">이름</span><span class="kv__v">' + esc(st.name) + '</span></div>' +
      '<div class="kv"><span class="kv__k">주소</span><span class="kv__v">' + esc(st.addr) + '</span></div>' +
      '<div class="kv"><span class="kv__k">체크인</span><span class="kv__v">' + fmtStay(st.checkIn) + '</span></div>' +
      '<div class="kv"><span class="kv__k">체크아웃</span><span class="kv__v">' + fmtStay(st.checkOut) + '</span></div>' +
      (st.host ? '<div class="kv"><span class="kv__k">호스트</span><span class="kv__v">' + esc(st.host) + '</span></div>' : '') +
      (st.plus ? '<div class="kv"><span class="kv__k">Plus Code</span><span class="kv__v">' + esc(st.plus) + '</span></div>' : '') +
      (st.note ? '<div class="tip" style="margin-top:12px">' + esc(st.note) + '</div>' : '') +
      '<div class="btnrow btnrow--2" style="margin-top:12px">' +
        '<a class="btn btn--ghost" href="' + TR.placeUrl(st) + '" target="_blank" rel="noopener">구글맵 열기</a>' +
        '<button type="button" class="btn btn--primary" data-act="editstay">숙소 변경</button>' +
      '</div></div>';

    // 예산
    h += '<div class="panel"><div class="panel__h"><em>💰</em> 예산 (2인 · 항공권 제외)</div>' +
      T.budget.map(function (b) {
        return '<div class="kv"><span class="kv__k">' + esc(b.k) + '</span><span class="kv__v">' + esc(b.v) + '</span></div>';
      }).join('') +
      '<div class="rule"></div>' +
      '<div class="kv"><span class="kv__k"><b>일정표 합계</b></span><span class="kv__v">' +
        totalCost.toLocaleString() + '฿ ≈ ' + Math.round(totalCost * T.meta.rate / 10000) + '만원</span></div>' +
      '<p class="hint">1฿ ≈ ' + T.meta.rate + '원 기준. 출발 전 환율을 확인하세요.</p></div>';

    // 준비물
    var groups = {};
    T.checklist.forEach(function (c, i) { (groups[c.g] = groups[c.g] || []).push([c, i]); });
    var doneN = T.checklist.filter(function (c) { return S.isChecked(c.t); }).length;
    h += '<div class="panel"><div class="panel__h"><em>🎒</em> 준비물 ' +
      '<span style="margin-left:auto;font-size:12px;color:var(--ink-3);font-family:var(--font-body)">' +
      doneN + '/' + T.checklist.length + '</span></div>';
    Object.keys(groups).forEach(function (g) {
      h += '<div style="margin-top:14px;font-size:11.5px;font-weight:700;color:var(--gold);letter-spacing:.08em">' + esc(g) + '</div>';
      groups[g].forEach(function (pair) {
        var c = pair[0];
        h += '<label class="chk"><input type="checkbox" data-chk="' + esc(c.t) + '"' +
          (S.isChecked(c.t) ? ' checked' : '') + '><span>' + esc(c.t) +
          (c.d ? '<small>' + esc(c.d) + '</small>' : '') + '</span></label>';
      });
    });
    h += '</div>';

    // 팁
    h += '<div class="panel"><div class="panel__h"><em>💡</em> 알아두면 좋은 것</div><div class="tipgrid">' +
      T.tips.map(function (t) {
        return '<div class="tip"><b>' + esc(t.t) + '</b>' + esc(t.d) + '</div>';
      }).join('') + '</div></div>';

    // 데이터
    h += '<div class="panel"><div class="panel__h"><em>⚙️</em> 데이터</div>' +
      '<div class="btnrow" style="margin-top:12px">' +
        '<button type="button" class="btn btn--gold" data-act="share">🔗 공유 링크 복사</button>' +
        '<button type="button" class="btn btn--ghost" data-act="export">일정 내보내기 (JSON)</button>' +
        '<button type="button" class="btn btn--ghost" data-act="import">일정 가져오기</button>' +
        '<button type="button" class="btn btn--danger" data-act="reset">내 변경사항 초기화</button>' +
      '</div>' +
      '<p class="hint">공유 링크에는 내가 추가·수정한 일정이 담겨 있어요. 링크를 열면 상대방 기기에도 똑같이 반영됩니다. ' +
      '비밀번호는 화면 잠금 수준이니 링크는 둘만 공유하세요.</p></div>';

    h += '<p class="hint" style="text-align:center;padding:8px 0 4px">🐘 즐거운 여행 되세요</p>';

    $('#infoBody').innerHTML = h;
  }

  /* ══════════════════════════════════════════════════════
     시트
     ══════════════════════════════════════════════════════ */
  function openSheet(title, body) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = body;
    $('#sheet').hidden = false;
    d.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    d.body.style.overflow = '';
  }

  /* ── 일정 상세 ────────────────────────────────────────── */
  function openDetail(id) {
    var it = S.resolved().filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var k = catKey(it.cat), c = CATS[k];
    var body =
      '<div class="detail__hero" style="--cat:var(--c-' + k + ')">' +
        '<div class="detail__ico">' + c.i + '</div><div>' +
        '<div class="detail__t">' + esc(it.title) + '</div>' +
        '<div class="detail__s">' + md(it.date) + '(' + wd(it.date) + ') · ' +
          esc(it.s || '') + (it.e ? ' – ' + esc(it.e) : '') + '</div></div></div>' +
      (isFinite(it.lat) ? '<div class="detail__map"><iframe src="' + MV.embedPlace(it.lat, it.lng) +
        '" style="width:100%;height:100%;border:0" loading="lazy" title="위치"></iframe></div>' : '') +
      (it.addr ? '<div class="kv"><span class="kv__k">장소</span><span class="kv__v">' + esc(it.addr) + '</span></div>' : '') +
      (+it.cost ? '<div class="kv"><span class="kv__k">예상 비용</span><span class="kv__v">' +
        (+it.cost).toLocaleString() + '฿ ≈ ' + Math.round(it.cost * T.meta.rate).toLocaleString() + '원</span></div>' : '') +
      (it.note ? '<p class="card__note" style="margin-top:14px">' + esc(it.note) + '</p>' : '') +
      '<div class="btnrow btnrow--2" style="margin-top:18px">' +
        '<a class="btn btn--ghost" href="' + TR.placeUrl(it) + '" target="_blank" rel="noopener">📍 구글맵</a>' +
        '<a class="btn btn--ghost" href="' + TR.dirUrl(S.stay(), it, 'driving') + '" target="_blank" rel="noopener">🚗 숙소에서 길찾기</a>' +
      '</div>' +
      '<div class="btnrow btnrow--2" style="margin-top:9px">' +
        '<button type="button" class="btn btn--primary" data-act="edit" data-id="' + it.id + '">수정</button>' +
        '<button type="button" class="btn btn--danger" data-act="del" data-id="' + it.id + '">삭제</button>' +
      '</div>';
    openSheet('일정 상세', body);
  }

  /* ── 일정 추가/수정 폼 ────────────────────────────────── */
  function openForm(id, pre) {
    var it = id ? S.byId(id) : null;
    var day = T.days[state.day];
    var v = it || Object.assign(
      { date: day.date, s: '', e: '', cat: 'temple', title: '', addr: '', note: '', cost: '' },
      pre || {});

    var body =
      '<form id="itemForm" novalidate>' +
      '<div class="field"><label class="field__l" for="f_title">일정 이름</label>' +
        '<input class="input" id="f_title" required placeholder="예) 왓 치앙만" value="' + esc(v.title) + '"></div>' +

      '<div class="field"><label class="field__l">종류</label><div class="catgrid" id="f_cat">' +
        Object.keys(CATS).map(function (k) {
          return '<button type="button" class="catbtn' + (v.cat === k ? ' is-on' : '') +
            '" data-cat="' + k + '"><em>' + CATS[k].i + '</em>' + CATS[k].n + '</button>';
        }).join('') + '</div></div>' +

      '<div class="field"><label class="field__l" for="f_date">날짜</label>' +
        '<select class="input" id="f_date">' + T.days.map(function (x) {
          return '<option value="' + x.date + '"' + (v.date === x.date ? ' selected' : '') + '>' +
            x.tag + ' · ' + md(x.date) + '(' + wd(x.date) + ') ' + esc(x.title) + '</option>';
        }).join('') + '</select></div>' +

      '<div class="row">' +
        '<div class="field"><label class="field__l" for="f_s">시작</label>' +
          '<input class="input" id="f_s" type="time" value="' + esc(v.s) + '"></div>' +
        '<div class="field"><label class="field__l" for="f_e">종료</label>' +
          '<input class="input" id="f_e" type="time" value="' + esc(v.e) + '"></div>' +
      '</div>' +

      '<div class="field"><label class="field__l" for="f_q">장소 찾기</label>' +
        '<input class="input" id="f_q" placeholder="장소명 검색 또는 구글맵 링크 붙여넣기" autocomplete="off">' +
        '<div id="f_sugg"></div>' +
        '<p class="hint">📍 구글맵 앱 → 공유 → 링크 복사 후 붙여넣으면 좌표가 자동 입력돼요. ' +
        '짧은 링크(maps.app.goo.gl)는 브라우저에서 한 번 연 뒤 주소창 URL을 복사해 주세요.</p></div>' +

      '<div class="row">' +
        '<div class="field"><label class="field__l" for="f_lat">위도</label>' +
          '<input class="input" id="f_lat" inputmode="decimal" placeholder="18.7883" value="' + (v.lat != null ? v.lat : '') + '"></div>' +
        '<div class="field"><label class="field__l" for="f_lng">경도</label>' +
          '<input class="input" id="f_lng" inputmode="decimal" placeholder="98.9853" value="' + (v.lng != null ? v.lng : '') + '"></div>' +
      '</div>' +

      '<div class="field"><label class="field__l" for="f_addr">주소 / 메모용 위치</label>' +
        '<input class="input" id="f_addr" placeholder="예) 올드시티 북동쪽" value="' + esc(v.addr) + '"></div>' +

      '<div class="field"><label class="field__l" for="f_note">메모</label>' +
        '<textarea class="input" id="f_note" placeholder="영업시간, 예약 정보, 꿀팁…">' + esc(v.note) + '</textarea></div>' +

      '<div class="row">' +
        '<div class="field"><label class="field__l" for="f_cost">예상 비용 (฿)</label>' +
          '<input class="input" id="f_cost" inputmode="numeric" placeholder="0" value="' + (v.cost || '') + '"></div>' +
        '<div class="field"><label class="field__l" for="f_move">이동수단 (선택)</label>' +
          '<select class="input" id="f_move">' +
            [['','자동 추천'],['walk','🚶 도보'],['grab','🚗 Grab'],['songthaew','🛻 썽태우'],
             ['tuktuk','🛺 툭툭'],['bike','🛵 GrabBike'],['bus','🚌 버스'],['van','🚐 투어 차량'],
             ['charter','🚙 기사 대절']].map(function (o) {
              return '<option value="' + o[0] + '"' + (v.move === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') + '</select></div>' +
      '</div>' +

      '<div style="display:flex;gap:18px;margin:4px 0 18px">' +
        '<label class="chk" style="border:0;padding:0"><input type="checkbox" id="f_must"' +
          (v.must ? ' checked' : '') + '><span>⭐ 필수</span></label>' +
        '<label class="chk" style="border:0;padding:0"><input type="checkbox" id="f_book"' +
          (v.book ? ' checked' : '') + '><span>📌 예약 필요</span></label>' +
      '</div>' +

      '<div class="btnrow"><button type="submit" class="btn btn--primary">' +
        (it ? '수정 저장' : '일정 추가') + '</button></div>' +
      (it ? '<input type="hidden" id="f_id" value="' + it.id + '">' : '') +
      '</form>';

    openSheet(it ? '일정 수정' : '일정 추가', body);
    wireForm();
  }

  function wireForm() {
    var f = $('#itemForm');

    $('#f_cat').addEventListener('click', function (e) {
      var b = e.target.closest('.catbtn'); if (!b) return;
      $$('.catbtn', f).forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
    });

    // 구글맵 링크 / 좌표 붙여넣기 + 장소 검색
    var q = $('#f_q'), sug = $('#f_sugg'), timer = null;
    q.addEventListener('input', function () {
      var val = q.value.trim();
      var ll = parseLatLng(val);
      if (ll) {
        $('#f_lat').value = ll[0]; $('#f_lng').value = ll[1];
        sug.innerHTML = '';
        toast('좌표를 읽었어요 · ' + ll[0].toFixed(4) + ', ' + ll[1].toFixed(4));
        return;
      }
      if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(val)) {
        sug.innerHTML = '<div class="sugg"><div class="sugg__i">' +
          '짧은 링크는 좌표를 읽을 수 없어요.<br><span>브라우저에서 한 번 연 뒤 주소창의 긴 URL을 복사해 주세요.</span></div></div>';
        return;
      }
      clearTimeout(timer);
      if (val.length < 2) { sug.innerHTML = ''; return; }
      timer = setTimeout(function () { search(val, sug); }, 450);
    });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = $('#f_title').value.trim();
      if (!title) { $('#f_title').focus(); toast('일정 이름을 입력해 주세요'); return; }
      var lat = parseFloat($('#f_lat').value), lng = parseFloat($('#f_lng').value);
      var rec = {
        date: $('#f_date').value,
        s: $('#f_s').value, e: $('#f_e').value,
        cat: ($('.catbtn.is-on', f) || {}).dataset ? $('.catbtn.is-on', f).dataset.cat : 'temple',
        title: title,
        addr: $('#f_addr').value.trim(),
        note: $('#f_note').value.trim(),
        cost: +$('#f_cost').value || 0,
        move: $('#f_move').value || undefined,
        must: $('#f_must').checked || undefined,
        book: $('#f_book').checked || undefined
      };
      if (isFinite(lat) && isFinite(lng)) { rec.lat = lat; rec.lng = lng; }

      var idEl = $('#f_id');
      if (idEl) { S.updateItem(idEl.value, rec); toast('수정했어요 ✏️'); }
      else {
        if (!rec.s) rec.s = '12:00';
        var nid = S.addItem(rec);
        state.activeId = nid;
        toast('일정을 추가했어요 ✨');
      }
      // 추가한 날짜로 이동
      var di = T.days.findIndex(function (x) { return x.date === rec.date; });
      if (di >= 0) state.day = di;
      closeSheet(); renderDaybar(); renderAll();
    });
  }

  /** 구글맵 URL 또는 "lat, lng" 문자열에서 좌표 추출 */
  function parseLatLng(s) {
    var pats = [
      /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      /[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      /[?&]daddr=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
      /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/
    ];
    for (var i = 0; i < pats.length; i++) {
      var m = pats[i].exec(s);
      if (m) {
        var a = parseFloat(m[1]), b = parseFloat(m[2]);
        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
      }
    }
    return null;
  }

  function search(qv, box) {
    box.innerHTML = '<div class="sugg"><div class="sugg__i">검색 중…</div></div>';
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6' +
      '&accept-language=ko&countrycodes=th&q=' + encodeURIComponent(qv);
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list.length) {
          box.innerHTML = '<div class="sugg"><div class="sugg__i">결과가 없어요.' +
            '<br><span>구글맵에서 좌표를 복사해 붙여넣어 보세요.</span></div></div>';
          return;
        }
        box.innerHTML = '<div class="sugg">' + list.map(function (r) {
          var nm = r.display_name.split(',')[0];
          return '<button type="button" class="sugg__i" data-lat="' + r.lat + '" data-lng="' + r.lon +
            '" data-nm="' + esc(nm) + '" data-full="' + esc(r.display_name) + '">' +
            '<b>' + esc(nm) + '</b><span>' + esc(r.display_name) + '</span></button>';
        }).join('') + '</div>';
        box.addEventListener('click', function (e) {
          var b = e.target.closest('.sugg__i[data-lat]'); if (!b) return;
          $('#f_lat').value = b.dataset.lat;
          $('#f_lng').value = b.dataset.lng;
          if (!$('#f_addr').value) $('#f_addr').value = b.dataset.full.split(',').slice(0, 3).join(',').trim();
          if (!$('#f_title').value) $('#f_title').value = b.dataset.nm;
          box.innerHTML = '';
          toast('위치를 설정했어요 📍');
        }, { once: true });
      })
      .catch(function () {
        box.innerHTML = '<div class="sugg"><div class="sugg__i">검색에 실패했어요.' +
          '<br><span>구글맵 링크나 좌표를 직접 붙여넣어 주세요.</span></div></div>';
      });
  }

  /** 달력 빈 칸을 누르면 그 날짜·시간으로 추가 폼을 연다 */
  function addAtSlot(col, e) {
    var body = col.closest('.cal__body');
    var hourPx = parseFloat(getComputedStyle(body).getPropertyValue('--calH')) || CAL_HOUR;
    var first = $('.cal__hr', body);
    var h0 = first ? parseInt(first.textContent, 10) : 8;
    var y = e.clientY - col.getBoundingClientRect().top;
    var mins = h0 * 60 + Math.round(y / hourPx * 60 / 30) * 30;      // 30분 단위 스냅
    mins = Math.max(0, Math.min(23 * 60 + 30, mins));
    var hh = ('0' + Math.floor(mins / 60)).slice(-2);
    var mm = ('0' + (mins % 60)).slice(-2);

    var di = T.days.findIndex(function (d) { return d.date === col.dataset.caldate; });
    if (di >= 0) state.day = di;
    openForm(null, { date: col.dataset.caldate, s: hh + ':' + mm,
                     e: ('0' + Math.floor((mins + 60) / 60)).slice(-2) + ':' + mm });
  }

  /* ── 숙소 편집 ────────────────────────────────────────── */
  function openStayForm() {
    var st = S.stay();
    openSheet('숙소 설정',
      '<form id="stayForm">' +
      '<div class="field"><label class="field__l" for="s_name">숙소 이름</label>' +
        '<input class="input" id="s_name" value="' + esc(st.name) + '" placeholder="호텔/에어비앤비 이름"></div>' +
      '<div class="field"><label class="field__l" for="s_q">구글맵 링크 붙여넣기</label>' +
        '<input class="input" id="s_q" placeholder="https://www.google.com/maps/place/... 또는 18.79, 98.98" autocomplete="off">' +
        '<div id="s_sugg"></div>' +
        '<p class="hint">숙소를 바꾸면 매일 첫 이동·마지막 이동의 거리와 교통비가 자동으로 다시 계산돼요.</p></div>' +
      '<div class="row">' +
        '<div class="field"><label class="field__l" for="s_lat">위도</label>' +
          '<input class="input" id="s_lat" inputmode="decimal" value="' + st.lat + '"></div>' +
        '<div class="field"><label class="field__l" for="s_lng">경도</label>' +
          '<input class="input" id="s_lng" inputmode="decimal" value="' + st.lng + '"></div>' +
      '</div>' +
      '<div class="field"><label class="field__l" for="s_addr">주소</label>' +
        '<input class="input" id="s_addr" value="' + esc(st.addr) + '"></div>' +
      '<div class="btnrow"><button type="submit" class="btn btn--primary">저장</button></div>' +
      '</form>');

    var q = $('#s_q'), box = $('#s_sugg'), timer = null;
    q.addEventListener('input', function () {
      var val = q.value.trim(), ll = parseLatLng(val);
      if (ll) { $('#s_lat').value = ll[0]; $('#s_lng').value = ll[1]; box.innerHTML = ''; toast('좌표를 읽었어요'); return; }
      clearTimeout(timer);
      if (val.length < 2) { box.innerHTML = ''; return; }
      timer = setTimeout(function () { searchStay(val, box); }, 450);
    });

    $('#stayForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var lat = parseFloat($('#s_lat').value), lng = parseFloat($('#s_lng').value);
      if (!isFinite(lat) || !isFinite(lng)) { toast('좌표를 확인해 주세요'); return; }
      S.setStay({
        name: $('#s_name').value.trim() || '숙소',
        addr: $('#s_addr').value.trim(),
        lat: lat, lng: lng, note: '', needsFix: false
      });
      closeSheet(); renderAll(); toast('숙소를 저장했어요 🏨');
    });
  }

  function searchStay(qv, box) {
    box.innerHTML = '<div class="sugg"><div class="sugg__i">검색 중…</div></div>';
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=ko' +
      '&countrycodes=th&q=' + encodeURIComponent(qv))
      .then(function (r) { return r.json(); })
      .then(function (list) {
        box.innerHTML = list.length ? '<div class="sugg">' + list.map(function (r) {
          return '<button type="button" class="sugg__i" data-lat="' + r.lat + '" data-lng="' + r.lon +
            '" data-nm="' + esc(r.display_name.split(',')[0]) + '" data-full="' + esc(r.display_name) + '">' +
            '<b>' + esc(r.display_name.split(',')[0]) + '</b><span>' + esc(r.display_name) + '</span></button>';
        }).join('') + '</div>' : '<div class="sugg"><div class="sugg__i">결과가 없어요</div></div>';
        box.addEventListener('click', function (e) {
          var b = e.target.closest('.sugg__i[data-lat]'); if (!b) return;
          $('#s_lat').value = b.dataset.lat; $('#s_lng').value = b.dataset.lng;
          if (!$('#s_name').value || /확인 필요/.test($('#s_name').value)) $('#s_name').value = b.dataset.nm;
          $('#s_addr').value = b.dataset.full.split(',').slice(0, 3).join(',').trim();
          box.innerHTML = ''; toast('위치를 설정했어요 📍');
        }, { once: true });
      })
      .catch(function () { box.innerHTML = '<div class="sugg"><div class="sugg__i">검색 실패</div></div>'; });
  }

  /* ══════════════════════════════════════════════════════
     이벤트
     ══════════════════════════════════════════════════════ */
  function bind() {
    $('#daybar').addEventListener('click', function (e) {
      var b = e.target.closest('.daytab'); if (b) selectDay(+b.dataset.day);
    });

    $('#tabbar').addEventListener('click', function (e) {
      var b = e.target.closest('.tabbar__btn'); if (!b) return;
      switchTab(b.dataset.tab);
    });
    $('.topnav').addEventListener('click', function (e) {
      var b = e.target.closest('.topnav__btn'); if (!b) return;
      switchTab(b.dataset.tab);
    });
    var onBP = function () { placeMap(); switchTab(state.tab); };
    if (MQ_DESK.addEventListener) MQ_DESK.addEventListener('change', onBP);
    else MQ_DESK.addListener(onBP);

    d.addEventListener('click', function (e) {
      var t = e.target;

      var card = t.closest('.card[data-item]');
      if (card) { openDetail(card.dataset.item); return; }

      var mrow = t.closest('.mrow[data-item]');
      if (mrow) {
        state.activeId = mrow.dataset.item;
        if (state.gmapMode) renderMap();
        else { renderMap(true); renderMapList(); if (mapv) mapv.focus(state.activeId); }
        return;
      }

      var pcat = t.closest('[data-pcat]');
      if (pcat) { pickCat = pcat.dataset.pcat; renderPick(); return; }

      var pcard = t.closest('[data-pick]');
      if (pcard) { openPick(pcard.dataset.pick); return; }

      var calday = t.closest('[data-calday]');
      if (calday) { state.day = +calday.dataset.calday; renderDaybar(); renderAll(); switchTab('schedule'); return; }

      var ev = t.closest('.cal__ev[data-item]');
      if (ev) { openDetail(ev.dataset.item); return; }

      var col = t.closest('.cal__col[data-caldate]');
      if (col) { addAtSlot(col, e); return; }

      var act = t.closest('[data-act]');
      if (act) { doAct(act.dataset.act, act.dataset.id); return; }

      if (t.closest('[data-close]')) { closeSheet(); return; }
    });

    $('#btnAdd').addEventListener('click', function () { openForm(null); });
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnShare').addEventListener('click', function () { doAct('share'); });
    $('#btnFitAll').addEventListener('click', function () {
      if (state.gmapMode) { state.gmapMode = false; syncMapBtn(); renderMap(); return; }
      var list = S.resolvedOn(T.days[state.day].date).filter(function (i) {
        return isFinite(i.lat) && isFinite(i.lng);
      });
      if (mapv) mapv.refresh(list.map(function (i) { return [i.lat, i.lng]; }));
    });
    $('#btnCalZoom').addEventListener('click', function () {
      var w = $('#calWrap'), fit = w.classList.toggle('cal--fit');
      $('#btnCalZoom').textContent = fit ? '넓게 보기' : '한눈에 보기';
    });
    $('#btnGmapMode').addEventListener('click', function () {
      state.gmapMode = !state.gmapMode;
      syncMapBtn(); renderMap();
    });
    $('#btnDayRoute').addEventListener('click', function () {
      var url = TR.dayRouteUrl(S.resolvedOn(T.days[state.day].date));
      if (url) w.open(url, '_blank', 'noopener');
      else toast('이 날은 표시할 동선이 없어요');
    });

    d.addEventListener('change', function (e) {
      var c = e.target.closest('input[data-chk]');
      if (c) { S.toggleCheck(c.dataset.chk, c.checked); renderInfo(); }
    });

    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
    });
  }

  function syncMapBtn() {
    var b = $('#btnGmapMode');
    if (!b) return;
    b.textContent = state.gmapMode ? '🔤 영문 핀지도' : '🇰🇷 한글 지도';
    b.classList.toggle('chip--go', state.gmapMode);
  }

  function switchTab(tab) {
    if (['info','cal','pick'].indexOf(tab) < 0) tab = 'schedule';
    state.tab = tab;

    $$('.tabbar__btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.tab === tab); });
    $$('.topnav__btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.tab === tab); });

    $$('.view').forEach(function (v) {
      var k = v.dataset.view;
      if (k === 'map') { v.hidden = false; return; }        // 지도는 항상 살아있음
      v.hidden = k !== tab;
    });

    $('#hero').hidden = tab === 'schedule' ? false : (isDesk() ? tab === 'cal' : true);
    $('#daybar').hidden = tab !== 'schedule';
    $('#btnAdd').hidden = !isDesk() && tab === 'info';
    $('.shell').classList.toggle('shell--wide', tab !== 'schedule');

    placeMap();
    renderMap();
    if (tab === 'cal') renderCal();
    if (tab === 'pick') renderPick();
    w.scrollTo({ top: 0, behavior: 'auto' });
  }

  function doAct(act, id) {
    if (act === 'edit')      { closeSheet(); setTimeout(function () { openForm(id); }, 220); }
    else if (act === 'del')  {
      if (!confirm('이 일정을 삭제할까요?')) return;
      S.removeItem(id); closeSheet(); renderAll(); toast('삭제했어요');
    }
    else if (act === 'editstay') { openStayForm(); }
    else if (act === 'share')    { doShare(); }
    else if (act === 'export')   { doExport(); }
    else if (act === 'import')   { doImport(); }
    else if (act === 'reset')    {
      if (!confirm('내가 추가·수정한 일정이 모두 사라지고 기본 일정으로 돌아갑니다. 계속할까요?')) return;
      S.reset(); closeSheet(); renderDaybar(); renderAll(); toast('초기화했어요');
    }
  }

  function doShare() {
    var url = location.origin + location.pathname + S.shareHash();
    if (url.length > 6000) { toast('일정이 너무 많아 링크가 길어요. 내보내기를 이용해 주세요'); return; }
    var done = function () { toast('공유 링크를 복사했어요 🔗'); };
    if (navigator.clipboard && w.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url, done); });
    } else fallbackCopy(url, done);
  }
  function fallbackCopy(text, cb) {
    var ta = d.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    d.body.appendChild(ta); ta.select();
    try { d.execCommand('copy'); cb(); } catch (e) { prompt('아래 링크를 복사하세요', text); }
    d.body.removeChild(ta);
  }

  function doExport() {
    var blob = new Blob([S.exportJSON()], { type: 'application/json' });
    var a = d.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chiangmai-trip.json';
    d.body.appendChild(a); a.click(); d.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('JSON 파일을 내려받았어요');
  }

  function doImport() {
    var inp = d.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { S.importJSON(fr.result); renderDaybar(); renderAll(); toast('일정을 불러왔어요 ✨'); }
        catch (e) { toast('파일을 읽을 수 없어요'); }
      };
      fr.readAsText(f);
    });
    inp.click();
  }

  function openSettings() {
    var st = S.stay();
    openSheet('설정',
      '<div class="panel" style="box-shadow:none;margin-bottom:12px">' +
        '<div class="panel__h"><em>🏨</em> 숙소</div>' +
        '<div class="kv"><span class="kv__k">' + esc(st.name) + '</span>' +
        '<span class="kv__v">' + st.lat.toFixed(4) + ', ' + st.lng.toFixed(4) + '</span></div>' +
        (st.needsFix ? '<div class="tip" style="margin-top:10px">⚠️ 아직 임시 위치예요. 실제 숙소로 바꿔주세요.</div>' : '') +
        '<div class="btnrow" style="margin-top:12px">' +
          '<button type="button" class="btn btn--primary" data-act="editstay">숙소 위치 설정</button></div>' +
      '</div>' +
      '<div class="btnrow">' +
        '<button type="button" class="btn btn--gold" data-act="share">🔗 공유 링크 복사</button>' +
        '<button type="button" class="btn btn--ghost" data-act="export">일정 내보내기</button>' +
        '<button type="button" class="btn btn--ghost" data-act="import">일정 가져오기</button>' +
        '<button type="button" class="btn btn--danger" data-act="reset">내 변경사항 초기화</button>' +
      '</div>' +
      '<div class="rule"></div>' +
      '<p class="hint">비밀번호는 화면 잠금 수준의 보호예요. 정적 호스팅이라 마음먹고 소스를 열면 내용을 볼 수 있으니, 링크는 둘만 공유해 주세요.</p>' +
      '<p class="hint" style="margin-top:10px">교통비·소요시간은 직선거리 기반 추정치입니다. 실제 요금은 시간대·교통상황에 따라 달라져요.</p>');
  }

  var toastT = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg; el.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('is-on'); }, 2400);
  }

  /* ── 시작 ─────────────────────────────────────────────── */
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', initLock);
  else initLock();

})(window, document);
