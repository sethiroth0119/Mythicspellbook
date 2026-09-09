/* ═══════════════════════════════════════════════════════════════════════════
   mapforge.editor.js — Athena Engine (World Forge), the in-game 3D map creator.

   A full-screen overlay: sculpt + paint a heightfield, place props and .glb
   models with a gizmo, set water / sky / sun, walk the map in Play mode,
   save to the cloud (sql/091) or this device, export JSON.

   Layering, so it stays understandable:
     format.js  the document        world.js   document → scene (runtime)
     terrain.js the heightfield     water.js   the water plane
     props.js   built-in assets     api.js     saving/loading
     this file  the UI + tools on top of all that. Nothing below imports it.

   Rejected: editing the legacy Battlemap Editor (index.html) into this. It
   is a fixed-grid tile painter tied to Forge.battleMap3d and the battle
   board's cell size; a free-form world with a heightfield, water and a
   gizmo is a different tool, and CLAUDE.md forbids new top-level systems in
   index.html anyway. The two can coexist; this one exposes buildWorld() so
   the board can consume a World Forge map later without a port.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ensureThree } from './mapforge.three.js';
import { buildWorld, bufferToB64 } from './mapforge.world.js';
import { createPlayer } from './mapforge.player.js';
import { newMap, normalize, serialize, clone, uid, PAINT, ENV_PRESETS, LOOP_MODES, resampleTerrain, gameId, assetBytes, embeddedBytes, HUBS, normalizeMenu, normalizeAct, normalizePlayer, PLAYER_ANIMS, PLAYER_CAST_MAX } from './mapforge.format.js';
import * as assetsApi from './mapforge.assets.js';
import { refreshMenu } from './mapforge.menu.js';
import { EMITTERS } from './mapforge.vfx.js';
import { createAvatar, VIEWS } from './mapforge.avatar.js';
import { miniGames } from './mapforge.bridge.js';
import { refreshLive } from './mapforge.pill.js';
import { PROP_CATALOG, PROP_BY_ID, buildProp } from './mapforge.props.js';
import { WEATHERS } from './mapforge.vfx.js';
import * as api from './mapforge.api.js';
import { confirm as askConfirm, signedIn, displayName, isAdmin, bridge, hubs as bridgeHubs, guides as bridgeGuides } from './mapforge.bridge.js';

let ED = null;
export function isOpen() { return !!ED; }
export function current() { return ED; }

export async function openEditor(opts) {
  opts = opts || {};
  if (ED) return ED;
  const root = document.createElement('div');
  root.id = 'mf-root';
  root.innerHTML = TEMPLATE;
  ensureCss();
  document.body.appendChild(root);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));
  const loading = $('.mf-loading');
  const toastEl = $('.mf-toast');
  let toastT = 0;
  const toast = (m, ms) => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 2600); };

  const S = {
    THREE: null, map: null, source: null, isPublic: false, mine: true, dirty: false,
    tool: 'select', sculptMode: 'raise', brush: { radius: 6, strength: 0.5, falloff: 0.6 },
    paintIdx: 0, propId: 'tree', propTint: null, assetId: null,
    scatter: { count: 6, jitterRot: true, jitterScale: 0.3, avoidWater: true },
    selectedId: null, gizmoMode: 'translate', snap: false, undo: [], redo: [], playing: false,
    showGrid: false, showMarkers: true, showColliders: false,
    hotkeys: (() => { try { return localStorage.getItem('mf_hotkeys') === 'default' ? 'default' : 'unreal'; } catch (e) { return 'unreal'; } })(),
    rmb: false, gizmoSpace: 'world', snapSize: 1,
    audioUrl: null, audioName: null, fxPreset: null,   // picked in the Files tab, consumed by makeObject
  };
  const teardown = [];
  ED = { root, S, close: () => close(false), toast, get map() { return S.map; }, get world() { return world; }, camera: null, scene: null, renderer: null };

  // ── three.js ──
  let THREE, missing;
  try { ({ THREE, missing } = await ensureThree()); } catch (e) {
    loading.innerHTML = '<div>three.js failed to load</div><div class="sub">Check your connection and try again.</div><button class="primary" style="margin-top:12px">Close</button>';
    loading.querySelector('button').onclick = () => close(true);
    return ED;
  }
  S.THREE = THREE;
  if (!ED) return null;   // closed while loading

  // ── document ──
  let doc = null;
  if (opts.map) doc = normalize(opts.map);
  else if (opts.id) {
    const r = await api.loadMap(opts.id, opts.source || 'local');
    if (r.ok) { doc = r.map; S.source = opts.source || 'local'; S.isPublic = !!r.is_public; S.mine = r.mine !== false; }
    else toast('Could not load that map: ' + (r.error || 'unknown error'), 4000);
  }
  let freshStart = false;
  // Opened FOR a mini-game (the ⚒ pill on that screen): its live world when
  // there is one, otherwise a fresh map already tagged with the game. Someone
  // else's live world opens read-only-ish: the first save makes your copy.
  if (!doc && opts.game) {
    const r = await api.loadLive(opts.game);
    if (r.ok && r.map) { doc = r.map; S.source = r.source || 'cloud'; S.isPublic = true; S.mine = r.mine !== false; }
    else { doc = newMap({ author: displayName(), game: gameId(opts.game) || 'sandbox' }); freshStart = true; }
  }
  if (!doc) {
    const draft = api.loadDraft();
    if (draft) { doc = draft; S.source = null; setTimeout(() => toast('Restored your unsaved draft — save it or start a New map.', 4200), 600); }
  }
  if (!doc) { doc = newMap({ author: displayName() }); freshStart = true; }
  if (!ED) return null;

  // ── scene ──
  const canvasHost = $('.mf-canvas');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.insertBefore(renderer.domElement, canvasHost.firstChild);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
  let world = null, gridHelper = null;
  ED.camera = camera; ED.scene = scene; ED.renderer = renderer;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const brushRing = makeBrushRing(THREE); scene.add(brushRing);
  let ghost = null;
  // collider outlines: the selected object's (gold) and, on demand, everyone's
  const colSel = new THREE.Box3Helper(new THREE.Box3(), 0xffd23f); colSel.visible = false; colSel.material.depthTest = false; colSel.material.transparent = true; colSel.material.opacity = 0.9; scene.add(colSel);
  const colAll = new THREE.Group(); colAll.visible = false; scene.add(colAll);
  function drawColliders() {
    const o = objById(S.selectedId), c = o && world.colliders.get(o.id);
    colSel.visible = !!c && !S.playing;
    if (c) colSel.box.set(new THREE.Vector3(c.minX, c.bottom, c.minZ), new THREE.Vector3(c.maxX, c.top, c.maxZ));
    while (colAll.children.length) { const k = colAll.children.pop(); k.geometry && k.geometry.dispose(); }
    colAll.visible = S.showColliders && !S.playing;
    if (colAll.visible) world.colliders.forEach(c => { const h = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(c.minX, c.bottom, c.minZ), new THREE.Vector3(c.maxX, c.top, c.maxZ)), 0x5fd38a); h.material.transparent = true; h.material.opacity = 0.55; colAll.add(h); });
  }

  // camera controls — real OrbitControls when the addon loaded, a small
  // built-in orbit otherwise, both driven through the same `controls` shape
  const controls = makeControls(THREE, camera, renderer.domElement);
  let gizmo = null;
  if (THREE.TransformControls) {
    gizmo = new THREE.TransformControls(camera, renderer.domElement);
    gizmo.setSize(0.9); gizmo.setSpace('world');
    gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; if (e.value) beginObjectEdit(); else endObjectEdit(); });
    gizmo.addEventListener('objectChange', onGizmoChange);
    scene.add(gizmo);
  }
  ED.gizmo = gizmo;
  if (missing && missing.length) setTimeout(() => toast('Some editor addons did not load (' + missing.join(', ') + ') — using built-in fallbacks.', 4500), 900);

  // ── the Mini-game field: a select fed by the game's own registry ──
  // window.MythicBridge.miniGames() (index.html's ATHENA_MINI_GAMES), plus
  // 'sandbox', every game a saved map already carries, the current value if
  // it is none of those, and a Custom… entry for an id not on the list.
  let _knownGames = [];
  function setGameField(value, extra) {
    const sel = $('#mf-game'); if (!sel) return;
    if (extra) _knownGames = extra.slice();
    const opts = []; const seen = new Set();
    const add = (val, label) => { val = gameId(val); if (!val || seen.has(val)) return; seen.add(val); opts.push({ val, label: label || val }); };
    add('sandbox', 'sandbox · no game');
    miniGames().forEach(g => add(g.key || g.id, (g.name || g.id) + ' · ' + gameId(g.key || g.id)));
    _knownGames.forEach(g => add(g));
    add(value);
    sel.innerHTML = opts.map(o => '<option value="' + esc(o.val) + '">' + esc(o.label) + '</option>').join('') + '<option value="__custom__">Custom id…</option>';
    sel.value = gameId(value) || 'sandbox';
  }
  function currentGameField() { const sel = $('#mf-game'); const v = sel ? sel.value : ''; return v === '__custom__' ? (S.map.game || 'sandbox') : v; }

  function loadDoc(map, source) {
    if (world) { scene.remove(world.group); world.dispose(); }
    if (gridHelper) { scene.remove(gridHelper); gridHelper = null; }
    S.map = map; S.source = source == null ? S.source : source;
    world = buildWorld(THREE, map, { scene, onAssetLoaded: () => {} });
    scene.add(world.group);
    world.setMarkersVisible(S.showMarkers);
    if (S.showGrid) toggleGrid(true);
    S.undo.length = 0; S.redo.length = 0; select(null);
    frameOverview();
    $('.mf-top .name input').value = map.name;
    $('#mf-desc').value = map.description || '';
    setGameField(map.game || 'sandbox');
    renderTerrainTab(); renderWaterTab(); renderSkyTab(); renderStats();
    setDirty(false);
  }
  function frameOverview() {
    const size = world.terrain.size;
    let sum = 0; const h = S.map.terrain.heights; for (let i = 0; i < h.length; i += 7) sum += h[i];
    const avg = sum / Math.ceil(h.length / 7);
    controls.target.set(0, avg, 0);
    camera.position.set(size * 0.55, Math.max(12, size * 0.42 + avg), size * 0.55);
    controls.update();
  }

  loadDoc(doc, S.source);
  if (freshStart) { world.terrain.generate({ type: 'hills', seed: (Math.random() * 1e6) | 0, amplitude: 6, scale: 0.35 }); regroundAll(); }

  // ── sizing ──
  function resize() {
    const w = canvasHost.clientWidth || 1, h = canvasHost.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvasHost); resize();
  teardown.push(() => ro.disconnect());

  /* ═══ TOOLS ═══ */
  const stroke = { active: false, hit: null, target: 0, before: null, lastX: 0, lastZ: 0, dist: 0 };

  function setTool(t) {
    S.tool = t;
    $$('.mf-tools button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    const gs = $('#mf-gm-select'); if (gs) gs.classList.toggle('on', t === 'select');
    if (t !== 'select' && gizmo) gizmo.detach();
    if (t === 'select' && gizmo && S.selectedId) { const r = world.objects.get(S.selectedId); if (r) gizmo.attach(r); }
    refreshGhost();
    renderHud();
  }
  function setSculptMode(m) { S.sculptMode = m; $$('button[data-sculpt]').forEach(b => b.classList.toggle('on', b.dataset.sculpt === m)); renderHud(); }

  function effectiveSculptMode(ev) {
    if (ev && ev.altKey) return 'flatten';
    if (ev && ev.ctrlKey) return 'smooth';
    if (ev && ev.shiftKey) return S.sculptMode === 'lower' ? 'raise' : 'lower';
    return S.sculptMode;
  }

  function updatePointer(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function hitTerrain() { const h = raycaster.intersectObject(world.terrain.mesh, false); return h.length ? h[0].point : null; }
  function hitObject() {
    world.objectsGroup.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(world.objectsGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && !(o.userData && o.userData.mfId)) o = o.parent; if (o && o.visible) return o; }
    // Near-miss pick: thin things (lantern posts, fences, a bird's wing) are
    // easy to click past. Take the nearest object whose centre projects within
    // a few pixels of the pointer, the way most editors forgive a miss.
    const r = renderer.domElement.getBoundingClientRect(), tol = 14, px = (pointer.x + 1) / 2 * r.width, py = (1 - pointer.y) / 2 * r.height;
    let best = null, bestD = tol * tol; const c = new THREE.Vector3(), bb = new THREE.Box3();
    world.objects.forEach(root => {
      if (!root.visible) return;
      bb.setFromObject(root); if (bb.isEmpty()) return; bb.getCenter(c); c.project(camera);
      if (c.z > 1) return;
      const dx = (c.x + 1) / 2 * r.width - px, dy = (1 - c.y) / 2 * r.height - py, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = root; }
    });
    return best;
  }

  let lastMods = { shiftKey: false, ctrlKey: false, altKey: false };
  function onPointerDown(ev) {
    if (S.playing) return;
    renderer.domElement.focus();
    if (ev.button === 2) S.rmb = true;
    if (ev.button !== 0) return;
    if (gizmo && gizmo.dragging) return;
    if (gizmo && gizmo.object && gizmo.axis) return;     // clicked the gizmo itself (axis goes stale after detach — hence the .object check)
    updatePointer(ev);
    lastMods = { shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, altKey: ev.altKey };
    if (S.tool === 'select') {
      const o = hitObject();
      select(o ? o.userData.mfId : null);
      if (o && !gizmo) { stroke.active = true; stroke.dragObj = o; beginObjectEdit(); }
      return;
    }
    if (S.tool === 'erase') { const o = hitObject(); if (o) { beginObjectEdit(); removeObject(o.userData.mfId); endObjectEdit(); } return; }
    const p = hitTerrain(); if (!p) return;
    if (S.tool === 'place') { beginObjectEdit(); placeAt(p, true); endObjectEdit(); return; }
    if (S.tool === 'scatter') { beginObjectEdit(); stroke.active = true; stroke.dist = 1e9; stroke.hit = p; stroke.lastX = p.x; stroke.lastZ = p.z; scatterAt(p); return; }
    if (S.tool === 'sculpt' || S.tool === 'paint') {
      stroke.active = true; stroke.hit = p; stroke.before = world.terrain.snapshot(); stroke.target = world.terrain.heightAt(p.x, p.z);
      renderer.domElement.setPointerCapture(ev.pointerId);
    }
  }
  function onPointerMove(ev) {
    if (S.playing) return;
    updatePointer(ev);
    lastMods = { shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, altKey: ev.altKey };
    const p = hitTerrain();
    stroke.hit = p;
    if (stroke.active && stroke.dragObj && p) {
      const o = objById(stroke.dragObj.userData.mfId); if (!o) return;
      o.p[0] = p.x; o.p[2] = p.z; if (o.g) o.p[1] = world.heightAt(p.x, p.z);
      world.applyTransform(stroke.dragObj, o); setDirty(true); renderInspector();
    }
    if (stroke.active && S.tool === 'scatter' && p) {
      stroke.dist += Math.hypot(p.x - stroke.lastX, p.z - stroke.lastZ); stroke.lastX = p.x; stroke.lastZ = p.z;
      if (stroke.dist > S.brush.radius * 0.8) { stroke.dist = 0; scatterAt(p); }
    }
  }
  function onPointerUp(ev) {
    if (ev.button === 2) { S.rmb = false; fly.keys = {}; }
    if (!stroke.active) return;
    stroke.active = false;
    try { renderer.domElement.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (stroke.dragObj) { stroke.dragObj = null; endObjectEdit(); return; }
    if (S.tool === 'scatter') { endObjectEdit(); return; }
    if (stroke.before) {
      pushUndo({ type: 'terrain', before: stroke.before, after: world.terrain.snapshot() });
      stroke.before = null; regroundAll(); setDirty(true);
    }
  }
  const cv = renderer.domElement;
  cv.tabIndex = 0;
  cv.addEventListener('pointerdown', onPointerDown);
  cv.addEventListener('pointermove', onPointerMove);
  cv.addEventListener('pointerup', onPointerUp);
  cv.addEventListener('pointerleave', () => { stroke.hit = null; });
  window.addEventListener('pointerup', (e) => { if (e.button === 2) { S.rmb = false; fly.keys = {}; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  /* Sculpting runs per FRAME while the button is held so the rate is
     time-based, not event-based: a fast mouse and a slow one raise the same
     hill per second. */
  function applyStrokeFrame(dt) {
    if (!stroke.active || !stroke.hit || !(S.tool === 'sculpt' || S.tool === 'paint')) return;
    const b = S.brush, p = stroke.hit;
    if (S.tool === 'paint') { world.terrain.applyBrush({ x: p.x, z: p.z, radius: b.radius, strength: b.strength, falloff: b.falloff, mode: 'paint', paint: S.paintIdx }); return; }
    const mode = effectiveSculptMode(lastMods);
    const rate = mode === 'raise' || mode === 'lower' ? b.strength * 9 * dt : b.strength * 6 * dt;
    world.terrain.applyBrush({ x: p.x, z: p.z, radius: b.radius, strength: rate, falloff: b.falloff, mode, target: stroke.target });
  }

  /* ═══ OBJECTS ═══ */
  function objById(id) { return S.map.objects.find(o => o.id === id) || null; }
  function beginObjectEdit() { stroke.objBefore = { objects: clone(S.map.objects), assets: clone(S.map.assets) }; }
  function endObjectEdit() {
    if (!stroke.objBefore) return;
    const after = { objects: clone(S.map.objects), assets: clone(S.map.assets) };
    if (JSON.stringify(after) !== JSON.stringify(stroke.objBefore)) { pushUndo({ type: 'objects', before: stroke.objBefore, after }); setDirty(true); }
    stroke.objBefore = null;
    drawColliders();
  }
  function makeObject(p, extra) {
    const isGlb = S.propId === 'glb';
    const o = { id: uid('o_'), t: isGlb ? 'glb' : S.propId, p: [p.x, world.heightAt(p.x, p.z), p.z], r: [0, 0, 0], s: [1, 1, 1], g: true };
    if (isGlb) { o.a = S.assetId; const fit = assetFit.get(S.assetId); if (fit) o.s = [fit, fit, fit]; }
    else if (S.propTint && PROP_BY_ID[o.t] && PROP_BY_ID[o.t].tint) o.c = S.propTint;
    if (o.t === 'audio' && S.audioUrl) { o.au = { url: S.audioUrl, vol: 1, r: 20, loop: true }; o.n = (S.audioName || 'Sound').slice(0, 60); }
    if (S.fxPreset && o.t === 'fx_' + S.fxPreset.kind) { if (S.fxPreset.c) o.c = S.fxPreset.c; if (S.fxPreset.fx) o.fx = S.fxPreset.fx; if (S.fxPreset.label) o.n = S.fxPreset.label.slice(0, 60); }
    Object.assign(o, extra || {});
    return o;
  }
  function placeAt(p, selectIt) {
    if (S.propId === 'glb' && !S.assetId) { toast('Add a model URL in the Library first.'); return; }
    if (S.propId === 'audio' && !S.audioUrl) { toast('Pick an audio file in the Files tab first — the marker plays that file.', 3600); showTab('files'); return; }
    const o = makeObject(p, S.scatter.jitterRot && S.tool === 'scatter' ? { r: [0, Math.random() * Math.PI * 2, 0] } : null);
    S.map.objects.push(o); world.addObject(o);
    if (selectIt && S.tool === 'select') select(o.id);
    renderStats();
    return o;
  }
  function scatterAt(p) {
    if (S.propId === 'glb' && !S.assetId) { toast('Add a model URL in the Library first.'); stroke.active = false; return; }
    const R = S.brush.radius, half = world.terrain.half;
    for (let i = 0; i < S.scatter.count; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      const y = world.heightAt(x, z);
      if (S.scatter.avoidWater && S.map.water.on && y < S.map.water.level) continue;
      const o = makeObject({ x, z }, {});
      o.p = [x, y, z];
      if (S.scatter.jitterRot) o.r = [0, Math.random() * Math.PI * 2, 0];
      if (S.scatter.jitterScale > 0) { const k = 1 + (Math.random() * 2 - 1) * S.scatter.jitterScale; o.s = o.s.map(v => v * k); }
      S.map.objects.push(o); world.addObject(o);
    }
    renderStats();
  }
  function removeObject(id) {
    const i = S.map.objects.findIndex(o => o.id === id); if (i < 0) return;
    S.map.objects.splice(i, 1); world.removeObject(id);
    if (S.selectedId === id) select(null);
    renderStats();
  }
  function select(id, _quiet) { if (!_quiet && tabOn('scene')) setTimeout(renderSceneTab, 0);
    S.selectedId = id;
    setTimeout(drawColliders, 0);
    if (gizmo) { const r = id ? world.objects.get(id) : null; if (r && S.tool === 'select') { gizmo.attach(r); gizmo.setMode(S.gizmoMode); } else gizmo.detach(); }
    renderInspector();
  }
  function onGizmoChange() {
    const o = objById(S.selectedId), r = world.objects.get(S.selectedId); if (!o || !r) return;
    if (gizmo.mode === 'translate' && o.g) {
      if (gizmo.axis === 'Y') o.g = false;      // lifting it = they want it off the ground
      else r.position.y = world.heightAt(r.position.x, r.position.z);
    }
    o.p = [r.position.x, r.position.y, r.position.z]; o.r = [r.rotation.x, r.rotation.y, r.rotation.z]; o.s = [r.scale.x, r.scale.y, r.scale.z];
    world.updateCollider(o.id); drawColliders();
    setDirty(true); renderInspector();
  }
  function regroundAll() {
    S.map.objects.forEach(o => { if (o.g) { o.p[1] = world.heightAt(o.p[0], o.p[2]); const r = world.objects.get(o.id); if (r) r.position.y = o.p[1]; } });
    world.updateAllColliders(); drawColliders();
  }
  function duplicateSelected() {
    const o = objById(S.selectedId); if (!o) return;
    beginObjectEdit();
    const c = clone(o); c.id = uid('o_'); c.p[0] += 1.5; c.p[2] += 1.5; if (c.g) c.p[1] = world.heightAt(c.p[0], c.p[2]);
    S.map.objects.push(c); world.addObject(c); select(c.id); endObjectEdit(); renderStats();
  }
  function focusSelected() {
    const r = world.objects.get(S.selectedId); if (!r) return;
    const bb = new THREE.Box3().setFromObject(r), size = new THREE.Vector3(); bb.getSize(size);
    const c = new THREE.Vector3(); bb.getCenter(c);
    const d = Math.max(4, size.length() * 2.2);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    controls.target.copy(c); camera.position.copy(c).addScaledVector(dir, d); controls.update();
  }

  /* custom .glb assets: remember a "fit to 2 m" scale per asset so the first
     placement is a sane size no matter what units the file was exported in */
  const assetFit = new Map();
  async function addAsset(url, label, hints) {
    url = String(url || '').trim(); if (!url) return;
    const dup = S.map.assets.find(a => a.url === url); if (dup) { S.propId = 'glb'; S.assetId = dup.id; renderLibrary(); refreshGhost(); return; }
    if (!/^(https?:\/\/|\/|\.\/)/i.test(url)) { toast('Model URL must start with https:// or /'); return; }
    if (!/\.gl(b|tf)(\?|#|$)/i.test(url)) toast('Expected a .glb / .gltf URL — trying anyway.', 3000);
    if (!THREE.GLTFLoader) { toast('GLTFLoader did not load — custom models unavailable right now.', 3600); return; }
    beginObjectEdit();
    const a = { id: uid('a_'), label: (label || url.split('/').pop().split('?')[0] || 'Model').slice(0, 60), url };
    if (hints && Array.isArray(hints.anims)) a.anims = hints.anims.slice(0, 64);
    S.map.assets.push(a);
    endObjectEdit();
    S.propId = 'glb'; S.assetId = a.id; renderLibrary(); refreshGhost();
    toast('Loading ' + a.label + '…', 2000);
    try {
      const { size, clips } = await world.loadAsset(a.id);
      const m = Math.max(size.x, size.y, size.z) || 1;
      assetFit.set(a.id, Math.min(50, Math.max(0.01, 2 / m)));
      toast(a.label + ' ready' + (clips.length ? ' · ' + clips.length + ' animation' + (clips.length > 1 ? 's' : '') : '') + ' — click the ground to place it.', 3000);
      renderLibrary(); refreshGhost();
    } catch (e) { toast('Could not load ' + a.label + ' (' + ((e && e.message) || 'network/CORS') + ').', 4200); }
  }
  /* Models from disk: embedded into the document as base64 so the map stays a
     single self-contained file. Admin-only (the editor button is admin-only
     too): embedded files end up in a cloud row, and this repo does not host
     player-uploaded binaries — see CLAUDE.md. Production assets belong in
     /models/ (the Project list) — Relink converts an embed to that URL. */
  const EMBED_MAX = 2.5 * 1024 * 1024;
  async function addAssetFile(file) {
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) { if (/\.json$/i.test(file.name)) { importJson(file); return; } toast('Only .glb / .gltf files can be dropped here.'); return; }
    if (bridge() && !isAdmin()) { toast('Embedding model files is admin-only — reference a URL instead.', 3600); return; }
    if (!THREE.GLTFLoader) { toast('GLTFLoader did not load — custom models unavailable right now.', 3600); return; }
    if (file.size > EMBED_MAX) { toast(file.name + ' is ' + (file.size / 1048576).toFixed(1) + ' MB — over the ' + (EMBED_MAX / 1048576) + ' MB embed limit. Put it in /models/ and add it by URL.', 5200); return; }
    if (/\.gltf$/i.test(file.name)) { toast('.gltf with external files cannot be embedded — export as a single .glb.', 4200); return; }
    const buf = await file.arrayBuffer();
    beginObjectEdit();
    const a = { id: uid('a_'), label: file.name.replace(/\.glb$/i, '').slice(0, 60), data: bufferToB64(buf), size: file.size };
    S.map.assets.push(a);
    endObjectEdit();
    S.propId = 'glb'; S.assetId = a.id; libCat = 'Models'; renderLibrary(); refreshGhost();
    if (S.tool === 'select' || S.tool === 'erase') setTool('place');
    toast('Embedding ' + a.label + ' (' + (file.size / 1024).toFixed(0) + ' KB)…', 2000);
    try {
      const { size, clips } = await world.loadAsset(a.id);
      const m = Math.max(size.x, size.y, size.z) || 1;
      assetFit.set(a.id, Math.min(50, Math.max(0.01, 2 / m)));
      toast(a.label + ' ready' + (clips.length ? ' · ' + clips.length + ' animation' + (clips.length > 1 ? 's' : '') : '') + ' — click the ground to place it.', 3200);
      renderLibrary(); refreshGhost(); setDirty(true);
    } catch (e) { toast('Could not read ' + a.label + ' (' + ((e && e.message) || 'bad file') + ').', 4200); }
  }
  function relinkAsset(id) {
    const a = S.map.assets.find(x => x.id === id); if (!a) return;
    const url = window.prompt('URL this model is served from (e.g. /models/' + a.label.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase() + '.glb):', a.url || '');
    if (!url) return;
    beginObjectEdit(); a.url = url.trim(); delete a.data; delete a.size; endObjectEdit();
    renderLibrary(); setDirty(true); toast('Relinked — it will load from the URL on next open.');
  }
  let projectLib = null;   // /models/manifest.json, fetched once per session
  async function loadProjectLib() {
    if (projectLib) return projectLib;
    try { const r = await fetch('/models/manifest.json', { cache: 'no-cache' }); const j = r.ok ? await r.json() : null; projectLib = (j && Array.isArray(j.models)) ? j.models.filter(m => m && m.url) : []; }
    catch (e) { projectLib = []; }
    return projectLib;
  }
  function removeAsset(id) {
    beginObjectEdit();
    S.map.assets = S.map.assets.filter(a => a.id !== id);
    S.map.objects.filter(o => o.t === 'glb' && o.a === id).map(o => o.id).forEach(removeObject);
    if (S.assetId === id) { S.assetId = null; if (S.propId === 'glb') S.propId = 'tree'; }
    endObjectEdit(); renderLibrary(); refreshGhost();
  }

  /* placement ghost — a see-through preview under the cursor */
  function refreshGhost() {
    if (ghost) { scene.remove(ghost); ghost = null; }
    if (!(S.tool === 'place' || S.tool === 'scatter')) return;
    const g = S.propId === 'glb' ? buildProp(THREE, 'placeholder') : buildProp(THREE, S.propId, S.propTint);
    g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; o.material.depthWrite = false; o.castShadow = false; } });
    if (S.propId === 'glb') { const f = assetFit.get(S.assetId); if (f) g.scale.setScalar(f); }
    ghost = g; ghost.visible = false; scene.add(ghost);
  }

  /* ═══ UNDO ═══ */
  function pushUndo(e) { S.undo.push(e); if (S.undo.length > 60) S.undo.shift(); S.redo.length = 0; renderUndo(); }
  function applyEntry(e, dir) {
    const snap = dir < 0 ? e.before : e.after;
    if (e.type === 'terrain') {
      const resized = snap.n !== S.map.terrain.n || snap.cell !== S.map.terrain.cell;
      world.terrain.restore(snap); if (resized) world.onTerrainRebuilt(); regroundAll(); renderTerrainTab();
    } else if (e.type === 'objects') {
      S.map.objects = clone(snap.objects); S.map.assets = clone(snap.assets);
      Array.from(world.objects.keys()).forEach(id => world.removeObject(id));
      S.map.objects.forEach(o => world.addObject(o));
      if (S.selectedId && !objById(S.selectedId)) select(null); else select(S.selectedId);
      renderLibrary(); renderStats();
    } else if (e.type === 'settings') {
      Object.assign(S.map, clone(snap)); world.applyEnv(S.map.env); world.applyWater(S.map.water); renderWaterTab(); renderSkyTab();
    }
    setDirty(true);
  }
  function undo() { const e = S.undo.pop(); if (!e) return; S.redo.push(e); applyEntry(e, -1); renderUndo(); }
  function redo() { const e = S.redo.pop(); if (!e) return; S.undo.push(e); applyEntry(e, +1); renderUndo(); }
  function renderUndo() { $('#mf-undo').disabled = !S.undo.length; $('#mf-redo').disabled = !S.redo.length; }
  // settings edits (water/sky) coalesce: one undo step per slider drag
  let settingsBefore = null, settingsT = 0;
  function settingsChanged() {
    if (!settingsBefore) settingsBefore = { water: clone(S.map.water), env: clone(S.map.env) };
    clearTimeout(settingsT);
    settingsT = setTimeout(() => { pushUndo({ type: 'settings', before: settingsBefore, after: { water: clone(S.map.water), env: clone(S.map.env) } }); settingsBefore = null; }, 700);
    setDirty(true);
  }

  /* ═══ PLAY MODE ═══ — the shared first-person walker (mapforge.player.js) */
  const play = { savedCam: null, savedTarget: null };
  const player = createPlayer(THREE, { world: { get map() { return S.map; }, get terrain() { return world.terrain; }, heightAt: (x, z) => world.heightAt(x, z), groundAt: (x, z, f) => world.groundAt(x, z, f), resolveMove: (...a) => world.resolveMove(...a), spawns: () => world.spawns() }, camera, dom: renderer.domElement, onUnlock: () => stopPlay() });
  ED.play = player;
  function startPlay() {
    if (S.playing) return;
    S.playing = true; canvasHost.classList.add('play');
    play.savedCam = camera.position.clone(); play.savedTarget = controls.target.clone();
    controls.enabled = false; if (gizmo) gizmo.detach(); brushRing.visible = false; if (ghost) ghost.visible = false;
    world.setMarkersVisible(false); colSel.visible = false; colAll.visible = false;
    const sp = world.spawns()[0];
    /* 🎥 Play uses the map's point of view and character, exactly as the game will */
    S.map.player = normalizePlayer(S.map.player);
    if (play.avatar) { try { play.avatar.dispose(); } catch (e) {} play.avatar = null; }
    if (S.map.player.model && S.map.player.model.a) { try { play.avatar = createAvatar(THREE, { world, scene, player: S.map.player }); } catch (e) { play.avatar = null; } }
    player.setView(S.map.player.view, play.avatar);
    player.start(sp ? null : { pos: new THREE.Vector3(controls.target.x, 0, controls.target.z), yaw: Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) + Math.PI });
    $('#mf-play').classList.add('on'); $('#mf-play').textContent = '■ Stop';
    // 🔊 sound markers play in Play mode: pressing Play is itself the gesture
    try { world.attachAudio(camera); world.startAudio(); } catch (e) {}
  }
  function stopPlay() {
    if (!S.playing) return;
    try { world.stopAudio(); } catch (e) {}
    S.playing = false; canvasHost.classList.remove('play');
    player.stop(); drawColliders();
    if (play.avatar) { try { play.avatar.dispose(); } catch (e) {} play.avatar = null; }
    controls.enabled = true; camera.position.copy(play.savedCam); controls.target.copy(play.savedTarget); controls.update();
    world.setMarkersVisible(S.showMarkers);
    $('#mf-play').classList.remove('on'); $('#mf-play').textContent = '▶ Play';
    if (S.selectedId) select(S.selectedId);
  }
  function playFrame(dt) { player.frame(dt); }

  /* ═══ KEYBOARD ═══ */
  const fly = { keys: {} };
  function isTyping(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  function onKeyDown(e) {
    if (S.playing && (e.key === 'e' || e.key === 'E') && !isTyping(e)) { try { player.interact(); } catch (x) {} }
    if (!ED) return;
    if ($('.mf-help').classList.contains('on') && e.key === 'Escape') { $('.mf-help').classList.remove('on'); return; }
    if (isTyping(e)) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (S.playing) { if (k === 'escape') stopPlay(); return; }   // movement keys belong to the player
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); save(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicateSelected(); return; }
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    if (S.hotkeys === 'unreal') {
      // Unreal: W/A/S/D fly only while the right mouse button is held; otherwise
      // Q select, W move, E rotate, R scale — the viewport hotkeys Unreal users have in their hands.
      if (S.rmb && ['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(k) && !mod) { fly.keys[k] = true; if (k !== 'shift') e.preventDefault(); return; }
      if (!mod) { switch (k) { case 'q': setTool('select'); e.preventDefault(); return; case 'w': setGizmoMode('translate'); e.preventDefault(); return; case 'e': setGizmoMode('rotate'); e.preventDefault(); return; case 'r': setGizmoMode('scale'); e.preventDefault(); return; case 'end': dropSelected(); e.preventDefault(); return; } }
    } else if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(k) && !mod) { fly.keys[k] = true; if (k !== 'shift') e.preventDefault(); return; }
    switch (k) {
      case '1': setTool('select'); break; case '2': setTool('sculpt'); break; case '3': setTool('paint'); break;
      case '4': setTool('place'); break; case '5': setTool('scatter'); break; case '6': setTool('erase'); break;
      case 't': setGizmoMode('translate'); break; case 'r': setGizmoMode('rotate'); break; case 'c': setGizmoMode('scale'); break;
      case 'x': S.snap = !S.snap; applySnap(); renderHud(); break;
      case 'f': focusSelected(); break;
      case 'delete': case 'backspace': if (S.selectedId) { beginObjectEdit(); removeObject(S.selectedId); endObjectEdit(); } break;
      case 'escape': select(null); break;
      case '[': S.brush.radius = Math.max(0.5, S.brush.radius * 0.85); renderBrush(); break;
      case ']': S.brush.radius = Math.min(60, S.brush.radius * 1.18); renderBrush(); break;
      case 'p': togglePlay(); break;
      case 'h': $('.mf-help').classList.toggle('on'); break;
      default: return;
    }
    e.preventDefault();
  }
  function onKeyUp(e) { const k = e.key.toLowerCase(); fly.keys[k] = false; }
  window.addEventListener('keydown', onKeyDown, true); window.addEventListener('keyup', onKeyUp, true);
  teardown.push(() => { window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true); });
  function flyFrame(dt) {
    const k = fly.keys; if (!(k.w || k.a || k.s || k.d || k.q || k.e)) return;
    const speed = (k.shift ? 3 : 1) * Math.max(6, camera.position.distanceTo(controls.target) * 0.6) * dt;
    const fwd = new THREE.Vector3().subVectors(controls.target, camera.position); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x), mv = new THREE.Vector3();
    if (k.w) mv.add(fwd); if (k.s) mv.sub(fwd); if (k.d) mv.add(right); if (k.a) mv.sub(right); if (k.e) mv.y += 1; if (k.q) mv.y -= 1;
    mv.multiplyScalar(speed); camera.position.add(mv); controls.target.add(mv);
  }
  function setGizmoMode(m) { S.gizmoMode = m; if (gizmo) gizmo.setMode(m); if (S.tool !== 'select') setTool('select'); $$('.mf-gizmo button[data-gm]').forEach(b => b.classList.toggle('on', b.dataset.gm === m)); }
  function applySnap() { if (!gizmo) return; gizmo.setTranslationSnap(S.snap ? S.snapSize : null); gizmo.setRotationSnap(S.snap ? THREE.MathUtils.degToRad(15) : null); gizmo.setScaleSnap(S.snap ? 0.25 : null); $('#mf-snap').classList.toggle('on', S.snap); }
  function setGizmoSpace(sp) { S.gizmoSpace = sp; if (gizmo) gizmo.setSpace(sp); $('#mf-space').textContent = sp === 'local' ? '⟲ Local' : '🌐 World'; }
  function dropSelected() { const o = objById(S.selectedId); if (!o) return; beginObjectEdit(); o.p[1] = world.heightAt(o.p[0], o.p[2]); o.g = true; world.refreshObject(o); endObjectEdit(); setDirty(true); renderInspector(); }
  function setHotkeys(h) { S.hotkeys = h === 'default' ? 'default' : 'unreal'; try { localStorage.setItem('mf_hotkeys', S.hotkeys); } catch (e) {} $('#mf-hotkeys').value = S.hotkeys; renderToolbar(); renderHud(); }
  function renderToolbar() {
    const u = S.hotkeys === 'unreal';
    $('#mf-gm-select').innerHTML = '↖ Select <kbd>' + (u ? 'Q' : '1') + '</kbd>';
    $$('.mf-gizmo button[data-gm]').forEach(b => { const m = b.dataset.gm; b.innerHTML = (m === 'translate' ? '✥ Move' : m === 'rotate' ? '⟳ Rotate' : '⤢ Scale') + ' <kbd>' + (u ? { translate: 'W', rotate: 'E', scale: 'R' }[m] : { translate: 'T', rotate: 'R', scale: 'C' }[m]) + '</kbd>'; });
  }
  function togglePlay() { S.playing ? stopPlay() : startPlay(); }

  /* ═══ SAVE / LOAD ═══ */
  let draftT = 0;
  function setDirty(d) {
    S.dirty = d;
    const st = $('.mf-top .state'); st.textContent = d ? '● Unsaved changes' : (S.source === 'cloud' ? '☁ Saved to cloud' : S.source === 'local' ? '💾 Saved on this device' : 'New map');
    st.classList.toggle('dirty', d);
    if (d) { clearTimeout(draftT); draftT = setTimeout(() => api.saveDraft(S.map), 3000); }
  }
  async function save(forceSource) {
    if (!S.mine && S.source === 'cloud') {
      // someone else's public map — saving makes YOUR copy
      S.map.id = uid('map_'); S.map.name = (S.map.name + ' (copy)').slice(0, 80); S.mine = true; S.isPublic = false;
      $('.mf-top .name input').value = S.map.name;
    }
    S.map.name = ($('.mf-top .name input').value || 'Untitled world').trim().slice(0, 80);
    S.map.description = ($('#mf-desc').value || '').slice(0, 2000);
    S.map.game = gameId(currentGameField()) || 'sandbox'; setGameField(S.map.game);
    const source = forceSource || S.source || (signedIn() ? 'cloud' : 'local');
    S.map.menu = normalizeMenu(S.map.menu);
    if (S.map.menu.on && source === 'cloud' && !S.isPublic) { S.isPublic = true; toast('This map is a menu button, so it is saved public.', 2600); }
    const btn = $('#mf-save'); btn.disabled = true;
    const r = await api.saveMap(S.map, source, source === 'cloud' ? S.isPublic : undefined);
    btn.disabled = false;
    if (!r.ok) { toast('Save failed: ' + (r.error || 'unknown error'), 5000); return false; }
    S.source = r.source; setDirty(false); api.clearDraft();
    if (r.fellBack) toast(r.missing ? 'Cloud maps are not set up yet (run sql/091) — saved on this device instead.' : r.offline ? 'Not signed in — saved on this device.' : 'Cloud save failed (' + r.error + ') — saved on this device instead.', 5200);
    else toast(r.source === 'cloud' ? '☁ Saved to the cloud.' : '💾 Saved on this device.');
    if (S.map.menu.on && r.source !== 'cloud') toast('The menu button only shows once the map is saved to the cloud.', 4200);
    try { refreshMenu(); } catch (e) {}
    renderMapsTab();
    return true;
  }
  function exportJson() {
    const doc = serialize(S.map);
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (doc.name || 'world').toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.world.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Exported ' + a.download);
  }
  function importJson(file) {
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const m = normalize(JSON.parse(rd.result));
        m.id = uid('map_'); m.name = (m.name + ' (imported)').slice(0, 80);
        if (S.dirty && !(await askConfirm('Discard unsaved changes and open the imported map?'))) return;
        loadDoc(m, null); setDirty(true); toast('Imported — save it to keep it.');
      } catch (e) { toast('That file is not an Athena Engine map.', 3200); }
    };
    rd.readAsText(file);
  }
  async function newMapFlow() {
    if (S.dirty && !(await askConfirm('Discard unsaved changes and start a new map?'))) return;
    const m = newMap({ author: displayName(), game: gameId(currentGameField()) || 'sandbox' });
    loadDoc(m, null); world.terrain.generate({ type: 'hills', seed: (Math.random() * 1e6) | 0, amplitude: 6, scale: 0.35 }); regroundAll(); renderTerrainTab();
    api.clearDraft(); setDirty(false); S.isPublic = false; S.mine = true; renderMapsTab();
  }
  async function openMap(id, source) {
    if (S.dirty && !(await askConfirm('Discard unsaved changes and open that map?'))) return;
    const r = await api.loadMap(id, source);
    if (!r.ok) { toast('Could not open: ' + (r.error || 'unknown'), 4000); return; }
    S.isPublic = !!r.is_public; S.mine = r.mine !== false;
    loadDoc(r.map, source); api.clearDraft(); renderMapsTab();
    if (!S.mine) toast('This is someone else\'s public map — saving creates your own copy.', 4200);
  }
  async function close(force) {
    if (!ED) return;
    if (!force && S.dirty && !(await askConfirm('You have unsaved changes. Close anyway? (A draft is kept on this device.)'))) return;
    if (S.dirty) api.saveDraft(S.map);
    stopPlay();
    cancelAnimationFrame(raf);
    teardown.forEach(f => { try { f(); } catch (e) {} });
    try { if (world) world.dispose(); renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    root.remove(); document.body.style.overflow = prevOverflow;
    ED = null;
    // The ⚒ pill hid itself while the editor covered the screen; a live map may
    // also have been set or unset in here. Reload the live index and redraw it.
    try { refreshLive(); } catch (e) {}
    try { if (opts.onClose) opts.onClose(); } catch (e) {}
  }
  ED.close = () => close(false);
  // For code that edits S.map directly (tests, future game hooks): refresh the chrome.
  ED.refresh = () => { renderStats(); renderInspector(); renderLibrary(); };

  /* ═══ UI RENDERERS ═══ */
  function renderHud() {
    const b = S.brush;
    const tool = { select: 'Select', sculpt: 'Sculpt · ' + S.sculptMode, paint: 'Paint · ' + PAINT[S.paintIdx].label, place: 'Place · ' + propLabel(), scatter: 'Scatter · ' + propLabel(), erase: 'Erase' }[S.tool];
    $('#mf-hud-tool').innerHTML = '<b>' + esc(tool) + '</b>' + (S.tool === 'sculpt' || S.tool === 'paint' || S.tool === 'scatter' ? ' · radius ' + b.radius.toFixed(1) + 'm' : '') + (S.snap ? ' · snap' : '');
    const gk = S.hotkeys === 'unreal' ? '<b>W/E/R</b> move/rotate/scale · <b>RMB+WASD</b> fly' : '<b>T/R/C</b> move/rotate/scale · <b>WASD</b> fly';
    $('#mf-hud-help').innerHTML = { select: 'Click an object · ' + gk + ' · <b>F</b> focus · <b>Del</b> remove · <b>Ctrl+D</b> duplicate', sculpt: 'Drag to raise · <b>Shift</b> lower · <b>Ctrl</b> smooth · <b>Alt</b> flatten · <b>[ ]</b> radius', paint: 'Drag to paint the selected layer · <b>[ ]</b> radius', place: 'Click the ground to place · pick a prop in the Library', scatter: 'Drag to scatter several props · <b>[ ]</b> radius', erase: 'Click an object to remove it' }[S.tool];
  }
  function propLabel() { if (S.propId === 'glb') { const a = S.map.assets.find(x => x.id === S.assetId); return a ? a.label : 'model'; } return (PROP_BY_ID[S.propId] || {}).label || S.propId; }
  function renderBrush() {
    const b = S.brush; $('#mf-radius').value = b.radius; $('#mf-radius-v').textContent = b.radius.toFixed(1) + 'm';
    $('#mf-strength').value = b.strength; $('#mf-strength-v').textContent = Math.round(b.strength * 100) + '%';
    $('#mf-falloff').value = b.falloff; $('#mf-falloff-v').textContent = Math.round(b.falloff * 100) + '%';
    renderHud();
  }
  function renderPalette() {
    $('#mf-palette').innerHTML = PAINT.map((p, i) => '<button data-paint="' + i + '" class="' + (i === S.paintIdx ? 'on' : '') + '"><span class="sw" style="background:' + p.color + '"></span>' + esc(p.label) + '</button>').join('');
    $$('#mf-palette button').forEach(b => b.onclick = () => { S.paintIdx = +b.dataset.paint; if (S.tool !== 'paint') setTool('paint'); renderPalette(); renderHud(); });
  }
  let libCat = 'Nature';
  function renderLibrary() {
    const cats = ['Nature', 'Structures', 'Props', 'Ruins', 'VFX', 'Markers', 'Models'];
    $('#mf-cats').innerHTML = cats.map(c => '<button data-cat="' + c + '" class="' + (c === libCat ? 'on' : '') + '">' + c + '</button>').join('');
    $$('#mf-cats button').forEach(b => b.onclick = () => { libCat = b.dataset.cat; renderLibrary(); });
    const grid = $('#mf-props'), models = $('#mf-models');
    if (libCat === 'Models') {
      grid.innerHTML = ''; models.style.display = '';
      $('#mf-assets').innerHTML = S.map.assets.length ? S.map.assets.map(a => '<div class="mf-asset ' + (S.propId === 'glb' && S.assetId === a.id ? 'on' : '') + '" data-asset="' + a.id + '"><span>' + (a.data ? '📦' : '🧊') + '</span><span class="lb" title="' + esc(a.url || 'embedded in this map') + '">' + esc(a.label) + (a.anims && a.anims.length ? ' <small>🎞 ' + a.anims.length + '</small>' : '') + '</span>' + (a.data ? '<span class="tag" title="Embedded in the map (' + (assetBytes(a) / 1024).toFixed(0) + ' KB). Relink to a /models/ URL for production.">' + (assetBytes(a) / 1024).toFixed(0) + 'K</span><span class="rl" title="Relink to a URL">↗</span>' : '') + '<span class="x" title="Remove model and every placed copy">✕</span></div>').join('') : '<div class="mf-empty">No models in this map yet. Drop a <b>.glb</b> on the canvas, pick one from the Project list, or paste a URL.</div>';
      const eb = embeddedBytes(S.map); $('#mf-embed-note').textContent = eb ? 'Embedded models: ' + (eb / 1048576).toFixed(2) + ' MB of 3.5 MB cloud limit' : '';
      $$('#mf-assets .mf-asset').forEach(el => {
        el.onclick = (e) => { if (e.target.classList.contains('x')) { removeAsset(el.dataset.asset); return; } if (e.target.classList.contains('rl')) { relinkAsset(el.dataset.asset); return; } S.propId = 'glb'; S.assetId = el.dataset.asset; if (S.tool === 'select' || S.tool === 'erase') setTool('place'); renderLibrary(); refreshGhost(); renderHud(); };
      });
      loadProjectLib().then(lib => {
        const box = $('#mf-project'); if (!box || libCat !== 'Models') return;
        box.innerHTML = lib.length ? lib.map((m, i) => '<div class="mf-asset" data-proj="' + i + '" title="' + esc(m.url) + '"><span>🗂</span><span class="lb">' + esc(m.label || m.id || m.url) + (m.anims && m.anims.length ? ' <small>🎞 ' + m.anims.length + '</small>' : '') + '</span><span class="tag">' + esc(m.cat || 'model') + '</span></div>').join('') : '<div class="mf-empty">No project models listed. Add .glb files to /models/ and list them in /models/manifest.json.</div>';
        box.querySelectorAll('[data-proj]').forEach(el => el.onclick = () => { const m = lib[+el.dataset.proj]; addAsset(m.url, m.label || m.id, { anims: m.anims }); if (S.tool === 'select' || S.tool === 'erase') setTool('place'); });
      });
    } else {
      models.style.display = 'none';
      grid.innerHTML = PROP_CATALOG.filter(p => p.cat === libCat).map(p => '<button data-prop="' + p.id + '" class="' + (S.propId === p.id ? 'on' : '') + '" title="' + esc(p.label) + '"><span class="ic">' + p.icon + '</span>' + esc(p.label) + '</button>').join('');
      $$('#mf-props button').forEach(b => b.onclick = () => { S.propId = b.dataset.prop; if (S.tool === 'select' || S.tool === 'erase') setTool('place'); renderLibrary(); refreshGhost(); renderHud(); });
    }
    const tintable = S.propId !== 'glb' && PROP_BY_ID[S.propId] && PROP_BY_ID[S.propId].tint;
    $('#mf-tint-row').style.display = tintable ? '' : 'none';
    $('#mf-tint-on').checked = !!S.propTint;
  }
  function renderInspector() {
    const box = $('#mf-inspector'); const o = objById(S.selectedId);
    if (!o) { box.innerHTML = '<div class="mf-empty">Nothing selected. Use <b>Select</b> (1) and click an object, or pick a prop from the Library and click the ground to place it.</div>'; return; }
    const meta = PROP_BY_ID[o.t] || { label: o.t === 'glb' ? 'Model' : o.t, icon: o.t === 'glb' ? '🧊' : '🧩' };
    const label = o.t === 'glb' ? ((S.map.assets.find(a => a.id === o.a) || {}).label || 'Model') : meta.label;
    const deg = (r) => Math.round(r * 180 / Math.PI * 10) / 10;
    const f = (v) => Math.round(v * 100) / 100;
    box.innerHTML = `
      <div class="mf-row"><label>Name</label><input type="text" id="mf-o-name" value="${esc(o.n || '')}" placeholder="${esc(label)}" maxlength="60"></div>
      <div class="mf-row"><label>Type</label><div style="flex:1;color:#cfc7ad">${meta.icon || ''} ${esc(label)}</div></div>
      <div class="mf-row3"><label>Position</label><input type="number" step="0.1" data-f="p" data-i="0" value="${f(o.p[0])}"><input type="number" step="0.1" data-f="p" data-i="1" value="${f(o.p[1])}"><input type="number" step="0.1" data-f="p" data-i="2" value="${f(o.p[2])}"></div>
      <div class="mf-row3"><label>Rotation°</label><input type="number" step="5" data-f="r" data-i="0" value="${deg(o.r[0])}"><input type="number" step="5" data-f="r" data-i="1" value="${deg(o.r[1])}"><input type="number" step="5" data-f="r" data-i="2" value="${deg(o.r[2])}"></div>
      <div class="mf-row3"><label>Scale</label><input type="number" step="0.1" min="0.01" data-f="s" data-i="0" value="${f(o.s[0])}"><input type="number" step="0.1" min="0.01" data-f="s" data-i="1" value="${f(o.s[1])}"><input type="number" step="0.1" min="0.01" data-f="s" data-i="2" value="${f(o.s[2])}"></div>
      <div class="mf-row"><label>Uniform</label><input type="range" id="mf-o-uni" min="0.05" max="6" step="0.05" value="${Math.max(0.05, Math.min(6, o.s[0]))}"><span class="v" id="mf-o-uni-v">${f(o.s[0])}×</span></div>
      ${meta.tint ? `<div class="mf-row"><label>Tint</label><input type="color" id="mf-o-tint" value="${o.c || '#ffffff'}"><button id="mf-o-untint" style="flex:1">Default colour</button></div>` : ''}
      <div class="mf-row"><label>Grounded</label><input type="checkbox" id="mf-o-ground" ${o.g ? 'checked' : ''}><span class="mf-hint" style="margin:0">follows the terrain height</span></div>
      ${(meta.fxKind || meta.fx) ? (() => { const f = o.fx || { i: 1, s: 1 }; const built = !!meta.fx; return `
      <div class="mf-fx"><div class="mf-row" style="margin-bottom:5px"><label>Effect</label><span class="st">✨ ${esc(meta.fxKind ? (PROP_BY_ID[o.t].label) : meta.fx.kind)}${built ? ' (built in)' : ''}</span>${built ? '<input type="checkbox" id="mf-o-fxon" ' + (f.off ? '' : 'checked') + ' title="Effect on/off">' : ''}</div>
        <div class="mf-row"><label>Intensity</label><input type="range" id="mf-o-fxi" min="0.1" max="4" step="0.1" value="${f.i}"><span class="v" id="mf-o-fxi-v">${f.i.toFixed(1)}×</span></div>
        <div class="mf-row"><label>Size</label><input type="range" id="mf-o-fxs" min="0.2" max="6" step="0.1" value="${f.s}"><span class="v" id="mf-o-fxs-v">${f.s.toFixed(1)}×</span></div>
        ${meta.fxKind ? '<div class="mf-row"><label>Tint</label><input type="color" id="mf-o-fxc" value="' + (o.c || '#ff8a1a') + '"><button id="mf-o-fxuntint" style="flex:1">Default colour</button></div>' : ''}
      </div>`; })() : ''}
      <div class="mf-col ${world.isSolid(o) ? 'solid' : ''}">
        <div class="mf-row" style="margin-bottom:5px"><label>Collision</label><span class="st">${world.isSolid(o) ? '● Solid — blocks the player' : '○ None — walk through'}</span></div>
        <div class="mf-btns">${world.isSolid(o) ? '<button id="mf-o-col-off">－ Remove collision</button>' : '<button id="mf-o-col-on" class="primary">＋ Add collision</button>'}<select id="mf-o-cs" ${world.isSolid(o) ? '' : 'disabled'}><option value="box" ${o.cs !== 'cyl' ? 'selected' : ''}>Box</option><option value="cyl" ${o.cs === 'cyl' ? 'selected' : ''}>Cylinder</option></select></div>
      </div>
      ${o.t === 'glb' ? (() => { const clips = world.clipsOf(o.id); const known = clips.length ? clips : ((S.map.assets.find(a => a.id === o.a) || {}).anims || []); const cur = o.anim && o.anim.clip; return `
      <div class="mf-anim"><div class="mf-row" style="margin-bottom:4px"><label>Animations</label><span class="st">🎞 ${known.length} clip${known.length === 1 ? '' : 's'}${o.anim && o.anim.src ? ' · + file' : ''}</span></div>
        ${known.length ? '<div class="mf-clips">' + known.map(c => '<button data-clip="' + esc(c) + '" class="' + (c === cur ? 'on' : '') + '" title="Play ' + esc(c) + '">▶ ' + esc(c) + '</button>').join('') + '</div>' : ''}
        <div class="mf-btns"><button id="mf-o-upanim">⤒ Upload animation for this model</button><button id="mf-o-pickanim" title="Choose an uploaded animation in the Files tab">🎞 From Files</button><input type="file" id="mf-o-animfile" accept=".glb,.gltf" hidden></div>
      </div>` + (known.length ? `
      <div class="mf-row"><label>Animation</label><select id="mf-o-anim"><option value="">— none —</option>${known.map(c => '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>').join('')}</select></div>
      <div class="mf-row"><label>Speed</label><input type="range" id="mf-o-aspeed" min="0" max="4" step="0.05" value="${o.anim ? o.anim.speed : 1}"><span class="v" id="mf-o-aspeed-v">${(o.anim ? o.anim.speed : 1).toFixed(2)}×</span></div>
      <div class="mf-row"><label>Loop</label><select id="mf-o-aloop">${LOOP_MODES.map(l => '<option value="' + l + '"' + (o.anim && o.anim.loop === l ? ' selected' : '') + '>' + l + '</option>').join('')}</select></div>` : (world.objects.get(o.id) && world.objects.get(o.id).userData.mfPending ? '<p class="mf-hint">Loading model…</p>' : '<p class="mf-hint">This model has no animation clips of its own — upload an animation file for it.</p>')); })() : ''}
      ${o.t === 'audio' ? (() => { const au = o.au || { url: '', vol: 1, r: 20, loop: true }; return `
      <div class="mf-fx"><div class="mf-row" style="margin-bottom:5px"><label>Sound</label><span class="st" title="${esc(au.url)}">🔊 ${au.url ? esc(au.url.split('/').pop().replace(/^[a-z0-9]+_/, '')) : 'no file — pick one in Files'}</span></div>
        <div class="mf-row"><label>Volume</label><input type="range" id="mf-o-auv" min="0" max="1" step="0.05" value="${au.vol}"><span class="v" id="mf-o-auv-v">${Math.round(au.vol * 100)}%</span></div>
        <div class="mf-row"><label>Range</label><input type="range" id="mf-o-aur" min="1" max="200" step="1" value="${au.r}"><span class="v" id="mf-o-aur-v">${au.r} m</span></div>
        <div class="mf-row"><label>Loop</label><input type="checkbox" id="mf-o-aul" ${au.loop !== false ? 'checked' : ''}><span class="mf-hint" style="margin:0">plays in Play mode and in the game</span></div>
      </div>`; })() : ''}
      ${!(PROP_BY_ID[o.t] && PROP_BY_ID[o.t].marker && o.t !== 'zone') && !o.t.startsWith('fx_') ? (() => { const act = o.act || { kind: 'none' }; const hubs = bridgeHubs(), gl = bridgeGuides(), games = miniGames(); const opt = (list, cur, idk, namek) => list.map(x => '<option value="' + esc(x[idk]) + '"' + (x[idk] === cur ? ' selected' : '') + '>' + esc(x[namek] || x[idk]) + '</option>').join(''); return `
      <div class="mf-act ${act.kind !== 'none' ? 'on' : ''}"><div class="mf-row" style="margin-bottom:5px"><label>Interaction</label><select id="mf-o-act"><option value="none" ${act.kind === 'none' ? 'selected' : ''}>${o.t === 'zone' ? 'Map default (Menu tab)' : 'None'}</option><option value="screen" ${act.kind === 'screen' ? 'selected' : ''}>Enter → open a screen</option><option value="hub" ${act.kind === 'hub' ? 'selected' : ''}>Enter → open a menu</option><option value="guide" ${act.kind === 'guide' ? 'selected' : ''}>Talk → play a guide</option></select></div>
        ${act.kind === 'screen' ? '<div class="mf-row"><label>Screen</label><select id="mf-o-act-target"><option value="">— pick —</option>' + opt(games, act.target, 'id', 'name') + '</select></div>' : ''}
        ${act.kind === 'hub' ? '<div class="mf-row"><label>Menu</label><select id="mf-o-act-hub">' + opt(hubs, act.hub || 'main', 'id', 'name') + '</select></div>' : ''}
        ${act.kind === 'guide' ? '<div class="mf-row"><label>Guide</label><select id="mf-o-act-guide"><option value="">— pick —</option>' + opt(gl, act.guide, 'id', 'title') + '</select></div>' : ''}
        ${act.kind !== 'none' ? '<div class="mf-row"><label>Prompt</label><input type="text" id="mf-o-act-prompt" maxlength="40" value="' + esc(act.prompt || '') + '" placeholder="' + (act.kind === 'guide' ? 'Talk' : 'Enter') + '"></div>' + (o.t === 'zone' ? '<div class="mf-row"><label>Trigger</label><input type="checkbox" id="mf-o-act-auto" ' + (act.auto === false ? '' : 'checked') + '><span class="mf-hint" style="margin:0">fires on entry (off: press E inside)</span></div>' : '') : ''}
        <p class="mf-hint">${o.t === 'zone' ? 'Walking into the zone runs this.' : 'Standing beside it and pressing <b>E</b> runs this.'}</p>
      </div>`; })() : ''}
      <div class="mf-btns" style="margin-top:8px"><button id="mf-o-drop">⤓ Drop to ground</button><button id="mf-o-dup">⧉ Duplicate</button><button id="mf-o-focus">◎ Focus</button><button id="mf-o-del" class="danger">✕ Delete</button></div>`;
    const commit = (fn) => { beginObjectEdit(); fn(); world.refreshObject(o); if (gizmo && gizmo.object) gizmo.object.updateMatrixWorld(); endObjectEdit(); setDirty(true); };
    box.querySelectorAll('input[data-f]').forEach(inp => inp.onchange = () => commit(() => {
      const v = parseFloat(inp.value); if (!Number.isFinite(v)) return;
      const fld = inp.dataset.f, i = +inp.dataset.i;
      if (fld === 'r') o.r[i] = v * Math.PI / 180; else if (fld === 's') o.s[i] = Math.max(0.01, v); else { o.p[i] = v; if (i === 1) o.g = false; }
    }));
    const uni = box.querySelector('#mf-o-uni');
    uni.oninput = () => { const v = parseFloat(uni.value); o.s = [v, v, v]; world.refreshObject(o); box.querySelector('#mf-o-uni-v').textContent = f(v) + '×'; box.querySelectorAll('input[data-f="s"]').forEach(x => x.value = f(v)); setDirty(true); };
    uni.onpointerdown = () => beginObjectEdit(); uni.onchange = () => endObjectEdit();
    box.querySelector('#mf-o-name').onchange = (e) => commit(() => { o.n = e.target.value.trim().slice(0, 60) || undefined; });
    const tint = box.querySelector('#mf-o-tint'); if (tint) { tint.oninput = () => { o.c = tint.value; world.refreshObject(o); setDirty(true); }; tint.onpointerdown = () => beginObjectEdit(); tint.onchange = () => endObjectEdit(); box.querySelector('#mf-o-untint').onclick = () => commit(() => { delete o.c; }); }
    box.querySelector('#mf-o-ground').onchange = (e) => commit(() => { o.g = e.target.checked; if (o.g) o.p[1] = world.heightAt(o.p[0], o.p[2]); });
    if (o.t === 'glb') {
      const applyClip = (clip, src) => { beginObjectEdit(); o.anim = clip ? { clip, speed: (o.anim && o.anim.speed) || 1, loop: (o.anim && o.anim.loop) || 'repeat', src: src || (o.anim && o.anim.src) || undefined } : undefined; const okp = world.setAnim(o.id, o.anim); endObjectEdit(); setDirty(true); renderInspector(); if (clip && okp === false) toast('That clip does not fit this model\'s skeleton.', 3600); };
      box.querySelectorAll('[data-clip]').forEach(b => { b.onclick = () => applyClip(b.dataset.clip === (o.anim && o.anim.clip) ? '' : b.dataset.clip); });
      const upb = box.querySelector('#mf-o-upanim'), pkb = box.querySelector('#mf-o-pickanim'), fin = box.querySelector('#mf-o-animfile');
      if (upb) upb.onclick = () => fin.click();
      if (fin) fin.onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const r = await assetsApi.upload(f, { inspect: inspectFile, kind: 'anim' }); if (!ED) return; if (!r.ok) { toast(r.missing ? 'The files table is not set up yet — run sql/112_world_assets.sql.' : 'Upload failed: ' + (r.error || 'unknown error'), 5200); return; } filesCache = null; select(o.id); useFile(r.row); };
      if (pkb) pkb.onclick = () => { filesFilter = 'anim'; showTab('files'); toast('Pick an animation — ▶ Apply puts it on the selected model.', 3600); };
    }
    const animSel = box.querySelector('#mf-o-anim');
    if (animSel) {
      const applyAnim = () => { const clip = animSel.value; o.anim = clip ? { clip, speed: +box.querySelector('#mf-o-aspeed').value, loop: box.querySelector('#mf-o-aloop').value, src: (o.anim && o.anim.src) || undefined } : undefined; world.setAnim(o.id, o.anim); box.querySelector('#mf-o-aspeed-v').textContent = (+box.querySelector('#mf-o-aspeed').value).toFixed(2) + '×'; };
      animSel.onchange = () => commit(applyAnim);
      box.querySelector('#mf-o-aloop').onchange = () => commit(applyAnim);
      const sp = box.querySelector('#mf-o-aspeed'); sp.oninput = () => { applyAnim(); setDirty(true); }; sp.onpointerdown = () => beginObjectEdit(); sp.onchange = () => endObjectEdit();
    }
    box.querySelector('#mf-o-drop').onclick = () => commit(() => { o.p[1] = world.heightAt(o.p[0], o.p[2]); });
    const auv = box.querySelector('#mf-o-auv');
    if (auv) {
      const aur = box.querySelector('#mf-o-aur'), aul = box.querySelector('#mf-o-aul');
      const applyAu = () => { o.au = Object.assign(o.au || { url: '' }, { vol: +auv.value, r: +aur.value, loop: aul.checked }); box.querySelector('#mf-o-auv-v').textContent = Math.round(+auv.value * 100) + '%'; box.querySelector('#mf-o-aur-v').textContent = aur.value + ' m'; world.refreshObject(o); setDirty(true); };
      [auv, aur].forEach(el => { el.onpointerdown = () => beginObjectEdit(); el.oninput = applyAu; el.onchange = () => endObjectEdit(); });
      aul.onchange = () => { beginObjectEdit(); applyAu(); endObjectEdit(); };
    }
    const actSel = box.querySelector('#mf-o-act');
    if (actSel) {
      const applyAct = () => {
        const kind = actSel.value; const cur = o.act || {};
        const raw = kind === 'none' ? null : { kind, prompt: (box.querySelector('#mf-o-act-prompt') || {}).value || cur.prompt || '', target: (box.querySelector('#mf-o-act-target') || {}).value || cur.target || '', hub: (box.querySelector('#mf-o-act-hub') || {}).value || cur.hub || 'main', guide: (box.querySelector('#mf-o-act-guide') || {}).value || cur.guide || '', auto: box.querySelector('#mf-o-act-auto') ? box.querySelector('#mf-o-act-auto').checked : cur.auto !== false };
        o.act = normalizeAct(raw);
      };
      const onAct = () => { beginObjectEdit(); applyAct(); endObjectEdit(); setDirty(true); renderInspector(); };
      actSel.onchange = onAct;
      ['#mf-o-act-target', '#mf-o-act-hub', '#mf-o-act-guide', '#mf-o-act-prompt', '#mf-o-act-auto'].forEach(id => { const el = box.querySelector(id); if (el) el.onchange = onAct; });
    }
    const fxi = box.querySelector('#mf-o-fxi');
    if (fxi) {
      const fxs = box.querySelector('#mf-o-fxs'), fxon = box.querySelector('#mf-o-fxon'), fxc = box.querySelector('#mf-o-fxc');
      const applyFx = () => { o.fx = { i: +fxi.value, s: +fxs.value }; if (fxon && !fxon.checked) o.fx.off = true; box.querySelector('#mf-o-fxi-v').textContent = (+fxi.value).toFixed(1) + '×'; box.querySelector('#mf-o-fxs-v').textContent = (+fxs.value).toFixed(1) + '×'; world.refreshFx(o.id); setDirty(true); };
      [fxi, fxs].forEach(el => { el.onpointerdown = () => beginObjectEdit(); el.oninput = applyFx; el.onchange = () => endObjectEdit(); });
      if (fxon) fxon.onchange = () => { beginObjectEdit(); applyFx(); endObjectEdit(); };
      if (fxc) { fxc.onpointerdown = () => beginObjectEdit(); fxc.oninput = () => { o.c = fxc.value; world.refreshFx(o.id); setDirty(true); }; fxc.onchange = () => endObjectEdit(); box.querySelector('#mf-o-fxuntint').onclick = () => commit(() => { delete o.c; world.refreshFx(o.id); }); }
    }
    const colOn = box.querySelector('#mf-o-col-on'), colOff = box.querySelector('#mf-o-col-off'), cs = box.querySelector('#mf-o-cs');
    if (colOn) colOn.onclick = () => { beginObjectEdit(); world.setCollision(o.id, true); endObjectEdit(); setDirty(true); renderInspector(); toast('Collision added — it now blocks the player in Play.'); };
    if (colOff) colOff.onclick = () => { beginObjectEdit(); world.setCollision(o.id, false); endObjectEdit(); setDirty(true); renderInspector(); toast('Collision removed — the player walks through it.'); };
    cs.onchange = () => { beginObjectEdit(); world.setCollision(o.id, null, cs.value); endObjectEdit(); setDirty(true); };
    box.querySelector('#mf-o-dup').onclick = duplicateSelected;
    box.querySelector('#mf-o-focus').onclick = focusSelected;
    box.querySelector('#mf-o-del').onclick = () => { beginObjectEdit(); removeObject(o.id); endObjectEdit(); };
  }
  function renderStats() {
    const m = S.map; if (!m) return;
    if (tabOn('scene')) renderSceneTab();
    $('#mf-hud-stats').innerHTML = '<b>' + m.objects.length + '</b> objects · <b>' + m.terrain.n + '×' + m.terrain.n + '</b> · ' + (m.terrain.n * m.terrain.cell) + 'm';
  }
  function renderTerrainTab() {
    const t = S.map.terrain; $('#mf-t-n').value = t.n; $('#mf-t-cell').value = t.cell;
    $('#mf-t-size').textContent = (t.n * t.cell) + ' m × ' + (t.n * t.cell) + ' m';
    $('#mf-t-grid').checked = S.showGrid; $('#mf-t-markers').checked = S.showMarkers;
  }
  function renderWaterTab() {
    const w = S.map.water; $('#mf-w-on').checked = w.on; $('#mf-w-level').value = w.level; $('#mf-w-level-v').textContent = w.level.toFixed(1) + 'm';
    $('#mf-w-color').value = w.color; $('#mf-w-opacity').value = w.opacity; $('#mf-w-opacity-v').textContent = Math.round(w.opacity * 100) + '%';
    $('#mf-w-wave').value = w.wave; $('#mf-w-wave-v').textContent = w.wave.toFixed(2); $('#mf-w-speed').value = w.speed; $('#mf-w-speed-v').textContent = w.speed.toFixed(1) + '×';
  }
  function renderSkyTab() {
    const e = S.map.env; $('#mf-e-preset').value = e.preset;
    ['skyTop', 'skyBottom', 'fogColor', 'sunColor', 'ambient', 'groundColor'].forEach(k => { $('#mf-e-' + k).value = e[k]; });
    [['fogNear', 0], ['fogFar', 0], ['sunEl', 0], ['sunAz', 0], ['sunIntensity', 2], ['ambientIntensity', 2], ['weatherIntensity', 1], ['windDir', 0], ['windSpeed', 1]].forEach(([k, d]) => { $('#mf-e-' + k).value = e[k]; $('#mf-e-' + k + '-v').textContent = (+e[k]).toFixed(d) + (k === 'windDir' ? '°' : k === 'windSpeed' ? ' m/s' : k === 'weatherIntensity' ? '×' : ''); });
    $('#mf-e-weather').value = e.weather || 'none';
    $('#mf-e-shadows').checked = e.shadows !== false;
  }
  async function renderMapsTab() {
    const list = $('#mf-maps'); list.innerHTML = '<div class="mf-empty">Loading…</div>';
    const r = await api.listMaps();
    if (!ED) return;
    $('#mf-storage').textContent = r.cloudOk ? '☁ Cloud maps on · signed in as ' + displayName() : r.offline ? '💾 Not signed in — maps save on this device only' : r.cloudMissing ? '💾 Cloud table not set up yet (run sql/091_world_maps.sql) — saving on this device' : '⚠ Cloud unavailable: ' + (r.error || '') + ' — saving on this device';
    if (!r.rows.length) { list.innerHTML = '<div class="mf-empty">No saved maps yet. Build something and press Save.</div>'; return; }
    const games = Array.from(new Set(r.rows.map(x => x.game || 'sandbox').concat([S.map.game || 'sandbox']))).sort();
    setGameField(S.map.game || 'sandbox', games);
    const onlyMine = $('#mf-maps-game').checked, curGame = S.map.game || 'sandbox';
    const rows = onlyMine ? r.rows.filter(x => (x.game || 'sandbox') === curGame) : r.rows;
    const byGame = {}; rows.forEach(x => { (byGame[x.game || 'sandbox'] = byGame[x.game || 'sandbox'] || []).push(x); });
    list.innerHTML = Object.keys(byGame).sort().map(g => '<div class="mf-gamehead">🎮 ' + esc(g) + '</div>' + byGame[g].map(row => `
      <div class="mf-map ${row.id === S.map.id ? 'cur' : ''}" data-id="${esc(row.id)}" data-src="${row.source}">
        <div class="t"><span>${row.source === 'cloud' ? '☁' : '💾'}</span><span>${esc(row.name)}</span>${row.live ? '<span class="tag live" title="The world this mini-game loads">LIVE</span>' : ''}${row.is_public && !row.live ? '<span class="tag pub">public</span>' : ''}${!row.mine ? '<span class="tag">by ' + esc(row.owner_name || 'someone') + '</span>' : '<span class="tag ' + (row.source === 'cloud' ? 'cloud' : '') + '">' + row.source + '</span>'}</div>
        <div class="m">${esc(row.description || '')}${row.description ? ' · ' : ''}${row.updated_at ? new Date(row.updated_at).toLocaleString() : ''}</div>
        <div class="acts"><button data-act="open">Open</button>${row.mine ? (row.live ? '<button data-act="unlive">Unset live</button>' : '<button data-act="live" title="Make this the world ' + esc(row.game || 'sandbox') + ' loads">★ Set live</button>') + (row.source === 'local' && r.cloudOk ? '<button data-act="upload">☁ Upload</button>' : '') + (row.source === 'cloud' && !row.live ? '<button data-act="pub">' + (row.is_public ? 'Make private' : 'Make public') + '</button>' : '') + '<button data-act="del" class="danger">Delete</button>' : ''}</div>
      </div>`).join('')).join('');
    list.querySelectorAll('.mf-map').forEach(el => {
      const id = el.dataset.id, src = el.dataset.src;
      el.querySelector('[data-act="open"]').onclick = () => openMap(id, src);
      const del = el.querySelector('[data-act="del"]'); if (del) del.onclick = async () => { if (!(await askConfirm('Delete this map permanently?'))) return; const d = await api.deleteMap(id, src); toast(d.ok ? 'Deleted.' : 'Delete failed: ' + d.error); if (d.ok && id === S.map.id) { S.source = null; setDirty(true); } renderMapsTab(); };
      const up = el.querySelector('[data-act="upload"]'); if (up) up.onclick = async () => { const m = api.localLoad(id); if (!m) return; const s = await api.cloudSave(m, false); if (s.ok) { api.localDelete(id); if (id === S.map.id) { S.source = 'cloud'; setDirty(S.dirty); } toast('☁ Uploaded.'); } else toast('Upload failed: ' + (s.error || 'unknown'), 4000); renderMapsTab(); };
      const lv = el.querySelector('[data-act="live"], [data-act="unlive"]'); if (lv) lv.onclick = async () => { const on = lv.dataset.act === 'live'; const s = await api.setLive(id, src, on); try { refreshLive(); } catch (_) {} toast(s.ok ? (on ? '★ Live — mini-game "' + (r.rows.find(x => x.id === id) || {}).game + '" now loads this world.' : 'No longer live.') : 'Failed: ' + (s.error || 'unknown'), 3600); renderMapsTab(); };
      const pub = el.querySelector('[data-act="pub"]'); if (pub) pub.onclick = async () => { const row = r.rows.find(x => x.id === id); const s = await api.cloudSetPublic(id, !row.is_public); if (s.ok) { if (id === S.map.id) S.isPublic = !row.is_public; toast(row.is_public ? 'Map is now private.' : 'Map is public — other players can open it.'); } else toast('Failed: ' + s.error); renderMapsTab(); };
    });
  }
  function toggleGrid(on) {
    S.showGrid = on;
    if (gridHelper) { scene.remove(gridHelper); gridHelper = null; }
    if (on) { const s = world.terrain.size; gridHelper = new THREE.GridHelper(s, Math.round(s / world.terrain.cell), 0xd4af37, 0x30343f); gridHelper.material.transparent = true; gridHelper.material.opacity = 0.35; gridHelper.position.y = 0.05; scene.add(gridHelper); }
  }

  /* ═══ WIRING ═══ */
  $$('.mf-tools button[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $$('button[data-sculpt]').forEach(b => b.onclick = () => { setSculptMode(b.dataset.sculpt); if (S.tool !== 'sculpt') setTool('sculpt'); });
  $('#mf-radius').oninput = e => { S.brush.radius = +e.target.value; renderBrush(); };
  $('#mf-strength').oninput = e => { S.brush.strength = +e.target.value; renderBrush(); };
  $('#mf-falloff').oninput = e => { S.brush.falloff = +e.target.value; renderBrush(); };
  $('#mf-tint-on').onchange = e => { S.propTint = e.target.checked ? $('#mf-tint').value : null; refreshGhost(); };
  $('#mf-tint').oninput = e => { if ($('#mf-tint-on').checked) { S.propTint = e.target.value; refreshGhost(); } };
  $('#mf-sc-count').oninput = e => { S.scatter.count = Math.max(1, Math.min(40, +e.target.value | 0)); $('#mf-sc-count-v').textContent = S.scatter.count; };
  $('#mf-sc-scale').oninput = e => { S.scatter.jitterScale = +e.target.value; $('#mf-sc-scale-v').textContent = Math.round(S.scatter.jitterScale * 100) + '%'; };
  $('#mf-sc-rot').onchange = e => { S.scatter.jitterRot = e.target.checked; };
  $('#mf-sc-water').onchange = e => { S.scatter.avoidWater = e.target.checked; };
  $('#mf-asset-add').onclick = () => { addAsset($('#mf-asset-url').value, $('#mf-asset-label').value); $('#mf-asset-url').value = ''; $('#mf-asset-label').value = ''; };
  $('#mf-asset-url').onkeydown = e => { if (e.key === 'Enter') $('#mf-asset-add').click(); };

  $$('.mf-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  function showTab(t) { $$('.mf-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('.mf-tab').forEach(p => p.classList.toggle('on', p.dataset.tab === t)); if (t === 'maps') renderMapsTab(); if (t === 'scene') renderSceneTab(); if (t === 'files') renderFilesTab(); if (t === 'menu') { renderPlayerTab(); renderMenuTab(); } }
  // a function declaration: select() runs during loadDoc, before this line executes
  function tabOn(t) { const p = $('.mf-tab[data-tab="' + t + '"]'); return !!(p && p.classList.contains('on')); }

  /* ═══ SCENE — everything that is in the map ═══
     Asked for: "a section where it shows everything that is in the map, like
     assets." Grouped by category; click a row to select and focus it. */
  function renderSceneTab() {
    const box = $('#mf-scene'); if (!box) return;
    const m = S.map, objs = m.objects;
    const groups = {}; const catOf = (o) => o.t === 'glb' ? 'Models' : o.t.startsWith('fx_') ? 'VFX' : ((PROP_BY_ID[o.t] || {}).cat || 'Other');
    objs.forEach(o => { (groups[catOf(o)] = groups[catOf(o)] || []).push(o); });
    const label = (o) => o.n || (o.t === 'glb' ? ((m.assets.find(a => a.id === o.a) || {}).label || 'Model') : ((PROP_BY_ID[o.t] || {}).label || (EMITTERS[o.t.slice(3)] || {}).label || o.t));
    const icon = (o) => o.t === 'glb' ? '🧊' : o.t.startsWith('fx_') ? ((EMITTERS[o.t.slice(3)] || {}).icon || '✨') : ((PROP_BY_ID[o.t] || {}).icon || '🧩');
    const flags = (o) => (o.act ? '<span class="tag" title="Interaction">⚡ ' + esc(o.act.kind) + '</span>' : '') + (o.au ? '<span class="tag">🔊</span>' : '') + (o.anim && o.anim.clip ? '<span class="tag">🎞 ' + esc(o.anim.clip) + '</span>' : '') + (world.isSolid(o) ? '' : '<span class="tag" title="No collision">○</span>');
    const size = m.terrain.n * m.terrain.cell;
    const menu = m.menu || normalizeMenu(null);
    box.innerHTML = '<div class="mf-scn-sum">' +
      '<div><b>' + esc(m.name) + '</b> <span class="mf-hint" style="display:inline">· ' + esc(m.game || 'sandbox') + (menu.on ? ' · 🌍 menu button on ' + esc(menu.hub) : '') + '</span></div>' +
      '<div class="mf-scn-grid"><span>Terrain</span><span>' + m.terrain.n + '×' + m.terrain.n + ' · ' + size + ' m</span>' +
      '<span>Water</span><span>' + (m.water.on ? 'on · level ' + m.water.level.toFixed(1) + ' m' : 'off') + '</span>' +
      '<span>Sky</span><span>' + esc(m.env.preset) + (m.env.weather && m.env.weather !== 'none' ? ' · ' + esc(m.env.weather) : '') + '</span>' +
      '<span>Models</span><span>' + m.assets.length + ' file' + (m.assets.length === 1 ? '' : 's') + (embeddedBytes(m) ? ' · ' + (embeddedBytes(m) / 1048576).toFixed(2) + ' MB embedded' : '') + '</span>' +
      '<span>Objects</span><span>' + objs.length + '</span></div></div>' +
      (m.assets.length ? '<div class="mf-scn-head">🧊 Model files <span class="n">' + m.assets.length + '</span></div><div class="mf-scn-list">' + m.assets.map(a => '<div class="mf-scn-row" data-asset="' + esc(a.id) + '" title="' + esc(a.url || 'embedded') + '"><span class="ic">' + (a.data ? '📦' : '🧊') + '</span><span class="lb">' + esc(a.label) + '</span><span class="tag">' + objs.filter(o => o.t === 'glb' && o.a === a.id).length + ' placed</span>' + (a.anims && a.anims.length ? '<span class="tag">🎞 ' + a.anims.length + '</span>' : '') + '</div>').join('') + '</div>' : '') +
      (objs.length ? Object.keys(groups).sort().map(c => '<div class="mf-scn-head">' + esc(c) + ' <span class="n">' + groups[c].length + '</span></div><div class="mf-scn-list">' + groups[c].map(o => '<div class="mf-scn-row ' + (o.id === S.selectedId ? 'on' : '') + '" data-obj="' + esc(o.id) + '"><span class="ic">' + icon(o) + '</span><span class="lb">' + esc(label(o)) + '</span>' + flags(o) + '<span class="pos">' + Math.round(o.p[0]) + ', ' + Math.round(o.p[2]) + '</span></div>').join('') + '</div>').join('') : '<div class="mf-empty" style="padding:10px 12px">Nothing placed yet. Pick something in the Library and click the ground.</div>');
    box.querySelectorAll('[data-obj]').forEach(el => { el.onclick = () => { select(el.dataset.obj); focusSelected(); renderSceneTab(); showTab('scene'); }; });
    box.querySelectorAll('[data-asset]').forEach(el => { el.onclick = () => { S.propId = 'glb'; S.assetId = el.dataset.asset; libCat = 'Models'; renderLibrary(); refreshGhost(); renderHud(); if (S.tool === 'select' || S.tool === 'erase') setTool('place'); toast('Click the ground to place another.'); }; });
  }

  /* ═══ FILES — everything uploaded to the engine ═══
     Asked for: "the second where all of the files that were uploaded to the
     engine; allow me to upload GLB, audio, animations and VFX files."
     Rows come from world_assets (sql/112) through mapforge.assets.js. Using a
     file: a model joins the Library; an animation applies to the selected
     model; audio arms the 🔊 marker; a VFX preset arms its emitter. */
  let filesCache = null, filesFilter = 'all';
  async function renderFilesTab(force) {
    const box = $('#mf-files'); if (!box) return;
    if (!filesCache || force) {
      box.innerHTML = '<div class="mf-empty" style="padding:10px 12px">Loading…</div>';
      const r = await assetsApi.list(); if (!ED) return;
      filesCache = r;
    }
    const r = filesCache;
    const note = $('#mf-files-note');
    if (note) note.textContent = r.offline ? 'Sign in to upload and see uploaded files.' : r.missing ? 'The files table is not set up yet — run sql/112_world_assets.sql, then reopen.' : r.ok ? (r.rows.length + ' file' + (r.rows.length === 1 ? '' : 's') + ' · up to 60 MB each · stored in the models bucket') : ('Could not list files: ' + (r.error || 'unknown error'));
    const rows = (r.rows || []).filter(x => filesFilter === 'all' || x.kind === filesFilter);
    $$('#mf-files-kinds button').forEach(b => b.classList.toggle('on', b.dataset.kind === filesFilter));
    const sel = objById(S.selectedId);
    box.innerHTML = rows.length ? rows.map(a => {
      const inMap = a.kind === 'model' && S.map.assets.some(x => x.url === a.url);
      const act = a.kind === 'model' ? (inMap ? 'Place' : '＋ Library') : a.kind === 'anim' ? (sel && sel.t === 'glb' ? '▶ Apply' : 'Pick model') : a.kind === 'audio' ? '🔊 Arm' : '✨ Arm';
      const extra = a.kind === 'anim' ? '<button data-act="player" title="Add this file\'s clips to the player character">🧍 For player</button>' : '';
      const armed = (a.kind === 'audio' && S.audioUrl === a.url) || (a.kind === 'vfx' && S.fxPreset && S.fxPreset.url === a.url) || (a.kind === 'model' && S.propId === 'glb' && S.assetId && (S.map.assets.find(x => x.id === S.assetId) || {}).url === a.url);
      return '<div class="mf-file ' + (armed ? 'on' : '') + '" data-id="' + esc(a.id) + '"><span class="ic" title="' + esc(assetsApi.KIND_LABEL[a.kind] || a.kind) + '">' + (assetsApi.KIND_ICON[a.kind] || '📄') + '</span><div class="body"><div class="lb" title="' + esc(a.url) + '">' + esc(a.name) + '</div><div class="m">' + esc(assetsApi.KIND_LABEL[a.kind] || a.kind) + ' · ' + (a.bytes / 1024 >= 1024 ? (a.bytes / 1048576).toFixed(1) + ' MB' : (a.bytes / 1024).toFixed(0) + ' KB') + (a.meta && a.meta.clips && a.meta.clips.length ? ' · 🎞 ' + a.meta.clips.length : '') + (a.meta && a.meta.preset ? ' · ' + esc(a.meta.preset) : '') + (a.owner_name && !a.mine ? ' · by ' + esc(a.owner_name) : '') + '</div></div><button data-act="use" class="' + (armed ? '' : 'primary') + '">' + act + '</button>' + extra + (a.mine ? '<button data-act="del" class="danger" title="Delete this file for everyone">✕</button>' : '') + '</div>';
    }).join('') : '<div class="mf-empty" style="padding:10px 12px">' + (r.ok ? 'No files uploaded yet. Use <b>⤒ Upload</b> above — .glb models and animations, .mp3 / .wav / .ogg audio, .json VFX presets.' : '') + '</div>';
    box.querySelectorAll('.mf-file').forEach(el => {
      const a = (r.rows || []).find(x => x.id === el.dataset.id); if (!a) return;
      el.querySelector('[data-act="use"]').onclick = () => useFile(a);
      const pb = el.querySelector('[data-act="player"]'); if (pb) pb.onclick = () => addPlayerAnimFile(a.url, a.name);
      const del = el.querySelector('[data-act="del"]'); if (del) del.onclick = async () => { if (!(await askConfirm('Delete ' + a.name + ' for everyone? Maps that use it will lose it.'))) return; const d = await assetsApi.remove(a); toast(d.ok ? 'Deleted.' : 'Delete failed: ' + d.error, 3200); if (d.ok) { filesCache = null; renderFilesTab(); } };
    });
  }
  async function useFile(a) {
    if (a.kind === 'model') {
      const have = S.map.assets.find(x => x.url === a.url);
      if (have) { S.propId = 'glb'; S.assetId = have.id; }
      else { await addAsset(a.url, a.name, { anims: a.meta && a.meta.clips }); }
      libCat = 'Models'; renderLibrary(); refreshGhost(); renderHud(); if (S.tool === 'select' || S.tool === 'erase') setTool('place');
      toast('Click the ground to place ' + a.name + '.', 2600); renderFilesTab();
    } else if (a.kind === 'anim') {
      const o = objById(S.selectedId);
      if (!o || o.t !== 'glb') { toast('Select a placed model first, then apply the animation to it.', 3600); return; }
      toast('Loading clips from ' + a.name + '…', 2000);
      try {
        const clips = await world.loadExtClips(a.url); if (!ED) return;
        if (!clips.length) { toast(a.name + ' has no animation clips.', 3200); return; }
        const root = world.objects.get(o.id); if (root) { const have = new Set((root.userData.mfClips || []).map(c => c.name)); root.userData.mfClips = (root.userData.mfClips || []).concat(clips.filter(c => !have.has(c.name))); }
        beginObjectEdit(); o.anim = { clip: clips[0].name, speed: 1, loop: 'repeat', src: a.url }; const okp = world.setAnim(o.id, o.anim); endObjectEdit(); setDirty(true); renderInspector();
        toast(okp ? '▶ ' + clips[0].name + ' on ' + (o.n || 'the model') + (clips.length > 1 ? ' — ' + clips.length + ' clips in the inspector' : '') : 'The clip does not fit this model\'s skeleton (bone names differ).', 4000);
      } catch (e) { toast('Could not load ' + a.name + ': ' + ((e && e.message) || e), 4000); }
    } else if (a.kind === 'audio') {
      S.audioUrl = a.url; S.audioName = a.name; S.propId = 'audio'; libCat = 'Markers'; renderLibrary(); refreshGhost(); renderHud(); if (S.tool === 'select' || S.tool === 'erase') setTool('place');
      const o = objById(S.selectedId);
      if (o && o.t === 'audio') { beginObjectEdit(); o.au = Object.assign(o.au || { vol: 1, r: 20, loop: true }, { url: a.url }); o.n = a.name.slice(0, 60); world.refreshObject(o); endObjectEdit(); setDirty(true); renderInspector(); toast('🔊 ' + a.name + ' now plays from the selected marker.', 3000); }
      else toast('🔊 armed — click the ground to place a sound marker for ' + a.name + '.', 3600);
      renderFilesTab();
    } else if (a.kind === 'vfx') {
      try {
        const res = await fetch(a.url, { cache: 'no-cache' }); const p = await res.json(); if (!ED) return;
        const kind = p && EMITTERS[p.kind] ? p.kind : null;
        if (!kind) { toast('Preset kind "' + (p && p.kind) + '" is not an emitter. Kinds: ' + Object.keys(EMITTERS).join(', '), 5000); return; }
        S.fxPreset = { kind, url: a.url, c: (typeof p.tint === 'string' && /^#[0-9a-f]{6}$/i.test(p.tint)) ? p.tint.toLowerCase() : null, fx: { i: Math.max(0.1, Math.min(4, +p.i || 1)), s: Math.max(0.2, Math.min(6, +p.s || 1)) }, label: String(p.label || a.name) };
        S.propId = 'fx_' + kind; libCat = 'VFX'; renderLibrary(); refreshGhost(); renderHud(); if (S.tool === 'select' || S.tool === 'erase') setTool('place');
        toast('✨ ' + S.fxPreset.label + ' armed — click the ground to place it.', 3200); renderFilesTab();
      } catch (e) { toast('Could not read the preset: ' + ((e && e.message) || e), 4000); }
    }
  }
  /* what a GLB holds, without loading it twice: clip names and mesh count */
  async function inspectFile(file) {
    if (!/\.gl(b|tf)$/i.test(file.name) || !THREE.GLTFLoader) return {};
    try {
      const buf = await file.arrayBuffer();
      const g = await new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', res, rej));
      let meshes = 0; const scene = g.scene || (g.scenes && g.scenes[0]); if (scene) scene.traverse(o => { if (o.isMesh) meshes++; });
      return { clips: (g.animations || []).filter(a => a && a.duration > 0).map(a => a.name || 'clip').slice(0, 64), meshes };
    } catch (e) { return {}; }
  }
  async function uploadFiles(files) {
    const kind = $('#mf-up-kind').value || '';
    for (const f of files) {
      toast('Uploading ' + f.name + '…', 60000);
      const r = await assetsApi.upload(f, { inspect: inspectFile, kind: kind || undefined }); if (!ED) return;
      if (!r.ok) { toast(r.missing ? 'The files table is not set up yet — run sql/112_world_assets.sql.' : 'Upload failed: ' + (r.error || 'unknown error'), 5200); continue; }
      toast('⤒ ' + r.row.name + ' uploaded as ' + (assetsApi.KIND_LABEL[r.row.kind] || r.row.kind) + '.', 3200);
      filesCache = null;
    }
    renderFilesTab();
  }

  /* ═══ PLAYER & CAMERA — how the map is played ═══
     Asked for: "a setting to change the game mode — top-down, over the
     shoulder third person like Resident Evil, or first person — the character
     model the players use, and idle / interact / walk / run animations." */
  const extClipNames = new Map();   // animation file url → clip names (loaded once)
  async function extClips(url) {
    if (extClipNames.has(url)) return extClipNames.get(url);
    try { const c = await world.loadExtClips(url); const names = c.map(x => x.name); extClipNames.set(url, names); return names; } catch (e) { extClipNames.set(url, []); return []; }
  }
  function renderPlayerTab() {
    const box = $('#mf-player'); if (!box) return;
    const pl = S.map.player = normalizePlayer(S.map.player);
    const models = S.map.assets;
    const cur = pl.model && models.find(a => a.id === pl.model.a);
    const own = cur ? (cur.anims || []) : [];
    const opt = (list, v, lab) => list.map(x => '<option value="' + esc(x) + '"' + (x === v ? ' selected' : '') + '>' + esc(lab ? lab(x) : x) + '</option>').join('');
    const animRow = (k, label, hint) => {
      const a = pl.anim[k] || {};
      const val = a.clip ? (a.src ? a.src + '|' + a.clip : 'own|' + a.clip) : '';
      return '<div class="mf-row"><label>' + label + '</label><select data-pa="' + k + '"><option value="">— none —</option>' +
        (own.length ? '<optgroup label="' + esc(cur.label) + '">' + own.map(c => '<option value="own|' + esc(c) + '"' + ('own|' + c === val ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</optgroup>' : '') +
        pl.animFiles.map(f => { const names = extClipNames.get(f.url); return names && names.length ? '<optgroup label="🎞 ' + esc(f.name) + '">' + names.map(c => '<option value="' + esc(f.url) + '|' + esc(c) + '"' + (f.url + '|' + c === val ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</optgroup>' : ''; }).join('') +
        '</select><span class="v" title="' + esc(hint) + '">' + (a.clip ? '' : '·') + '</span></div>';
    };
    box.innerHTML =
      '<div class="mf-row"><label>View</label><select id="mf-pl-view">' + opt(Object.keys(VIEWS), pl.view, v => VIEWS[v]) + '</select></div>' +
      '<p class="mf-hint" style="margin:0 0 8px">' + (pl.view === 'fps' ? 'First person: the character is not drawn; the camera is the eyes.' : pl.view === 'tps' ? 'Over the shoulder: the camera rides behind and to the right of the character, mouse to look.' : 'Top-down: the camera hangs above; WASD walks on the map\'s axes and the character turns to face where it goes.') + '</p>' +
      '<div class="mf-row"><label>Character</label><select id="mf-pl-model"><option value="">— none (invisible) —</option>' + models.map(a => '<option value="' + esc(a.id) + '"' + (cur && cur.id === a.id ? ' selected' : '') + '>' + esc(a.label) + (a.anims && a.anims.length ? ' · 🎞 ' + a.anims.length : '') + '</option>').join('') + '</select></div>' +
      (cur ? '<div class="mf-row"><label>Scale</label><input type="number" id="mf-pl-scale" step="0.05" min="0.01" max="50" value="' + (pl.model.scale) + '"><label style="flex:0 0 auto">Faces</label><select id="mf-pl-faces" style="flex:0 0 90px"><option value="-z"' + (pl.model.faces !== 'z' ? ' selected' : '') + '>−Z (three.js)</option><option value="z"' + (pl.model.faces === 'z' ? ' selected' : '') + '>+Z</option></select></div>' : '<p class="mf-hint">Add a model in the Library (or from Files) and pick it here. A character is needed for third person and top-down.</p>') +
      (cur ? '<div class="mf-sub">Animations</div>' + animRow('idle', 'Idle', 'standing still') + animRow('walk', 'Walk', 'moving') + animRow('run', 'Run', 'moving with Shift (walk at 1.6× if empty)') + animRow('interact', 'Interact', 'pressing E') +
        '<div class="mf-btns" style="margin-top:6px"><button id="mf-pl-upanim">⤒ Upload animation file</button><button id="mf-pl-pickanim" title="Choose an uploaded animation in the Files tab">🎞 From Files</button><input type="file" id="mf-pl-animfile" accept=".glb,.gltf" hidden></div>' +
        (pl.animFiles.length ? '<p class="mf-hint">Animation files: ' + pl.animFiles.map(f => esc(f.name)).join(', ') + '</p>' : '<p class="mf-hint">Clips from a separate animation file need the same bone names as the character.</p>') : '') +
      /* 🧍 THE CAST — what a PLAYER may choose to be in this map.
          The row above sets the character the author gets and the one everybody
          falls back to; this is the list they can pick from instead. Empty is
          the normal case and means "everyone is the default character", which
          is exactly how every map behaved before this existed. */
      '<div class="mf-sub">Characters players can pick</div>' +
      (pl.cast.length
        ? '<div class="mf-cast">' + pl.cast.map((c, i) => {
            const a = models.find(x => x.id === c.a);
            return '<div class="mf-row mf-cast-row"><label>' + esc(a ? a.label : '⚠ missing asset') + '</label>' +
              '<input type="text" data-cast-label="' + i + '" placeholder="Name players see" maxlength="40" value="' + esc(c.label || '') + '">' +
              '<input type="number" data-cast-scale="' + i + '" step="0.05" min="0.01" max="50" style="flex:0 0 72px" value="' + c.scale + '">' +
              '<select data-cast-faces="' + i + '" style="flex:0 0 78px"><option value="-z"' + (c.faces !== 'z' ? ' selected' : '') + '>−Z</option><option value="z"' + (c.faces === 'z' ? ' selected' : '') + '>+Z</option></select>' +
              '<button data-cast-del="' + i + '" title="Remove from the roster">✕</button></div>';
          }).join('') + '</div>'
        : '<p class="mf-hint">No roster — everyone who enters is the character above. Add one or more here and players get a 🧍 Character button in the hub.</p>') +
      (pl.cast.length < PLAYER_CAST_MAX
        ? '<div class="mf-row"><label>Add</label><select id="mf-cast-add"><option value="">— choose a model —</option>' +
          models.filter(a => !pl.cast.some(c => c.a === a.id)).map(a => '<option value="' + esc(a.id) + '">' + esc(a.label) + '</option>').join('') + '</select></div>'
        : '<p class="mf-hint">That is the maximum of ' + PLAYER_CAST_MAX + ' — a picker past a dozen is a wardrobe, and every entry is a model each visitor may have to download.</p>') +
      '<p class="mf-hint">A player\u2019s choice is remembered on their account and used in every hub that offers it. Animations above apply to whichever character they wear, so the clips need the same bone names.</p>' +
      '<p class="mf-hint">Press <b>▶ Play</b> to test exactly what players get.</p>';
    const commit = () => { S.map.player = normalizePlayer(pl); setDirty(true); renderPlayerTab(); };
    $('#mf-pl-view').onchange = (e) => { pl.view = e.target.value; commit(); };
    $('#mf-pl-model').onchange = (e) => { pl.model = e.target.value ? { a: e.target.value, scale: 1, faces: '-z' } : null; pl.anim = {}; commit(); };
    const sc = $('#mf-pl-scale'); if (sc) sc.onchange = () => { pl.model.scale = +sc.value || 1; commit(); };
    /* 🧍 the roster's own handlers */
    const add = $('#mf-cast-add');
    if (add) add.onchange = () => { if (!add.value) return; pl.cast = (pl.cast || []).concat([{ a: add.value, label: '', scale: 1, faces: '-z' }]); commit(); };
    box.querySelectorAll('[data-cast-del]').forEach(b => { b.onclick = () => { pl.cast.splice(+b.dataset.castDel, 1); commit(); }; });
    box.querySelectorAll('[data-cast-label]').forEach(i => { i.onchange = () => { pl.cast[+i.dataset.castLabel].label = i.value; commit(); }; });
    box.querySelectorAll('[data-cast-scale]').forEach(i => { i.onchange = () => { pl.cast[+i.dataset.castScale].scale = +i.value || 1; commit(); }; });
    box.querySelectorAll('[data-cast-faces]').forEach(sel => { sel.onchange = () => { pl.cast[+sel.dataset.castFaces].faces = sel.value; commit(); }; });
    const fc = $('#mf-pl-faces'); if (fc) fc.onchange = () => { pl.model.faces = fc.value; commit(); };
    box.querySelectorAll('[data-pa]').forEach(sel => { sel.onchange = () => { const v = sel.value; if (!v) { delete pl.anim[sel.dataset.pa]; } else { const i = v.indexOf('|'); const src = v.slice(0, i), clip = v.slice(i + 1); pl.anim[sel.dataset.pa] = src === 'own' ? { clip } : { clip, src }; } commit(); }; });
    const up = $('#mf-pl-upanim'), pick = $('#mf-pl-pickanim'), fi = $('#mf-pl-animfile');
    if (up) up.onclick = () => fi.click();
    if (fi) fi.onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) { const r = await assetsApi.upload(f, { inspect: inspectFile, kind: 'anim' }); if (!ED) return; if (!r.ok) { toast(r.missing ? 'The files table is not set up yet — run sql/112_world_assets.sql.' : 'Upload failed: ' + (r.error || 'unknown error'), 5200); return; } filesCache = null; addPlayerAnimFile(r.row.url, r.row.name); } };
    if (pick) pick.onclick = () => { filesFilter = 'anim'; showTab('files'); toast('Pick an animation file — "For player" adds it to the character.', 3600); };
    // clip names for the animation files may still be loading: render again when they land
    pl.animFiles.forEach(f => { if (!extClipNames.has(f.url)) extClips(f.url).then(() => { if (ED && tabOn('menu')) renderPlayerTab(); }); });
  }
  async function addPlayerAnimFile(url, name) {
    const pl = S.map.player = normalizePlayer(S.map.player);
    if (!pl.animFiles.some(f => f.url === url)) pl.animFiles.push({ url, name: String(name || 'animation').slice(0, 80) });
    const names = await extClips(url); if (!ED) return;
    S.map.player = normalizePlayer(pl); setDirty(true);
    toast(names.length ? '🎞 ' + names.length + ' clip' + (names.length > 1 ? 's' : '') + ' from ' + name + ' — assign them under Player & camera.' : name + ' has no animation clips.', 4200);
    showTab('menu');
  }

  /* ═══ MENU — the map as a button on a game menu ═══ */
  function renderMenuTab() {
    const box = $('#mf-menu'); if (!box) return;
    const mn = S.map.menu = normalizeMenu(S.map.menu);
    const hubs = bridgeHubs(), gl = bridgeGuides(), games = miniGames();
    const opt = (list, cur, idk, namek) => list.map(x => '<option value="' + esc(x[idk]) + '"' + (x[idk] === cur ? ' selected' : '') + '>' + esc(x[namek] || x[idk]) + '</option>').join('');
    box.innerHTML = `
      <div class="mf-row"><label>Button</label><input type="checkbox" id="mf-mn-on" ${mn.on ? 'checked' : ''}><span class="mf-hint" style="margin:0">this map is a button on a game menu</span></div>
      <div class="mf-mn ${mn.on ? '' : 'off'}">
        <div class="mf-row"><label>Menu</label><select id="mf-mn-hub">${opt(hubs, mn.hub, 'id', 'name')}</select></div>
        <div class="mf-row"><label>Name</label><input type="text" id="mf-mn-label" maxlength="40" value="${esc(mn.label)}" placeholder="${esc(S.map.name)}"></div>
        <div class="mf-row"><label>Subtitle</label><input type="text" id="mf-mn-sub" maxlength="80" value="${esc(mn.sub)}" placeholder="one line under the name"></div>
        <div class="mf-row"><label>Icon</label><input type="text" id="mf-mn-icon" maxlength="4" value="${esc(mn.icon)}" placeholder="🌍" style="width:64px;flex:0 0 64px"><span class="mf-hint" style="margin:0">an emoji</span></div>
        <div class="mf-row"><label>Kind</label><select id="mf-mn-mode"><option value="interact" ${mn.mode === 'interact' ? 'selected' : ''}>Interaction — single player</option><option value="hub" ${mn.mode === 'hub' ? 'selected' : ''}>Player hub — multiplayer</option></select></div>
        <div id="mf-mn-hubopts" style="display:${mn.mode === 'hub' ? '' : 'none'}">
          <div class="mf-row"><label>Chat</label><input type="checkbox" id="mf-mn-text" ${mn.chatText ? 'checked' : ''}><span class="mf-hint" style="margin:0">typed chat</span><input type="checkbox" id="mf-mn-voice" ${mn.chatVoice ? 'checked' : ''}><span class="mf-hint" style="margin:0">proximity voice</span></div>
          <p class="mf-hint">Everyone who opens the button meets in this world. They see each other, type in the chat box, and hear whoever is within 16 m when voice is on.</p>
        </div>
        <div id="mf-mn-intopts" style="display:${mn.mode === 'interact' ? '' : 'none'}">
          <div class="mf-row"><label>Default</label><select id="mf-mn-kind"><option value="enter" ${mn.kind === 'enter' ? 'selected' : ''}>Enter a building → open a menu</option><option value="dialog" ${mn.kind === 'dialog' ? 'selected' : ''}>Dialogue → play a Forge guide</option></select></div>
          <div class="mf-row" id="mf-mn-target-row" style="display:${mn.kind === 'enter' ? '' : 'none'}"><label>Opens</label><select id="mf-mn-target"><option value="">— pick a menu —</option><optgroup label="Menus">${opt(hubs.map(h => ({ id: 'hub:' + h.id, name: h.name })), mn.target && HUBS.includes(mn.target) ? 'hub:' + mn.target : '', 'id', 'name')}</optgroup><optgroup label="Screens">${opt(games, mn.target, 'id', 'name')}</optgroup></select></div>
          <div class="mf-row" id="mf-mn-guide-row" style="display:${mn.kind === 'dialog' ? '' : 'none'}"><label>Guide</label><select id="mf-mn-guide"><option value="">— pick a guide —</option>${opt(gl, mn.guide, 'id', 'title')}</select></div>
          <p class="mf-hint">This is what a <b>⭕ Zone</b> marker does when the player walks into it. Any object can carry its own interaction instead — select it and set <b>Interaction</b> in the inspector.${gl.length ? '' : ' No guides yet: create one in the Forge → Guides.'}</p>
        </div>
        <p class="mf-hint">Saving to the cloud makes the map public and puts the button on the <b>${esc((hubs.find(h => h.id === mn.hub) || {}).name || mn.hub)}</b> menu for every player.</p>
      </div>`;
    const g = (id) => box.querySelector(id);
    const upd = () => {
      mn.on = g('#mf-mn-on').checked; mn.hub = g('#mf-mn-hub').value; mn.label = g('#mf-mn-label').value.trim().slice(0, 40); mn.sub = g('#mf-mn-sub').value.trim().slice(0, 80); mn.icon = g('#mf-mn-icon').value.trim().slice(0, 4);
      mn.mode = g('#mf-mn-mode').value; mn.chatText = g('#mf-mn-text').checked; mn.chatVoice = g('#mf-mn-voice').checked; mn.kind = g('#mf-mn-kind').value;
      const t = g('#mf-mn-target').value; mn.target = t.startsWith('hub:') ? t.slice(4) : t; mn.guide = g('#mf-mn-guide').value;
      S.map.menu = normalizeMenu(mn); setDirty(true);
    };
    box.querySelectorAll('input,select').forEach(el => { el.onchange = () => { upd(); renderMenuTab(); }; });
  }

  // terrain tab
  $('#mf-t-apply').onclick = () => {
    const n = Math.max(16, Math.min(160, +$('#mf-t-n').value | 0)), cell = Math.max(0.5, Math.min(8, +$('#mf-t-cell').value || 2));
    const before = world.terrain.snapshot();
    world.terrain.setData(resampleTerrain(S.map.terrain, n, cell)); world.onTerrainRebuilt(); regroundAll();
    pushUndo({ type: 'terrain', before, after: world.terrain.snapshot() }); setDirty(true); renderTerrainTab(); renderStats(); if (S.showGrid) toggleGrid(true);
  };
  $('#mf-t-gen').onclick = () => {
    const before = world.terrain.snapshot();
    world.terrain.generate({ type: $('#mf-t-type').value, seed: +$('#mf-t-seed').value || 1, amplitude: +$('#mf-t-amp').value || 6, scale: +$('#mf-t-scale').value || 0.35 });
    regroundAll(); pushUndo({ type: 'terrain', before, after: world.terrain.snapshot() }); setDirty(true);
  };
  $('#mf-t-seed-rnd').onclick = () => { $('#mf-t-seed').value = (Math.random() * 1e6) | 0; $('#mf-t-gen').click(); };
  $('#mf-t-flat').onclick = () => { const before = world.terrain.snapshot(); world.terrain.generate({ type: 'flat' }); regroundAll(); pushUndo({ type: 'terrain', before, after: world.terrain.snapshot() }); setDirty(true); };
  $('#mf-t-grid').onchange = e => toggleGrid(e.target.checked);
  $('#mf-t-markers').onchange = e => { S.showMarkers = e.target.checked; world.setMarkersVisible(S.showMarkers); };
  $('#mf-t-amp').oninput = e => { $('#mf-t-amp-v').textContent = (+e.target.value).toFixed(1) + 'm'; };
  $('#mf-t-scale').oninput = e => { $('#mf-t-scale-v').textContent = (+e.target.value).toFixed(2); };

  // water tab
  const wBind = (id, key, fmt) => { const el = $('#mf-w-' + id); el.oninput = () => { const w = S.map.water; w[key] = el.type === 'checkbox' ? el.checked : el.type === 'color' ? el.value : +el.value; world.applyWater(w); settingsChanged(); renderWaterTab(); }; el.onchange = el.oninput; };
  wBind('on', 'on'); wBind('level', 'level'); wBind('color', 'color'); wBind('opacity', 'opacity'); wBind('wave', 'wave'); wBind('speed', 'speed');
  // sky tab
  const eBind = (key) => { const el = $('#mf-e-' + key); const h = () => { const e = S.map.env; e[key] = el.type === 'checkbox' ? el.checked : el.type === 'color' ? el.value : +el.value; world.applyEnv(e); settingsChanged(); renderSkyTab(); }; el.oninput = h; el.onchange = h; };
  ['skyTop', 'skyBottom', 'fogColor', 'fogNear', 'fogFar', 'sunEl', 'sunAz', 'sunIntensity', 'sunColor', 'ambient', 'ambientIntensity', 'groundColor', 'shadows', 'weatherIntensity', 'windDir', 'windSpeed'].forEach(eBind);
  $('#mf-e-weather').onchange = e => { S.map.env.weather = e.target.value; world.applyEnv(S.map.env); settingsChanged(); };
  $('#mf-e-preset').onchange = e => { const p = ENV_PRESETS[e.target.value]; if (!p) return; Object.assign(S.map.env, p, { preset: e.target.value }); world.applyEnv(S.map.env); settingsChanged(); renderSkyTab(); };

  // maps tab
  $('#mf-new').onclick = newMapFlow;
  $('#mf-desc').onchange = e => { S.map.description = e.target.value.slice(0, 2000); setDirty(true); };
  // Picking a mini-game TAKES YOU TO ITS WORLD: the live map for that game
  // opens for editing (asking first if this map has unsaved changes). Only when
  // the game has no world yet does the pick fall back to tagging the current
  // map with it — which is how a game gets its first world.
  $('#mf-game').onchange = async e => {
    let v = e.target.value;
    if (v === '__custom__') v = gameId(window.prompt('Mini-game id (letters, digits, - and _):', S.map.game || '') || '') || S.map.game || 'sandbox';
    const game = gameId(v) || 'sandbox';
    if (game === (S.map.game || 'sandbox')) { setGameField(game); return; }
    const r = game === 'sandbox' ? { ok: false } : await api.loadLive(game);
    if (!ED) return;
    if (r.ok && r.map && r.map.id !== S.map.id) {
      if (S.dirty && !(await askConfirm('Discard unsaved changes and open the ' + game + ' world?'))) { setGameField(S.map.game || 'sandbox'); return; }
      S.isPublic = true; S.mine = r.mine !== false;
      loadDoc(r.map, r.source || 'cloud'); api.clearDraft(); renderMapsTab();
      toast(S.mine ? '⚒ Editing the live world for ' + game + '.' : 'This is someone else\'s live world for ' + game + ' — saving creates your own copy.', 4200);
      return;
    }
    S.map.game = game; setGameField(game); setDirty(true); renderMapsTab();
    if (game !== 'sandbox') toast('No world for ' + game + ' yet — this map is now tagged for it. Save, then ★ Set live.', 4200);
  };
  $('#mf-maps-game').onchange = () => renderMapsTab();
  $('#mf-glb-btn').onclick = () => $('#mf-glb-file').click();
  $('#mf-up-btn').onclick = () => $('#mf-up-file').click();
  $('#mf-up-file').onchange = e => { const fl = Array.from(e.target.files || []); e.target.value = ''; if (fl.length) uploadFiles(fl); };
  $('#mf-files-refresh').onclick = () => renderFilesTab(true);
  $$('#mf-files-kinds button').forEach(b => b.onclick = () => { filesFilter = b.dataset.kind; renderFilesTab(); });
  $('#mf-glb-file').onchange = e => { Array.from(e.target.files || []).forEach(addAssetFile); e.target.value = ''; };
  // drag a .glb (or a .world.json) onto the canvas
  canvasHost.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; canvasHost.classList.add('drop'); });
  canvasHost.addEventListener('dragleave', () => canvasHost.classList.remove('drop'));
  canvasHost.addEventListener('drop', e => { e.preventDefault(); canvasHost.classList.remove('drop'); Array.from((e.dataTransfer && e.dataTransfer.files) || []).forEach(addAssetFile); });
  $('.mf-top .name input').onchange = e => { S.map.name = e.target.value.trim().slice(0, 80) || 'Untitled world'; setDirty(true); };
  $('#mf-save').onclick = () => save();
  $('#mf-save-local').onclick = () => save('local');
  $('#mf-export').onclick = exportJson;
  $('#mf-import').onclick = () => $('#mf-file').click();
  $('#mf-file').onchange = e => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; };
  $('#mf-play').onclick = togglePlay;
  $('#mf-undo').onclick = undo; $('#mf-redo').onclick = redo;
  $('#mf-help-btn').onclick = () => $('.mf-help').classList.toggle('on');
  $('.mf-help').onclick = e => { if (e.target === e.currentTarget || e.target.dataset.close) $('.mf-help').classList.remove('on'); };
  $('#mf-close').onclick = () => close(false);
  $('#mf-overview').onclick = frameOverview;
  $$('.mf-gizmo button[data-gm]').forEach(b => b.onclick = () => setGizmoMode(b.dataset.gm));
  $('#mf-gm-select').onclick = () => setTool('select');
  $('#mf-snap').onclick = () => { S.snap = !S.snap; applySnap(); renderHud(); };
  $('#mf-snapsize').onchange = e => { S.snapSize = +e.target.value || 1; applySnap(); };
  $('#mf-space').onclick = () => setGizmoSpace(S.gizmoSpace === 'world' ? 'local' : 'world');
  $('#mf-colview').onclick = () => { S.showColliders = !S.showColliders; $('#mf-colview').classList.toggle('on', S.showColliders); drawColliders(); };
  $('#mf-hotkeys').onchange = e => setHotkeys(e.target.value);
  $('#mf-hotkeys').value = S.hotkeys; renderToolbar();
  if (!gizmo) { $$('.mf-gizmo button[data-gm]').forEach(b => { b.disabled = true; b.title = 'TransformControls did not load — drag objects on the ground, or type values in the inspector'; }); }

  renderBrush(); renderPalette(); renderLibrary(); renderInspector(); setTool('select'); setGizmoMode('translate'); showTab('object'); renderUndo();
  setDirty(freshStart ? false : S.dirty);
  loading.remove();
  if (freshStart) setTimeout(() => toast('Welcome to Athena Engine — press H for the controls.', 4000), 400);

  /* ═══ LOOP ═══ */
  let raf = 0, last = performance.now(), fpsN = 0, fpsT = 0;
  const ringPts = brushRing.geometry.attributes.position;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (S.playing) playFrame(dt);
    else { flyFrame(dt); controls.update(); applyStrokeFrame(dt); }
    if (gizmo && gizmo.object && !gizmo.object.parent) gizmo.detach();   // object removed from under the gizmo (undo, API) — never let it complain
    // brush ring + ghost follow the cursor over the terrain
    const showRing = !S.playing && stroke.hit && (S.tool === 'sculpt' || S.tool === 'paint' || S.tool === 'scatter');
    brushRing.visible = !!showRing;
    if (showRing) {
      const p = stroke.hit, R = S.brush.radius, N = ringPts.count;
      for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, x = p.x + Math.cos(a) * R, z = p.z + Math.sin(a) * R; ringPts.setXYZ(i, x, world.heightAt(x, z) + 0.12, z); }
      ringPts.needsUpdate = true;
      brushRing.material.color.set(S.tool === 'paint' ? PAINT[S.paintIdx].color : S.tool === 'scatter' ? '#5fd38a' : effectiveSculptMode(lastMods) === 'lower' ? '#ff6b83' : '#d4af37');
    }
    if (ghost) { const on = !S.playing && !!stroke.hit && (S.tool === 'place' || S.tool === 'scatter'); ghost.visible = on; if (on) ghost.position.set(stroke.hit.x, world.heightAt(stroke.hit.x, stroke.hit.z), stroke.hit.z); }
    world.update(dt, camera);
    renderer.render(scene, camera);
    fpsN++; fpsT += dt; if (fpsT >= 0.5) { $('#mf-hud-fps').textContent = Math.round(fpsN / fpsT) + ' fps · ' + renderer.info.render.triangles.toLocaleString() + ' tris'; fpsN = 0; fpsT = 0; }
  }
  raf = requestAnimationFrame(frame);
  return ED;
}

export function closeEditor() { if (ED) ED.close(); }

/* ── helpers ── */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ensureCss() {
  if (document.getElementById('mf-css')) return;
  const l = document.createElement('link'); l.id = 'mf-css'; l.rel = 'stylesheet'; l.href = new URL('./mapforge.css', import.meta.url).href;
  document.head.appendChild(l);
}
function makeBrushRing(THREE) {
  const N = 64, pos = new Float32Array(N * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: 0xd4af37, depthTest: false, transparent: true, opacity: 0.95 }));
  m.renderOrder = 20; m.frustumCulled = false; m.visible = false; return m;
}
/* OrbitControls when available; otherwise a minimal right-drag orbit / middle
   pan / wheel zoom with the same .target/.update/.enabled surface. */
