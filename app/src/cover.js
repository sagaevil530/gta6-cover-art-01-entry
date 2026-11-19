// Neon Coast Cover Studio — the cover engine.
//
// Renders a GTA-poster-style cover on a 2D canvas: a set of photo panels in one
// of six poster layouts, each photo graded with a Vice City sunset or neon grade,
// then a bold Anton title block, a neon Pacifico subtitle, a badge and grain.
// Everything is drawn with plain canvas calls; no image leaves the machine.

export const LAYOUTS = {
  'vice-grid': { name: 'Vice Grid', panels: 4, blurb: 'Four-panel poster grid' },
  'hero-trio': { name: 'Hero Trio', panels: 4, blurb: 'One hero, three stacked' },
  bands: { name: 'Sunset Bands', panels: 3, blurb: 'Three wide film bands' },
  nine: { name: 'Nine Up', panels: 9, blurb: 'Nine-panel contact grid' },
  tilted: { name: 'Tilted Snaps', panels: 3, blurb: 'Taped snapshots, askew' },
  'full-bleed': { name: 'Full Bleed', panels: 1, blurb: 'One photo, edge to edge' },
};

export const GRADES = {
  sunset: {
    name: 'Sunset',
    filter: 'saturate(1.45) contrast(1.12) brightness(1.03)',
    overlays: [
      { blend: 'soft-light', stops: [[0, '#ff9a3c'], [0.55, '#ff5e78'], [1, '#7b2ff7']] },
      { blend: 'overlay', stops: [[0, 'rgba(255,170,60,0.28)'], [1, 'rgba(120,40,160,0.28)']] },
    ],
    title: ['#fff8ea', '#ffd166', '#ff7a3c'],
    accent: '#ff5e78',
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.6) contrast(1.16) brightness(1.0)',
    overlays: [
      { blend: 'color', stops: [[0, '#ff2e88'], [0.5, '#b04dff'], [1, '#00e5d4']] },
      { blend: 'soft-light', stops: [[0, 'rgba(0,229,212,0.35)'], [1, 'rgba(255,46,136,0.35)']] },
    ],
    title: ['#ffffff', '#8ff7ff', '#ff5da2'],
    accent: '#00e5d4',
  },
  vice: {
    name: 'Vice Purple',
    filter: 'saturate(1.35) contrast(1.1) brightness(1.02)',
    overlays: [
      { blend: 'soft-light', stops: [[0, '#ff8c42'], [1, '#6a1fb5']] },
      { blend: 'multiply', stops: [[0, 'rgba(90,20,140,0.22)'], [1, 'rgba(255,120,60,0.18)']] },
    ],
    title: ['#fff3fb', '#e9a7ff', '#ff8c42'],
    accent: '#b04dff',
  },
  noir: {
    name: 'Noir',
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    overlays: [
      { blend: 'multiply', stops: [[0, 'rgba(255,190,120,0.20)'], [1, 'rgba(20,10,40,0.28)']] },
      { blend: 'screen', stops: [[0, 'rgba(255,255,255,0.10)'], [1, 'rgba(255,255,255,0.0)']] },
    ],
    title: ['#ffffff', '#e8e8e8', '#bdbdbd'],
    accent: '#ffffff',
  },
  gold: {
    name: 'Golden Hour',
    filter: 'saturate(1.3) contrast(1.08) brightness(1.05) sepia(0.25)',
    overlays: [
      { blend: 'soft-light', stops: [[0, '#ffe08a'], [1, '#ff6b35']] },
      { blend: 'overlay', stops: [[0, 'rgba(255,210,110,0.25)'], [1, 'rgba(180,80,20,0.22)']] },
    ],
    title: ['#fffbe8', '#ffe08a', '#ff9a3c'],
    accent: '#ffd166',
  },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, name: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, name: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, name: 'Wide · 1920 × 1080' },
};

