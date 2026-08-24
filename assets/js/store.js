/* ══════════════════════════════════════════════════════════
   상태 저장 — 시드(data.js) + 사용자 변경분(delta) 병합
   ══════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  var KEY = 'cnx-trip-v1';
  var seed = w.TRIP;

  /* delta 구조:
     { add:[item...], edit:{id:{...}}, del:[id...], chk:{i:true}, stay:{...}, set:{...} } */
  var D = { add: [], edit: {}, del: [], chk: {}, stay: null, set: {} };

  /* ── 직렬화 ───────────────────────────────────────────── */
  function b64e(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function normalize(d) {
    return {
      add: Array.isArray(d && d.add) ? d.add : [],
      edit: (d && d.edit && typeof d.edit === 'object') ? d.edit : {},
      del: Array.isArray(d && d.del) ? d.del : [],
      chk: (d && d.chk && typeof d.chk === 'object') ? d.chk : {},
      stay: (d && d.stay) || null,
      set: (d && d.set) || {}
    };
  }

  function load() {
    // 공유 링크가 있으면 우선 적용
    var m = /[#&]d=([A-Za-z0-9\-_]+)/.exec(w.location.hash || '');
    if (m) {
      try {
        D = normalize(b64d(m[1]));
        persist();
        history.replaceState(null, '', w.location.pathname + w.location.search);
        return true;                                  // 공유본을 불러왔음
      } catch (e) { /* 무시하고 로컬로 */ }
    }
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) D = normalize(JSON.parse(raw));
    } catch (e) { /* noop */ }
    return false;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* noop */ }
  }

  /* ── 조회 ─────────────────────────────────────────────── */
  function items() {
    var out = [];
    seed.items.forEach(function (it) {
      if (D.del.indexOf(it.id) >= 0) return;
      out.push(D.edit[it.id] ? Object.assign({}, it, D.edit[it.id]) : it);
    });
    D.add.forEach(function (it) {
      if (D.del.indexOf(it.id) >= 0) return;
      out.push(D.edit[it.id] ? Object.assign({}, it, D.edit[it.id]) : it);
    });
    return out.sort(function (a, b) {
      return a.date === b.date ? String(a.s).localeCompare(String(b.s))
                               : a.date.localeCompare(b.date);
    });
  }

  function itemsOn(date) {
    return items().filter(function (i) { return i.date === date; });
  }

  function byId(id) {
    var all = items();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function stay() { return Object.assign({}, seed.stay, D.stay || {}); }

  /* 시드 데이터의 '숙소' 좌표를 현재 숙소로 치환해서 반환 */
  function resolved() {
    var st = stay(), base = seed.stay;
    var moved = st.lat !== base.lat || st.lng !== base.lng;
    return items().map(function (it) {
      if (!moved) return it;
      var isStay = Math.abs(it.lat - base.lat) < 1e-6 && Math.abs(it.lng - base.lng) < 1e-6;
      return isStay ? Object.assign({}, it, { lat: st.lat, lng: st.lng }) : it;
    });
  }
  function resolvedOn(date) {
    return resolved().filter(function (i) { return i.date === date; });
  }

  /* ── 변경 ─────────────────────────────────────────────── */
  function uid() {
    return 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addItem(it) {
    it.id = it.id || uid();
    D.add.push(it); persist(); return it.id;
  }

  function updateItem(id, patch) {
    var idx = -1;
    for (var i = 0; i < D.add.length; i++) if (D.add[i].id === id) idx = i;
    if (idx >= 0) D.add[idx] = Object.assign({}, D.add[idx], patch);   // 내가 추가한 건 직접 수정
    else D.edit[id] = Object.assign({}, D.edit[id] || {}, patch);      // 시드는 delta 로
    persist();
  }

  function removeItem(id) {
    D.add = D.add.filter(function (x) { return x.id !== id; });
    delete D.edit[id];
    if (D.del.indexOf(id) < 0 && seed.items.some(function (s) { return s.id === id; })) D.del.push(id);
    persist();
  }

  function isChecked(k) { return !!D.chk[k]; }
  function toggleCheck(k, on) { if (on) D.chk[k] = 1; else delete D.chk[k]; persist(); }

  function setStay(patch) { D.stay = Object.assign({}, D.stay || {}, patch); persist(); }
  function setting(k, v) {
    if (arguments.length === 1) return D.set[k];
    D.set[k] = v; persist();
  }

  function reset() { D = normalize(null); persist(); }

  function shareHash() { return '#d=' + b64e(D); }
  function exportJSON() { return JSON.stringify(D, null, 2); }
  function importJSON(txt) { D = normalize(JSON.parse(txt)); persist(); }
  function isDirty() {
    return D.add.length > 0 || D.del.length > 0 ||
           Object.keys(D.edit).length > 0 || !!D.stay;
  }

  w.Store = {
    load: load, items: items, itemsOn: itemsOn, byId: byId,
    resolved: resolved, resolvedOn: resolvedOn,
    stay: stay, setStay: setStay,
    addItem: addItem, updateItem: updateItem, removeItem: removeItem,
    isChecked: isChecked, toggleCheck: toggleCheck,
    setting: setting, reset: reset,
    shareHash: shareHash, exportJSON: exportJSON, importJSON: importJSON,
    isDirty: isDirty, uid: uid
  };
})(window);
