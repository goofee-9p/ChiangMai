/* ══════════════════════════════════════════════════════════
   지도 — Leaflet 핀 모드 + 구글맵 임베드 모드
   ══════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  var DAY_LIGHT = ['#B5432B','#B57F10','#08795F','#6B3D92','#BB3866','#1B69B0','#5C7A19','#A65418'];
  var DAY_DARK  = ['#FF7B5B','#FFC246','#29CFAC','#B98CE0','#FF7EA8','#5AB0F0','#A3D149','#F0A15C'];
  var CNX_CENTER = [18.7883, 98.9853];

  function isDark() {
    return !!(w.matchMedia && w.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function dayColor(i) {
    var a = isDark() ? DAY_DARK : DAY_LIGHT;
    return a[i % a.length];
  }

  function create(el, opts) {
    opts = opts || {};
    var map = L.map(el, {
      center: CNX_CENTER, zoom: 12,
      zoomControl: false, attributionControl: true,
      tap: true, scrollWheelZoom: true
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // 영문(로마자) 라벨 지도 — 태국어 표기 대신 읽을 수 있게
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Tiles &copy; Esri'
    }).addTo(map);

    var markers = {}, line = null, layer = L.layerGroup().addTo(map);

    function icon(n, color, active) {
      return L.divIcon({
        className: '',
        html: '<div class="pin-marker' + (active ? ' is-active' : '') +
              '" style="background:' + color + '"><span>' + n + '</span></div>',
        iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24]
      });
    }

    /** items: [{id,title,lat,lng,s,cat}], color: 이 날의 색
     *  o.labels=false 이면 선택된 핀에만 이름표를 붙인다(작은 지도용) */
    function render(items, color, activeId, o) {
      o = o || {};
      layer.clearLayers(); markers = {};
      var pts = [];
      items.forEach(function (it, i) {
        if (!isFinite(it.lat) || !isFinite(it.lng)) return;
        pts.push([it.lat, it.lng]);
        var m = L.marker([it.lat, it.lng], {
          icon: icon(i + 1, color, it.id === activeId), riseOnHover: true
        });
        m.bindPopup(
          '<div class="pop__t">' + esc(it.title) + '</div>' +
          '<div class="pop__m">' + esc(it.s || '') + (it.addr ? ' · ' + esc(it.addr) : '') + '</div>' +
          '<a class="pop__a" href="' + w.Transit.placeUrl(it) + '" target="_blank" rel="noopener">구글맵에서 열기 ↗</a>'
        );
        if (o.labels !== false || it.id === activeId) {
          m.bindTooltip(shortName(it.title), {
            permanent: true, direction: 'right', offset: [7, -9],
            className: 'pin-label' + (it.id === activeId ? ' is-active' : ''),
            interactive: false
          });
        }
        m.on('click', function () { if (opts.onPick) opts.onPick(it.id); });
        m.addTo(layer);
        markers[it.id] = m;
      });
      syncLabels();
      if (pts.length > 1) {
        line = L.polyline(pts, {
          color: color, weight: 2.4, opacity: .62, dashArray: '5 7', lineJoin: 'round'
        }).addTo(layer);
      }
      return pts;
    }

    function fit(pts) {
      if (!pts || !pts.length) map.setView(CNX_CENTER, 12);
      else if (pts.length === 1) map.setView(pts[0], 15);
      else map.fitBounds(L.latLngBounds(pts).pad(0.18), { animate: false });
      syncLabels();
    }

    function focus(id, zoom) {
      var m = markers[id];
      if (!m) return;
      map.setView(m.getLatLng(), zoom || Math.max(map.getZoom(), 15), { animate: true });
      m.openPopup();
    }

    /** 줌이 낮으면 이름표가 겹치므로 숨김 */
    function syncLabels() { el.classList.toggle('hide-labels', map.getZoom() < 12); }
    map.on('zoomend', syncLabels);

    function invalidate() { map.invalidateSize({ animate: false }); }

    /** 컨테이너 크기 재계산 후 화면 맞춤 — 탭 전환 직후엔 반드시 이걸로 */
    function refresh(pts) {
      requestAnimationFrame(function () {
        map.invalidateSize({ animate: false });
        fit(pts);
        setTimeout(function () { map.invalidateSize({ animate: false }); fit(pts); }, 180);
      });
    }

    return { map: map, render: render, fit: fit, focus: focus,
             invalidate: invalidate, refresh: refresh };
  }

  /** 단일 장소 미리보기용 구글맵 임베드 (API 키 불필요) */
  function embedPlace(lat, lng, zoom) {
    return 'https://maps.google.com/maps?q=' + lat + ',' + lng +
           '&z=' + (zoom || 16) + '&hl=ko&output=embed';
  }

  /**
   * 하루치를 구글맵으로 임베드 (API 키 불필요)
   * activeId 가 있으면 그 장소에 핀을 찍고, 없으면 전체가 담기도록 중심·줌 계산
   */
  function embedDay(list, activeId) {
    var pts = list.filter(function (i) { return isFinite(i.lat) && isFinite(i.lng); });
    if (!pts.length) return null;

    if (activeId) {
      for (var i = 0; i < pts.length; i++) {
        if (pts[i].id === activeId) return embedPlace(pts[i].lat, pts[i].lng, 16);
      }
    }
    if (pts.length === 1) return embedPlace(pts[0].lat, pts[0].lng, 15);

    var laMin = 90, laMax = -90, loMin = 180, loMax = -180;
    pts.forEach(function (p) {
      laMin = Math.min(laMin, p.lat); laMax = Math.max(laMax, p.lat);
      loMin = Math.min(loMin, p.lng); loMax = Math.max(loMax, p.lng);
    });
    var cLat = (laMin + laMax) / 2, cLng = (loMin + loMax) / 2;
    var spanLng = Math.max(loMax - loMin, 0.004);
    var spanLat = Math.max(laMax - laMin, 0.004);
    // 가로 375px / 세로 455px 기준으로 여유 있게 담기는 줌
    var z = Math.floor(Math.min(
      Math.log2(430 / spanLng),
      Math.log2(430 / spanLat)
    ));
    z = Math.max(9, Math.min(16, z));
    return 'https://maps.google.com/maps?ll=' + cLat.toFixed(5) + ',' + cLng.toFixed(5) +
           '&z=' + z + '&hl=ko&output=embed';
  }

  /** 이름표에 쓸 짧은 제목 — '점심 · ' 같은 접두사 제거 */
  function shortName(t) {
    var n = String(t || '').replace(/^(아침|점심|저녁|브런치|야식)\s*·\s*/, '');
    n = n.replace(/\s*\([^)]*\)\s*$/, '');
    return esc(n.length > 14 ? n.slice(0, 13) + '…' : n);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  w.MapView = {
    create: create, dayColor: dayColor,
    embedPlace: embedPlace, embedDay: embedDay
  };
})(window);