function makeControls(THREE, camera, dom) {
  if (THREE.OrbitControls) {
    const c = new THREE.OrbitControls(camera, dom);
    c.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    c.enableDamping = true; c.dampingFactor = 0.12; c.maxPolarAngle = Math.PI * 0.495; c.minDistance = 1; c.maxDistance = 1500; c.screenSpacePanning = false;
    return c;
  }
  // The camera position is the source of truth (the editor moves it directly
  // for fly/overview/focus); spherical coords are derived at the start of
  // each interaction, never kept — that is what broke the first version.
  const c = { target: new THREE.Vector3(), enabled: true, update() { camera.lookAt(c.target); } };
  const sph = new THREE.Spherical(); let drag = null;
  const sync = () => { const off = new THREE.Vector3().subVectors(camera.position, c.target); sph.setFromVector3(off); if (sph.radius < 1) sph.radius = 1; };
  const place = () => { const off = new THREE.Vector3().setFromSpherical(sph); camera.position.copy(c.target).add(off); camera.lookAt(c.target); };
  dom.addEventListener('pointerdown', e => { if (!c.enabled || e.button === 0) return; sync(); drag = { b: e.button, x: e.clientX, y: e.clientY, shift: e.shiftKey }; });
  window.addEventListener('pointermove', e => {
    if (!drag || !c.enabled) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 2 && !drag.shift) { sph.theta -= dx * 0.005; sph.phi = Math.max(0.05, Math.min(Math.PI * 0.495, sph.phi - dy * 0.005)); }
    else { const fwd = new THREE.Vector3().subVectors(c.target, camera.position); fwd.y = 0; fwd.normalize(); const right = new THREE.Vector3(fwd.z, 0, -fwd.x); const k = sph.radius * 0.0015; c.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k); }
    place();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  dom.addEventListener('wheel', e => { if (!c.enabled) return; e.preventDefault(); sync(); sph.radius = Math.max(1, Math.min(1500, sph.radius * (e.deltaY > 0 ? 1.12 : 0.89))); place(); }, { passive: false });
  return c;
}

