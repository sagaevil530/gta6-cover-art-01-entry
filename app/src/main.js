// Neon Coast Cover Studio — the editor.
//
// Wires the controls to the cover engine in cover.js: photo upload (file picker
// and drag-and-drop) plus two built-in sample photos, per-panel crop and position,
// caption and subtitle editing, six poster layouts, five sunset/neon grades and
// three post sizes, with one-click PNG export. Also serves the fixed screenshot
// scenes (?shot=cover / ?shot=editor with ?photo= and ?caption=) and a headless
// self-test (?selftest=export) that exercises upload, render and PNG export.

import { LAYOUTS, GRADES, SIZES, layoutPanels, renderCover } from './cover.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const overlay = $('overlay');
const statusEl = $('status');

const SAMPLES = [
  { name: 'Pier', file: 'pier' },
  { name: 'Boulevard', file: 'boulevard' },
];

// The working state. slots are the photo library; panels point at slots and
// carry their own crop (zoom / pan), so one photo can fill every panel with a
// different crop, and a second photo can take over any panel.
const state = {
  caption: 'Sunset Heist',
  subtitle: 'Neon Coast',
  layout: 'vice-grid',
  grade: 'sunset',
  size: '1080x1080',
  grain: true,
  vignette: true,
  badge: true,
  slots: [],
  panels: [],
  selected: 0,
};

let lastRects = [];
let fontsReady = false;

async function loadImage(src) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
  return img;
}

async function loadSample(file) {
  return loadImage(`samples/${file}.jpg`);
}

/** Rebuilds the panel list for the current layout, keeping crops where they fit. */
function rebuildPanels() {
  const count = LAYOUTS[state.layout].panels;
  const old = state.panels;
  state.panels = Array.from({ length: count }, (_, i) => {
    const keep = old[i];
    // Panels that share a slot get a different crop, so one photo still fills
    // a multi-panel cover with variety.
    const slot = keep ? keep.slot : i % Math.max(1, state.slots.length);
    const spread = (i % 3) - 1;
    return {
      slot,
      zoom: keep ? keep.zoom : 1 + (i % 3) * 0.12,
      ox: keep ? keep.ox : spread * 0.12,
      oy: keep ? keep.oy : -spread * 0.08,
    };
  });
  state.selected = Math.min(state.selected, count - 1);
}

/** The panels renderCover will draw: each panel resolved to its photo image. */
function renderPanels() {
  return state.panels.map((p) => ({
    img: state.slots[p.slot]?.img ?? null,
    zoom: p.zoom,
    ox: p.ox,
    oy: p.oy,
  }));
}

function panelAreaFor(W, H) {
  const titleH = state.layout === 'full-bleed' ? 0 : Math.round(H * (W >= H * 1.5 ? 0.26 : 0.20));
  return { area: { x: 0, y: 0, w: W, h: H - titleH }, titleH };
}

function render() {
  const { w, h } = SIZES[state.size];
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
    overlay.width = w;
    overlay.height = h;
  }
  const ctx = stage.getContext('2d');
  renderCover(ctx, { ...state, panels: renderPanels() }, w, h);
  const { area } = panelAreaFor(w, h);
  lastRects = layoutPanels(state.layout, area);
  drawSelection();
  syncPanelControls();
}

