/* ══════════════════════════════════════════════════════════
   이동수단 추천 — 치앙마이 기준 요금/소요시간 추정
   ══════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  var R = 6371;
  var ROAD = 1.35;          // 직선거리 → 실제 도로거리 보정
  var WALK_KMH = 4.5;
  var CITY_KMH = 22;        // 치앙마이 시내 평균
  var RURAL_KMH = 45;       // 교외/산길

  function haversine(a1, o1, a2, o2) {
    var d = Math.PI / 180;
    var dLat = (a2 - a1) * d, dLon = (o2 - o1) * d;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a1 * d) * Math.cos(a2 * d) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function isNight(hhmm) {
    if (!hhmm) return false;
    var h = parseInt(hhmm.split(':')[0], 10);
    return h >= 22 || h < 6;
  }

  var baht = function (n) { return Math.round(n / 10) * 10; };

  /* 이동수단별 계산기 (요금은 2인 기준, 썽태우/버스는 인당×2) */
  var MODES = {
    walk: function (km) {
      return { key:'walk', emoji:'🚶', label:'도보',
               min: Math.round(km / WALK_KMH * 60), fare: 0, gmode:'walking' };
    },
    grab: function (km, night) {
      var f = Math.max(50, 40 + 9 * km) * (night ? 1.2 : 1);
      var kmh = km > 15 ? RURAL_KMH : CITY_KMH;
      return { key:'grab', emoji:'🚗', label:'Grab',
               min: Math.round(km / kmh * 60) + 4, fare: baht(f), gmode:'driving' };
    },
    bike: function (km, night) {
      var f = Math.max(30, 25 + 5 * km) * (night ? 1.15 : 1);
      return { key:'bike', emoji:'🛵', label:'GrabBike',
               min: Math.round(km / 26 * 60) + 3, fare: baht(f) * 2, gmode:'driving' };
    },
    songthaew: function (km) {
      var per = km <= 3 ? 30 : km <= 6 ? 40 : km <= 10 ? 60 : 100;
      return { key:'songthaew', emoji:'🛻', label:'썽태우',
               min: Math.round(km / 18 * 60) + 6, fare: per * 2, gmode:'driving',
               hint:'인당 ' + per + '฿ · 현금' };
    },
    tuktuk: function (km) {
      return { key:'tuktuk', emoji:'🛺', label:'툭툭',
               min: Math.round(km / 20 * 60) + 3, fare: baht(Math.max(60, 28 * km)),
               gmode:'driving', hint:'흥정 필요' };
    },
    bus: function (km) {
      return { key:'bus', emoji:'🚌', label:'RTC 스마트버스',
               min: Math.round(km / 15 * 60) + 12, fare: 60, gmode:'transit',
               hint:'인당 30฿ · R3 노선(공항–님만–올드시티–센트럴)' };
    },
    van: function (km) {
      return { key:'van', emoji:'🚐', label:'투어 차량',
               min: Math.round(km / RURAL_KMH * 60), fare: 0, gmode:'driving',
               hint:'투어 요금에 포함' };
    },
    charter: function (km) {
      return { key:'charter', emoji:'🚙', label:'기사 대절',
               min: Math.round(km / RURAL_KMH * 60), fare: 0, gmode:'driving',
               hint:'반일 800~1,200฿ · 종일 1,500~2,000฿' };
    },
    flight: function () {
      return { key:'flight', emoji:'✈️', label:'항공', min:0, fare:0, gmode:null };
    }
  };

  /**
   * 두 일정 사이 이동 계획
   * @returns null 또는 { km, primary, alts[], gmaps, sameSpot }
   */
  function plan(from, to) {
    if (!from || !to) return null;
    if (from.cat === 'flight' || to.cat === 'flight') return null;
    if (!isFinite(from.lat) || !isFinite(to.lat)) return null;

    var straight = haversine(from.lat, from.lng, to.lat, to.lng);
    if (straight < 0.06) return { sameSpot: true };          // 같은 장소

    var km = straight * ROAD;
    var night = isNight(to.s);
    var primary, alts = [];

    // 일정에 이동수단이 지정돼 있으면 우선
    var forced = to.move && MODES[to.move] ? to.move : null;

    if (forced) {
      primary = MODES[forced](km, night);
      if (forced !== 'grab' && km < 40) alts.push(MODES.grab(km, night));
    } else if (km < 0.9) {
      primary = MODES.walk(km);
      alts.push(MODES.songthaew(km));
    } else if (km <= 3) {
      primary = MODES.grab(km, night);
      alts.push(MODES.songthaew(km), MODES.walk(km));
    } else if (km <= 12) {
      primary = MODES.grab(km, night);
      alts.push(MODES.songthaew(km), MODES.bike(km, night));
    } else if (km <= 30) {
      primary = MODES.grab(km, night);
      alts.push(MODES.charter(km));
    } else {
      primary = MODES.charter(km);
      alts.push(MODES.grab(km, night));
    }

    return {
      km: km,
      primary: primary,
      alts: alts,
      gmaps: dirUrl(from, to, primary.gmode || 'driving')
    };
  }

  function dirUrl(from, to, gmode) {
    return 'https://www.google.com/maps/dir/?api=1' +
      '&origin=' + from.lat + ',' + from.lng +
      '&destination=' + to.lat + ',' + to.lng +
      '&travelmode=' + (gmode || 'driving');
  }

  /** 하루 전체 동선을 구글맵 경로로 (경유지 최대 9개) */
  function dayRouteUrl(items) {
    var pts = items.filter(function (i) {
      return isFinite(i.lat) && isFinite(i.lng) && i.cat !== 'flight';
    });
    // 연속 중복 좌표 제거
    var uniq = [];
    pts.forEach(function (p) {
      var l = uniq[uniq.length - 1];
      if (!l || haversine(l.lat, l.lng, p.lat, p.lng) > 0.06) uniq.push(p);
    });
    if (uniq.length < 2) return null;

    var origin = uniq[0], destination = uniq[uniq.length - 1];
    var mid = uniq.slice(1, -1);
    if (mid.length > 9) {                        // 균등 샘플링
      var step = mid.length / 9, s = [];
      for (var i = 0; i < 9; i++) s.push(mid[Math.floor(i * step)]);
      mid = s;
    }
    var u = 'https://www.google.com/maps/dir/?api=1' +
      '&origin=' + origin.lat + ',' + origin.lng +
      '&destination=' + destination.lat + ',' + destination.lng +
      '&travelmode=driving';
    if (mid.length) {
      u += '&waypoints=' + mid.map(function (p) { return p.lat + ',' + p.lng; }).join('|');
    }
    return u;
  }

  function placeUrl(item) {
    if (isFinite(item.lat) && isFinite(item.lng)) {
      return 'https://www.google.com/maps/search/?api=1&query=' +
             item.lat + ',' + item.lng;
    }
    return 'https://www.google.com/maps/search/?api=1&query=' +
           encodeURIComponent((item.title || '') + ' Chiang Mai');
  }

  function fmtMin(m) {
    if (m < 60) return m + '분';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + '시간 ' + r + '분' : h + '시간';
  }
  function fmtKm(km) { return km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km'; }

  w.Transit = {
    plan: plan, haversine: haversine, dirUrl: dirUrl,
    dayRouteUrl: dayRouteUrl, placeUrl: placeUrl,
    fmtMin: fmtMin, fmtKm: fmtKm, MODES: MODES
  };
})(window);