/** The panels of a layout, as rectangles inside the panel area. Rotated panels carry `rot` (radians). */
export function layoutPanels(layout, area) {
  const { x, y, w, h } = area;
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  const m = Math.max(8, Math.round(Math.min(w, h) * 0.016));
  const ix = x + m;
  const iy = y + m;
  const iw = w - 2 * m;
  const ih = h - 2 * m;
  const col = (n) => (iw - (n - 1) * g) / n;
  const row = (n) => (ih - (n - 1) * g) / n;
  switch (layout) {
    case 'hero-trio': {
      const heroW = Math.round(iw * 0.60);
      const sideW = iw - heroW - g;
      const rh = row(3);
      return [
        { x: ix, y: iy, w: heroW, h: ih },
        { x: ix + heroW + g, y: iy, w: sideW, h: rh },
        { x: ix + heroW + g, y: iy + rh + g, w: sideW, h: rh },
        { x: ix + heroW + g, y: iy + 2 * (rh + g), w: sideW, h: rh },
      ];
    }
    case 'bands': {
      const hs = [0.44, 0.30, 0.26].map((f) => Math.round((ih - 2 * g) * f));
      return [
        { x: ix, y: iy, w: iw, h: hs[0] },
        { x: ix, y: iy + hs[0] + g, w: iw, h: hs[1] },
        { x: ix, y: iy + hs[0] + hs[1] + 2 * g, w: iw, h: hs[2] },
      ];
    }
    case 'nine': {
      const cw = col(3);
      const rh = row(3);
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push({ x: ix + c * (cw + g), y: iy + r * (rh + g), w: cw, h: rh });
        }
      }
      return out;
    }
    case 'tilted': {
      const heroH = Math.round(ih * 0.62);
      const snapW = Math.round(iw * 0.46);
      const snapH = Math.round(ih * 0.34);
      return [
        { x: ix, y: iy, w: iw, h: heroH },
        { x: ix + Math.round(iw * 0.03), y: iy + heroH - Math.round(snapH * 0.28), w: snapW, h: snapH, rot: -0.07 },
        { x: ix + iw - snapW - Math.round(iw * 0.03), y: iy + heroH - Math.round(snapH * 0.22), w: snapW, h: snapH, rot: 0.06 },
      ];
    }
    case 'full-bleed':
      return [{ x, y, w, h }];
    case 'vice-grid':
    default: {
      const cw = col(2);
      const rh = row(2);
      return [
        { x: ix, y: iy, w: cw, h: rh },
        { x: ix + cw + g, y: iy, w: cw, h: rh },
        { x: ix, y: iy + rh + g, w: cw, h: rh },
        { x: ix + cw + g, y: iy + rh + g, w: cw, h: rh },
      ];
    }
  }
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan.
 *  The pan is clamped so the photo always covers the panel — no bare edges. */
export function drawPhotoInto(ctx, img, rect, zoom, ox, oy) {
  if (!img || !img.naturalWidth) return;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxOx = Math.max(0, (dw - rect.w) / 2) / rect.w;
  const maxOy = Math.max(0, (dh - rect.h) / 2) / rect.h;
  const px = Math.max(-maxOx, Math.min(maxOx, ox));
  const py = Math.max(-maxOy, Math.min(maxOy, oy));
  const dx = rect.x + (rect.w - dw) / 2 + px * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + py * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Applies a grade's colour overlays over a panel rect (already clipped). */
function gradePanel(ctx, rect, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  for (const layer of grade.overlays) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.35, rect.y + rect.h);
    for (const [at, color] of layer.stops) grad.addColorStop(at, color);
    ctx.globalCompositeOperation = layer.blend;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

/** A 128 px tile of random grey noise, reused as the grain pattern. */
let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 160);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

/** Fits the caption to one line inside maxWidth by shrinking the font. */
function fitFont(ctx, text, maxWidth, startPx, family, weight = '') {
  let px = startPx;
  const set = () => { ctx.font = `${weight} ${px}px ${family}`; };
  set();
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px = Math.floor(px * 0.92);
    set();
  }
  return px;
}

/** The title block: neon rule, Pacifico subtitle, big Anton caption, tiny tag line. */
function drawTitleBlock(ctx, state, W, H, titleY, titleH, grade, { band = true } = {}) {
  const cx = W / 2;
  if (band) {
    // Deep ink band with a neon top rule.
    const bandGrad = ctx.createLinearGradient(0, titleY, 0, titleY + titleH);
    bandGrad.addColorStop(0, '#1c0a2e');
    bandGrad.addColorStop(1, '#0d0518');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, titleY, W, titleH);
    const rule = ctx.createLinearGradient(0, 0, W, 0);
    rule.addColorStop(0, grade.accent);
    rule.addColorStop(0.5, '#ff5da2');
    rule.addColorStop(1, '#ffd166');
    ctx.fillStyle = rule;
    ctx.fillRect(0, titleY, W, Math.max(4, Math.round(H * 0.004)));
  }

  const caption = (state.caption || 'Sunset Heist').toUpperCase();
  const subtitle = state.subtitle || '';
  const tag = 'NEON COAST  ·  EST. 2026';

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Subtitle in neon script, glowing.
  if (subtitle.trim()) {
    const subPx = fitFont(ctx, subtitle, W * 0.62, Math.round(titleH * 0.24), '"Pacifico", cursive');
    ctx.save();
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = Math.round(subPx * 0.45);
    ctx.fillStyle = '#ff8fc0';
    ctx.fillText(subtitle, cx, titleY + titleH * 0.17);
    ctx.restore();
  }
  // Caption in heavy condensed caps, sunset gradient fill, ink outline, slight tilt.
  const capPx = fitFont(ctx, caption, W * 0.9, Math.round(titleH * 0.52), '"Anton", "Arial Black", sans-serif');
  try { ctx.letterSpacing = `${Math.max(1, Math.round(capPx * 0.02))}px`; } catch { /* older canvas: no letter-spacing */ }
  const capGrad = ctx.createLinearGradient(0, titleY + titleH * 0.3, 0, titleY + titleH * 0.88);
  grade.title.forEach((c, i) => capGrad.addColorStop(i / (grade.title.length - 1), c));
  ctx.save();
  ctx.translate(cx, titleY + titleH * 0.58);
  ctx.rotate(-0.018);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0d0518';
  ctx.lineWidth = Math.max(3, Math.round(capPx * 0.07));
  ctx.strokeText(caption, 0, 0);
  ctx.fillStyle = capGrad;
  ctx.fillText(caption, 0, 0);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  // Tiny tag line.
  ctx.font = `600 ${Math.max(11, Math.round(H * 0.011))}px "Arial", sans-serif`;
  ctx.fillStyle = 'rgba(255,179,217,0.85)';
  try { ctx.letterSpacing = `${Math.max(2, Math.round(H * 0.004))}px`; } catch { /* ignore */ }
  ctx.fillText(tag, cx, titleY + titleH * 0.92);
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  ctx.restore();
}