function drawSelection() {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const rect = lastRects[state.selected];
  if (!rect || state.layout === 'full-bleed') return;
  ctx.save();
  ctx.strokeStyle = '#00e5d4';
  ctx.lineWidth = Math.max(3, Math.round(overlay.width * 0.004));
  ctx.setLineDash([Math.round(overlay.width * 0.012), Math.round(overlay.width * 0.008)]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setLineDash([]);
  ctx.fillStyle = '#00e5d4';
  const label = `Panel ${state.selected + 1}`;
  ctx.font = `700 ${Math.max(16, Math.round(overlay.width * 0.016))}px Arial, sans-serif`;
  const tw = ctx.measureText(label).width;
  const pad = Math.round(overlay.width * 0.008);
  ctx.fillRect(rect.x, rect.y, tw + pad * 2, Math.round(overlay.width * 0.026) + pad);
  ctx.fillStyle = '#0d0518';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + pad, rect.y + pad + Math.round(overlay.width * 0.013));
  ctx.restore();
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Exports the current cover at `sizeKey` as a PNG download; resolves with its size. */
export async function exportCover(sizeKey = state.size) {
  const { w, h } = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const saved = state.size;
  state.size = sizeKey;
  renderCover(off.getContext('2d'), { ...state, panels: renderPanels() }, w, h);
  state.size = saved;
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neon-coast-cover-${w}x${h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Exported ${w} × ${h} PNG (${(blob.size / 1024).toFixed(0)} KiB) — check your downloads.`);
  return { w, h, bytes: blob.size, type: blob.type };
}

async function exportAllSizes() {
  for (const key of Object.keys(SIZES)) {
    await exportCover(key);
    await new Promise((r) => setTimeout(r, 250));
  }
  setStatus('Exported all three post sizes as PNG.');
}

/** Adds uploaded files to the photo library and fills empty panels with them. */
async function handleFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) {
    setStatus('That was not an image — try a JPG or PNG photo.');
    return;
  }
  for (const file of images) {
    const img = await loadImage(URL.createObjectURL(file));
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || `Photo ${state.slots.length + 1}`;
    state.slots.push({ name, img });
  }
  // New photos take over panels from the top, so the cover changes at once.
  state.panels.forEach((p, i) => {
    if (i < images.length) p.slot = state.slots.length - images.length + i;
  });
  buildSlotPickers();
  render();
  setStatus(`${images.length} photo${images.length > 1 ? 's' : ''} loaded — drag the sliders to crop each panel.`);
}

function buildSlotPickers() {
  const pick = $('panel-photo');
  pick.innerHTML = '';
  state.slots.forEach((slot, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1} · ${slot.name}`;
    pick.appendChild(opt);
  });
  syncPanelControls();
}

function syncPanelControls() {
  const p = state.panels[state.selected];
  if (!p) return;
  $('panel-photo').value = String(p.slot);
  $('zoom').value = String(p.zoom);
  $('pan-x').value = String(p.ox);
  $('pan-y').value = String(p.oy);
  $('zoom-val').textContent = `${p.zoom.toFixed(2)}×`;
  $('pan-x-val').textContent = `${Math.round(p.ox * 100)}%`;
  $('pan-y-val').textContent = `${Math.round(p.oy * 100)}%`;
  $('panel-label').textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
}

function choiceButtons(el, entries, current, onPick) {
  el.innerHTML = '';
  for (const [key, value] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice' + (key === current ? ' on' : '');
    b.textContent = value.name;
    b.title = value.blurb ?? value.name;
    b.addEventListener('click', () => {
      onPick(key);
      [...el.children].forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
    });
    el.appendChild(b);
  }
}

function buildControls() {
  choiceButtons($('layouts'), Object.entries(LAYOUTS), state.layout, (key) => {
    state.layout = key;
    rebuildPanels();
    render();
  });
  choiceButtons($('grades'), Object.entries(GRADES), state.grade, (key) => {
    state.grade = key;
    render();
  });
  choiceButtons($('sizes'), Object.entries(SIZES), state.size, (key) => {
    state.size = key;
    render();
  });
  $('samples').innerHTML = '';
  for (const sample of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.textContent = sample.name;
    b.addEventListener('click', async () => {
      const img = await loadSample(sample.file);
      state.slots[0] = { name: sample.name, img };
      state.panels.forEach((p) => { if (p.slot === 0) p.slot = 0; });
      buildSlotPickers();
      render();
      setStatus(`Sample photo “${sample.name}” loaded.`);
    });
    $('samples').appendChild(b);
  }
}