const TEMPLATE = `
<div class="mf-top">
  <span class="brand">⚒ Athena Engine</span>
  <span class="name"><input type="text" maxlength="80" placeholder="Map name"></span>
  <span class="state">New map</span>
  <span class="spacer"></span>
  <span class="grp"><button id="mf-undo" title="Undo (Ctrl+Z)">↶</button><button id="mf-redo" title="Redo (Ctrl+Y)">↷</button></span>
  <span class="grp"><button id="mf-overview" title="Frame the whole map">⌂ Overview</button><button id="mf-play" title="Walk the map (P)">▶ Play</button></span>
  <span class="grp"><button id="mf-save" class="primary" title="Save (Ctrl+S)">💾 Save</button><button id="mf-save-local" title="Save a copy on this device only">⇩ Device</button><button id="mf-export" title="Download as JSON">⤓ Export</button><button id="mf-import" title="Open a JSON export">⤒ Import</button><input type="file" id="mf-file" accept=".json,application/json" hidden></span>
  <span class="grp"><select id="mf-hotkeys" title="Hotkey scheme"><option value="unreal">Unreal hotkeys</option><option value="default">Simple hotkeys</option></select><button id="mf-help-btn" title="Controls (H)">?</button><button id="mf-close" class="danger" title="Close the editor">✕</button></span>
</div>
<div class="mf-left">
  <div class="mf-sec"><h3>Tools</h3>
    <div class="mf-tools">
      <button data-tool="select">🖱️ Select<kbd>1</kbd></button><button data-tool="sculpt">⛰️ Sculpt<kbd>2</kbd></button>
      <button data-tool="paint">🖌️ Paint<kbd>3</kbd></button><button data-tool="place">🧱 Place<kbd>4</kbd></button>
      <button data-tool="scatter">🌲 Scatter<kbd>5</kbd></button><button data-tool="erase">🧹 Erase<kbd>6</kbd></button>
    </div>
  </div>
  <div class="mf-sec"><h3>Brush</h3>
    <div class="mf-tools" style="margin-bottom:8px">
      <button data-sculpt="raise">▲ Raise</button><button data-sculpt="lower">▼ Lower</button><button data-sculpt="smooth">≈ Smooth</button><button data-sculpt="flatten">▬ Flatten</button>
    </div>
    <div class="mf-row"><label>Radius</label><input type="range" id="mf-radius" min="0.5" max="60" step="0.5"><span class="v" id="mf-radius-v"></span></div>
    <div class="mf-row"><label>Strength</label><input type="range" id="mf-strength" min="0.05" max="1" step="0.05"><span class="v" id="mf-strength-v"></span></div>
    <div class="mf-row"><label>Softness</label><input type="range" id="mf-falloff" min="0.05" max="1" step="0.05"><span class="v" id="mf-falloff-v"></span></div>
    <p class="mf-hint">Hold <b>Shift</b> to lower, <b>Ctrl</b> to smooth, <b>Alt</b> to flatten. <b>[</b> / <b>]</b> change the radius.</p>
  </div>
  <div class="mf-sec"><h3>Paint layers</h3><div class="mf-pal" id="mf-palette"></div></div>
  <div class="mf-sec"><h3>Library</h3>
    <div class="mf-cats" id="mf-cats"></div>
    <div class="mf-props" id="mf-props"></div>
    <div id="mf-models" style="display:none">
      <div class="mf-assets" id="mf-assets"></div>
      <div class="mf-btns" style="margin:8px 0"><button id="mf-glb-btn" class="primary">📂 Add .glb file</button><input type="file" id="mf-glb-file" accept=".glb,.gltf,model/gltf-binary" multiple hidden></div>
      <p class="mf-hint" id="mf-embed-note" style="margin:0 0 8px"></p>
      <div class="mf-sub">Project (/models/)</div>
      <div class="mf-assets" id="mf-project"><div class="mf-empty">Loading…</div></div>
      <div class="mf-sub" style="margin-top:8px">By URL</div>
      <div><input type="text" id="mf-asset-url" placeholder="https://…/model.glb  or  /models/x.glb"></div>
      <div style="display:flex;gap:5px;margin-top:5px"><input type="text" id="mf-asset-label" placeholder="Label (optional)" maxlength="60"><button id="mf-asset-add">Add</button></div>
      <p class="mf-hint">Drop a .glb on the canvas to embed it in this map (quick tests). For production put the file in /models/, list it in /models/manifest.json, and it appears under Project. Y-up, metres, origin at the base. Animated models keep their clips — pick one in the inspector.</p>
    </div>
    <div class="mf-row" id="mf-tint-row" style="margin-top:8px"><label>Tint</label><input type="checkbox" id="mf-tint-on"><input type="color" id="mf-tint" value="#c0392b"><span class="mf-hint" style="margin:0">colour new props</span></div>
  </div>
  <div class="mf-sec"><h3>Scatter</h3>
    <div class="mf-row"><label>Per stroke</label><input type="range" id="mf-sc-count" min="1" max="40" step="1" value="6"><span class="v" id="mf-sc-count-v">6</span></div>
    <div class="mf-row"><label>Size jitter</label><input type="range" id="mf-sc-scale" min="0" max="0.8" step="0.05" value="0.3"><span class="v" id="mf-sc-scale-v">30%</span></div>
    <div class="mf-row"><label>Random spin</label><input type="checkbox" id="mf-sc-rot" checked></div>
    <div class="mf-row"><label>Avoid water</label><input type="checkbox" id="mf-sc-water" checked></div>
  </div>
</div>
<div class="mf-canvas">
  <div class="mf-gizmo"><button id="mf-gm-select" title="Select tool">↖ Select</button><button data-gm="translate" title="Move">✥ Move</button><button data-gm="rotate" title="Rotate">⟳ Rotate</button><button data-gm="scale" title="Scale">⤢ Scale</button><span class="sep"></span><button id="mf-snap" title="Snap to grid (X)">⌗ Snap</button><select id="mf-snapsize" title="Snap size"><option value="0.25">¼ m</option><option value="0.5">½ m</option><option value="1" selected>1 m</option><option value="2">2 m</option><option value="5">5 m</option></select><button id="mf-space" title="Gizmo space: world / local">🌐 World</button><span class="sep"></span><button id="mf-colview" title="Show every collider">▢ Colliders</button></div>
  <div class="mf-hud"><div class="chip" id="mf-hud-tool"></div><div class="chip" id="mf-hud-help"></div><div class="chip"><span id="mf-hud-stats"></span> · <span id="mf-hud-fps"></span></div></div>
  <div class="mf-playhud"><div class="ret"></div><div class="msg"><b>W</b> forward · <b>S</b> back · <b>A</b> left · <b>D</b> right · <b>Space</b> jump · <b>Shift</b> run · mouse looks · <b>Esc</b> back to the editor</div></div>
  <div class="mf-toast"></div>
  <div class="mf-help"><div class="box">
    <h2>Athena Engine — controls</h2>
    <table>
      <tr><td>Camera</td><td><kbd>Right-drag</kbd> orbit · <kbd>Middle-drag</kbd> / <kbd>Shift</kbd>+right pan · <kbd>Wheel</kbd> zoom · <kbd>W A S D</kbd> fly, <kbd>Q</kbd>/<kbd>E</kbd> down/up, <kbd>Shift</kbd> faster</td></tr>
      <tr><td>Tools</td><td><kbd>1</kbd> Select <kbd>2</kbd> Sculpt <kbd>3</kbd> Paint <kbd>4</kbd> Place <kbd>5</kbd> Scatter <kbd>6</kbd> Erase</td></tr>
      <tr><td>Sculpt</td><td>Left-drag raises. Hold <kbd>Shift</kbd> to lower, <kbd>Ctrl</kbd> to smooth, <kbd>Alt</kbd> to flatten to the height you started on. <kbd>[</kbd> <kbd>]</kbd> brush radius</td></tr>
      <tr><td>Objects</td><td>Click to select · Unreal hotkeys: <kbd>Q</kbd> select <kbd>W</kbd> move <kbd>E</kbd> rotate <kbd>R</kbd> scale, <kbd>RMB</kbd>+<kbd>WASD</kbd> fly, <kbd>End</kbd> drop to floor (Simple scheme: <kbd>T</kbd>/<kbd>R</kbd>/<kbd>C</kbd>, WASD always flies) · <kbd>X</kbd> snap · <kbd>F</kbd> focus · <kbd>Ctrl+D</kbd> duplicate · <kbd>Del</kbd> remove · drag the green arrow to lift an object</td></tr>
      <tr><td>VFX</td><td>Library → <b>VFX</b> places fire, smoke, steam, fog, sparks, gas, dust and motes; select one for intensity, size and tint. Campfires, craters, generators and wrecks carry their own effect (switch it off in the inspector). Sky tab → <b>Weather</b>: rain, storm with lightning, snow, ash, dust storm, plus wind.</td></tr>
      <tr><td>Collision</td><td>Select an object → <b>Add / Remove collision</b> in the inspector (box or cylinder). Solid things block you in Play; low ones are stepped onto, so crates and bridges are walkable. <b>▢ Colliders</b> shows them all.</td></tr>
      <tr><td>Play</td><td><kbd>P</kbd> walk the map from the first Player Spawn marker · <kbd>W</kbd> forward <kbd>S</kbd> back <kbd>A</kbd> left <kbd>D</kbd> right (arrow keys too) · <kbd>Space</kbd> jump · <kbd>Shift</kbd> run · mouse looks · <kbd>Esc</kbd> returns</td></tr>
      <tr><td>File</td><td><kbd>Ctrl+S</kbd> save · <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> undo / redo · Export writes a .world.json you can Import anywhere</td></tr>
      <tr><td>Water</td><td>One global water level (Water tab). Sculpt below it to make lakes and rivers; Scatter skips underwater ground.</td></tr>
      <tr><td>Models</td><td>Drag a <kbd>.glb</kbd> onto the canvas, or Library → Models → Project / URL. Animated models: select the object and pick a clip, speed and loop in the inspector.</td></tr>
      <tr><td>Mini-games</td><td>Maps tab: tag the map with a game and <b>★ Set live</b>. A mini-game then loads it with <code>MythicMapForge.engine.mount(el, { game: 'name' })</code>.</td></tr>
    </table>
    <div style="text-align:right;margin-top:10px"><button data-close="1" class="primary">Got it</button></div>
  </div></div>
  <div class="mf-loading"><div>⚒ Loading Athena Engine</div><div class="sub">fetching three.js…</div></div>
</div>
<div class="mf-right">
  <div class="mf-tabs"><button data-tab="object">Object</button><button data-tab="scene">Scene</button><button data-tab="files">Files</button><button data-tab="terrain">Terrain</button><button data-tab="water">Water</button><button data-tab="sky">Sky</button><button data-tab="menu">Menu</button><button data-tab="maps">Maps</button></div>
  <div class="mf-tab" data-tab="object"><div class="mf-sec"><h3>Inspector</h3><div id="mf-inspector"></div></div></div>
  <div class="mf-tab" data-tab="scene"><div class="mf-sec" style="padding:0"><h3 style="padding:10px 12px 0">In this map</h3><div id="mf-scene"></div></div></div>
  <div class="mf-tab" data-tab="files">
    <div class="mf-sec"><h3>Uploaded files</h3>
      <div class="mf-btns"><button id="mf-up-btn" class="primary">⤒ Upload</button><select id="mf-up-kind" title="Detected from the file unless you choose"><option value="">auto-detect</option><option value="model">Model</option><option value="anim">Animation</option><option value="audio">Audio</option><option value="vfx">VFX preset</option></select><button id="mf-files-refresh" title="Reload the list">↻</button><input type="file" id="mf-up-file" accept=".glb,.gltf,.mp3,.wav,.ogg,.m4a,.json" multiple hidden></div>
      <p class="mf-hint" id="mf-files-note"></p>
      <div class="mf-cats" id="mf-files-kinds"><button data-kind="all" class="on">All</button><button data-kind="model">🧊 Models</button><button data-kind="anim">🎞 Anims</button><button data-kind="audio">🔊 Audio</button><button data-kind="vfx">✨ VFX</button></div>
    </div>
    <div id="mf-files"></div>
    <div class="mf-sec"><p class="mf-hint" style="margin:0">A model joins this map's Library. An animation applies to the selected model (bone names must match). Audio arms the <b>🔊 Sound</b> marker. A VFX preset is JSON: <code>{"kind":"fire","tint":"#ff8a1a","s":1.5,"i":1,"label":"Torch"}</code>.</p></div>
  </div>
  <div class="mf-tab" data-tab="menu"><div class="mf-sec"><h3>Player &amp; camera</h3><div id="mf-player"></div></div><div class="mf-sec"><h3>Menu button</h3><div id="mf-menu"></div></div></div>
  <div class="mf-tab" data-tab="terrain">
    <div class="mf-sec"><h3>Size</h3>
      <div class="mf-row"><label>Grid</label><select id="mf-t-n"><option>32</option><option>48</option><option>64</option><option>96</option><option>128</option><option>160</option></select></div>
      <div class="mf-row"><label>Cell (m)</label><input type="number" id="mf-t-cell" min="0.5" max="8" step="0.5"></div>
      <div class="mf-row"><label>World</label><span id="mf-t-size" style="color:#cfc7ad"></span></div>
      <button id="mf-t-apply" style="width:100%">Apply size (keeps the shape)</button>
    </div>
    <div class="mf-sec"><h3>Generate</h3>
      <div class="mf-row"><label>Type</label><select id="mf-t-type"><option value="hills">Rolling hills</option><option value="island">Island</option><option value="valley">Valley</option><option value="mountains">Mountains</option></select></div>
      <div class="mf-row"><label>Seed</label><input type="number" id="mf-t-seed" value="1337"><button id="mf-t-seed-rnd" title="Random seed">🎲</button></div>
      <div class="mf-row"><label>Height</label><input type="range" id="mf-t-amp" min="0.5" max="40" step="0.5" value="6"><span class="v" id="mf-t-amp-v">6.0m</span></div>
      <div class="mf-row"><label>Detail</label><input type="range" id="mf-t-scale" min="0.1" max="1.5" step="0.05" value="0.35"><span class="v" id="mf-t-scale-v">0.35</span></div>
      <div class="mf-btns"><button id="mf-t-gen" class="primary">Generate</button><button id="mf-t-flat">Flatten all</button></div>
      <p class="mf-hint">Generating replaces the whole terrain (undo works). Props stay where they are and drop onto the new ground.</p>
    </div>
    <div class="mf-sec"><h3>View</h3>
      <div class="mf-row"><label>Grid</label><input type="checkbox" id="mf-t-grid"></div>
      <div class="mf-row"><label>Markers</label><input type="checkbox" id="mf-t-markers" checked><span class="mf-hint" style="margin:0">spawns, zones, waypoints</span></div>
    </div>
  </div>
  <div class="mf-tab" data-tab="water">
    <div class="mf-sec"><h3>Water</h3>
      <div class="mf-row"><label>Enabled</label><input type="checkbox" id="mf-w-on"></div>
      <div class="mf-row"><label>Level</label><input type="range" id="mf-w-level" min="-40" max="40" step="0.1"><span class="v" id="mf-w-level-v"></span></div>
      <div class="mf-row"><label>Colour</label><input type="color" id="mf-w-color"></div>
      <div class="mf-row"><label>Opacity</label><input type="range" id="mf-w-opacity" min="0.1" max="1" step="0.02"><span class="v" id="mf-w-opacity-v"></span></div>
      <div class="mf-row"><label>Waves</label><input type="range" id="mf-w-wave" min="0" max="1.2" step="0.02"><span class="v" id="mf-w-wave-v"></span></div>
      <div class="mf-row"><label>Speed</label><input type="range" id="mf-w-speed" min="0" max="4" step="0.1"><span class="v" id="mf-w-speed-v"></span></div>
      <p class="mf-hint">Water is a single level across the map. Lower the ground beneath it with Sculpt to carve lakes, rivers and coasts.</p>
    </div>
  </div>
  <div class="mf-tab" data-tab="sky">
    <div class="mf-sec"><h3>Time of day</h3>
      <div class="mf-row"><label>Preset</label><select id="mf-e-preset"><option value="day">Day</option><option value="dawn">Dawn</option><option value="dusk">Dusk</option><option value="night">Night</option><option value="overcast">Overcast</option><option value="wasteland">Wasteland</option><option value="fallout">Fallout night</option></select></div>
      <div class="mf-row"><label>Sun height</label><input type="range" id="mf-e-sunEl" min="-10" max="90" step="1"><span class="v" id="mf-e-sunEl-v"></span></div>
      <div class="mf-row"><label>Sun angle</label><input type="range" id="mf-e-sunAz" min="0" max="360" step="1"><span class="v" id="mf-e-sunAz-v"></span></div>
      <div class="mf-row"><label>Sun power</label><input type="range" id="mf-e-sunIntensity" min="0" max="3" step="0.05"><span class="v" id="mf-e-sunIntensity-v"></span></div>
      <div class="mf-row"><label>Sun colour</label><input type="color" id="mf-e-sunColor"></div>
      <div class="mf-row"><label>Shadows</label><input type="checkbox" id="mf-e-shadows"></div>
    </div>
    <div class="mf-sec"><h3>Sky &amp; fog</h3>
      <div class="mf-row"><label>Sky top</label><input type="color" id="mf-e-skyTop"></div>
      <div class="mf-row"><label>Horizon</label><input type="color" id="mf-e-skyBottom"></div>
      <div class="mf-row"><label>Fog</label><input type="color" id="mf-e-fogColor"></div>
      <div class="mf-row"><label>Fog near</label><input type="range" id="mf-e-fogNear" min="1" max="600" step="1"><span class="v" id="mf-e-fogNear-v"></span></div>
      <div class="mf-row"><label>Fog far</label><input type="range" id="mf-e-fogFar" min="10" max="1500" step="5"><span class="v" id="mf-e-fogFar-v"></span></div>
    </div>
    <div class="mf-sec"><h3>Weather &amp; wind</h3>
      <div class="mf-row"><label>Weather</label><select id="mf-e-weather">${Object.keys(WEATHERS).map(k => '<option value="' + k + '">' + WEATHERS[k] + '</option>').join('')}</select></div>
      <div class="mf-row"><label>Amount</label><input type="range" id="mf-e-weatherIntensity" min="0.2" max="3" step="0.1"><span class="v" id="mf-e-weatherIntensity-v"></span></div>
      <div class="mf-row"><label>Wind dir</label><input type="range" id="mf-e-windDir" min="0" max="360" step="5"><span class="v" id="mf-e-windDir-v"></span></div>
      <div class="mf-row"><label>Wind</label><input type="range" id="mf-e-windSpeed" min="0" max="20" step="0.5"><span class="v" id="mf-e-windSpeed-v"></span></div>
      <p class="mf-hint">Storm adds lightning. Wind bends every smoke column and drives rain, snow and ash. Place local effects from Library → VFX: fire, smoke, steam, ground fog, sparks, toxic gas, dust, motes.</p>
    </div>
    <div class="mf-sec"><h3>Ambient</h3>
      <div class="mf-row"><label>Sky light</label><input type="color" id="mf-e-ambient"></div>
      <div class="mf-row"><label>Ground</label><input type="color" id="mf-e-groundColor"></div>
      <div class="mf-row"><label>Amount</label><input type="range" id="mf-e-ambientIntensity" min="0" max="2" step="0.05"><span class="v" id="mf-e-ambientIntensity-v"></span></div>
    </div>
  </div>
  <div class="mf-tab" data-tab="maps">
    <div class="mf-sec"><h3>This map</h3>
      <div class="mf-row"><label>Mini-game</label><select id="mf-game"></select></div>
      <p class="mf-hint" style="margin:0 0 8px">Pick the mini-game this world belongs to. <b>★ Set live</b> in the list below makes it that game's world: its screen then shows players a <b>🌍 Enter world</b> pill, and you an <b>⚒ Edit map</b> pill that opens the world right here.</p>
      <textarea id="mf-desc" rows="3" maxlength="2000" placeholder="Description (shown in the list)"></textarea>
      <div class="mf-btns" style="margin-top:8px"><button id="mf-new">✦ New map</button></div>
      <p class="mf-hint" id="mf-storage"></p>
    </div>
    <div class="mf-sec"><h3>Saved maps</h3>
      <div class="mf-row"><label>Filter</label><input type="checkbox" id="mf-maps-game"><span class="mf-hint" style="margin:0">only this mini-game</span></div>
      <div class="mf-maps" id="mf-maps"></div></div>
  </div>
</div>`;