/** The badge ribbon: a tilted white pill that brands the cover. */
function drawBadge(ctx, W, H, grade) {
  const bw = Math.round(W * 0.24);
  const bh = Math.round(H * 0.038);
  const bx = Math.round(W * 0.03);
  const by = Math.round(H * 0.035);
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh / 2);
  ctx.rotate(0.05);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.round(H * 0.012);
  ctx.shadowOffsetY = Math.round(H * 0.004);
  ctx.fillStyle = '#fff8ea';
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#14081f';
  ctx.font = `${Math.round(bh * 0.52)}px "Anton", "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.max(1, Math.round(bh * 0.06))}px`; } catch { /* ignore */ }
  ctx.fillText('★ NEON COAST', 0, 1);
  ctx.restore();
}

/**
 * Renders the whole cover for `state` onto `ctx` at W x H.
 * state: { caption, subtitle, layout, grade, grain, vignette, badge,
 *          panels: [{ img, zoom, ox, oy }], selected }
 */
export function renderCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const fullBleed = state.layout === 'full-bleed';
  const titleH = fullBleed ? 0 : Math.round(H * (W >= H * 1.5 ? 0.26 : 0.20));
  const panelArea = { x: 0, y: 0, w: W, h: H - titleH };
  const rects = layoutPanels(state.layout, panelArea);

  // Paper-white poster base; gutters read as poster board.
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f6efe3';
  ctx.fillRect(0, 0, W, H);

  // Panels: photo, grade, ink keyline. Rotated snapshots get a white frame first.
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const panel = state.panels[i] ?? state.panels[0];
    if (!panel || !panel.img) continue;
    ctx.save();
    // Photos are drawn in the panel's own frame: absolute coordinates for a
    // straight panel, panel-local coordinates once a snapshot is rotated.
    const local = rect.rot
      ? { x: 0, y: 0, w: rect.w, h: rect.h }
      : rect;
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      ctx.fillStyle = '#fffdf6';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = Math.round(H * 0.015);
      ctx.shadowOffsetY = Math.round(H * 0.006);
      const pad = Math.round(Math.min(rect.w, rect.h) * 0.05);
      ctx.fillRect(-pad, -pad, rect.w + 2 * pad, rect.h + 2 * pad);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.rect(0, 0, rect.w, rect.h);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
    }
    ctx.filter = grade.filter;
    drawPhotoInto(ctx, panel.img, local, panel.zoom, panel.ox, panel.oy);
    ctx.filter = 'none';
    gradePanel(ctx, local, grade);
    ctx.restore();
    // Ink keyline around the panel.
    if (!rect.rot) {
      ctx.save();
      ctx.strokeStyle = '#14081f';
      ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.003));
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  // Title block, or title straight over a full-bleed photo.
  if (fullBleed) {
    const bandH = Math.round(H * 0.30);
    const bandY = H - bandH;
    const shade = ctx.createLinearGradient(0, bandY - Math.round(H * 0.12), 0, H);
    shade.addColorStop(0, 'rgba(13,5,24,0)');
    shade.addColorStop(1, 'rgba(13,5,24,0.88)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, bandY - Math.round(H * 0.12), W, bandH + Math.round(H * 0.12));
    drawTitleBlock(ctx, state, W, H, bandY, bandH, grade, { band: false });
  } else {
    drawTitleBlock(ctx, state, W, H, H - titleH, titleH, grade);
  }

  if (state.badge) drawBadge(ctx, W, H, grade);

  // Vignette: darkened corners pull the eye to the middle.
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(10,0,20,0)');
    vg.addColorStop(1, 'rgba(10,0,20,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // Grain: film grain over everything, poster-print feel.
  if (state.grain) {
    const pattern = grainPattern(ctx);
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Outer poster edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(20,8,31,0.9)';
  ctx.lineWidth = Math.max(3, Math.round(Math.min(W, H) * 0.004));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();
}