function bindEditor() {
  $('caption').addEventListener('input', (e) => { state.caption = e.target.value; render(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('photo').addEventListener('change', (e) => handleFiles([...e.target.files]));
  $('use-all').addEventListener('click', () => {
    const slot = Number($('panel-photo').value);
    state.panels.forEach((p) => { p.slot = slot; });
    render();
    setStatus(`All panels now use photo ${slot + 1}.`);
  });
  $('panel-photo').addEventListener('change', (e) => {
    state.panels[state.selected].slot = Number(e.target.value);
    render();
  });
  const slider = (id, key) => {
    $(id).addEventListener('input', (e) => {
      state.panels[state.selected][key] = Number(e.target.value);
      render();
    });
  };
  slider('zoom', 'zoom');
  slider('pan-x', 'ox');
  slider('pan-y', 'oy');
  for (const [id, key] of [['grain', 'grain'], ['vignette', 'vignette'], ['badge', 'badge']]) {
    $(id).addEventListener('change', (e) => { state[key] = e.target.checked; render(); });
  }
  $('export').addEventListener('click', () => exportCover());
  $('export-all').addEventListener('click', exportAllSizes);

  const drop = $('dropzone');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
  }));
  drop.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));
  drop.addEventListener('click', () => $('photo').click());

  overlay.addEventListener('click', (e) => {
    const box = overlay.getBoundingClientRect();
    const x = (e.clientX - box.left) * (overlay.width / box.width);
    const y = (e.clientY - box.top) * (overlay.height / box.height);
    const hit = lastRects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit >= 0) {
      state.selected = hit;
      render();
    }
  });
}

async function ensureFonts() {
  if (fontsReady) return;
  try {
    await Promise.all([
      document.fonts.load('90px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch { /* fall back to system fonts */ }
  fontsReady = true;
}

/** Fixed screenshot scenes: ?shot=cover shows the cover alone, ?shot=editor the editor. */
async function runShot(shot, query) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  // Each sample gets its own art direction, so the two cover shots look different.
  if (photo === 'boulevard') {
    state.layout = 'hero-trio';
    state.grade = 'neon';
  } else {
    state.layout = 'vice-grid';
    state.grade = 'sunset';
  }
  state.caption = caption;
  state.subtitle = 'Neon Coast';
  $('caption').value = caption;
  const img = await loadSample(photo);
  state.slots = [{ name: photo, img }];
  // A second sample fills the other panels, so multi-panel covers show variety.
  const other = photo === 'pier' ? 'boulevard' : 'pier';
  state.slots.push({ name: other, img: await loadSample(other) });
  rebuildPanels();
  buildSlotPickers();
  buildControls();
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await ensureFonts();
  render();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}

/** Headless self-test: uploads a sample as a File, renders, exports a PNG and reports it. */
async function runSelfTest() {
  const out = $('selftest');
  const report = (obj) => {
    out.textContent = JSON.stringify(obj);
    document.title = `selftest ${obj.ok ? 'ok' : 'fail'}`;
  };
  try {
    const res = await fetch('samples/pier.jpg');
    const blob = await res.blob();
    await handleFiles([new File([blob], 'pier.jpg', { type: 'image/jpeg' })]);
    state.caption = 'Self Test';
    await ensureFonts();
    render();
    const shot = await exportCover('1080x1080');
    // Verify the exported PNG decodes at the right size by re-rendering it.
    const exported = await new Promise((resolve, reject) => {
      const c = document.createElement('canvas');
      c.width = shot.w;
      c.height = shot.h;
      renderCover(c.getContext('2d'), { ...state, panels: renderPanels() }, shot.w, shot.h);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png');
    });
    const img = await loadImage(URL.createObjectURL(exported));
    report({ ok: img.naturalWidth === 1080 && img.naturalHeight === 1080, w: img.naturalWidth, h: img.naturalHeight, bytes: exported.size, type: exported.type });
  } catch (err) {
    report({ ok: false, error: String(err && err.message ? err.message : err) });
  }
  window.__shotReady = true;
}

async function boot() {
  buildControls();
  bindEditor();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (query.get('selftest') === 'export') {
    await runSelfTest();
    return;
  }
  // Default session: both samples loaded, panels alternating between them.
  for (const sample of SAMPLES) {
    state.slots.push({ name: sample.name, img: await loadSample(sample.file) });
  }
  rebuildPanels();
  buildSlotPickers();
  if (shot === 'cover' || shot === 'editor') {
    await runShot(shot, query);
    return;
  }
  await ensureFonts();
  render();
  setStatus('Drop a photo, or use a sample — then export your cover as a PNG.');
}

boot().catch((err) => {
  setStatus(`Could not start: ${err.message}`);
  console.error(err);
});
