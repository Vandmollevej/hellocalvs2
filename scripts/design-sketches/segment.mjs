// Auto-segments a UI screenshot into raw layout boxes (image px) for the admin
// designmanual sketches (see build.mjs). Box kinds:
//   surface  – filled area (header, card, button) → recursed into
//   outline  – bordered box with page-coloured inside (input field) → recursed into
//   image    – photo / gradient (many colours) → average colour
//   text     – merged glyphs on one line
//   icon     – other small shapes
//   line     – hairlines, progress bars, scroll indicators
//   status   – iOS status bar clock (left) / icons (right)
import sharp from "sharp";

const TOL = 6; // pixel differs from background

/** @param {string} img image path  @param {number} S image px per CSS px */
export async function segment(img, S) {
  const MIN_SURF = 16 * S; // min surface side
  const MIN_OUT_W = 36 * S, MIN_OUT_H = 24 * S;
  const GX = 4 * S, GY = Math.max(2, Math.round(1.4 * S)); // glyph merge gaps

  const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const R = i => data[i * 3], G = i => data[i * 3 + 1], B = i => data[i * 3 + 2];
  const col = i => (data[i * 3] << 16) | (data[i * 3 + 1] << 8) | data[i * 3 + 2];
  const d = (c1, c2) => Math.max(Math.abs((c1 >> 16) - (c2 >> 16)), Math.abs(((c1 >> 8) & 255) - ((c2 >> 8) & 255)), Math.abs((c1 & 255) - (c2 & 255)));
  const hex = c => '#' + c.toString(16).padStart(6, '0').toUpperCase();

  // page background = most common colour
  const hist = new Map();
  for (let i = 0; i < W * H; i += 7) { const c = col(i); hist.set(c, (hist.get(c) || 0) + 1); }
  // page background: the colour that dominates the left/right edge strips below the top bar
  // (content keeps a margin, so the edges show the page); falls back to the whole image
  const edge = new Map(); let edgeN = 0;
  for (let y = Math.min(H - 1, 110 * S); y < H; y += 2) for (const x of [0, 1, 2, W - 3, W - 2, W - 1]) { const c = col(y * W + x); edge.set(c, (edge.get(c) || 0) + 1); edgeN++; }
  const coverIn = (m, c) => { let n = 0; for (const [k, v] of m) if (d(k, c) <= TOL) n += v; return n; };
  let pageBg = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (edgeN) {
    let best = -1, cand = pageBg;
    for (const [c] of [...edge.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) { const n = coverIn(edge, c); if (n > best) { best = n; cand = c; } }
    if (best >= 0.3 * edgeN) pageBg = cand;
  }

  let bg0 = 0;
  const label = new Int32Array(W * H);
  const excluded = new Uint8Array(W * H);
  let nextLabel = 1;
  const out = [];

  // allowed(i): pixel belongs to region being analysed
  function analyze(rx, ry, rw, rh, bg, allowed, depth) {
    const on = i => allowed(i) && (!respectExcluded || !excluded[i]) && d(col(i), bg) > TOL;
    const comps = [];
    const queue = new Int32Array(rw * rh);
    const myLabels = new Set();
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
      const i0 = y * W + x;
      if (label[i0] >= nextLabelStart && myLabels.has(label[i0])) continue;
      if (!on(i0)) continue;
      const L = nextLabel++; myLabels.add(L);
      let qh = 0, qt = 0; queue[qt++] = i0; label[i0] = L;
      let x0 = x, x1 = x, y0 = y, y1 = y, n = 0;
      while (qh < qt) {
        const i = queue[qh++]; n++;
        const px = i % W, py = (i - px) / W;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = px + dx, ny = py + dy;
          if (nx < rx || ny < ry || nx >= rx + rw || ny >= ry + rh) continue;
          const j = ny * W + nx;
          if (label[j] === L || (label[j] >= nextLabelStart && myLabels.has(label[j]))) continue;
          if (!on(j)) continue;
          label[j] = L; queue[qt++] = j;
        }
      }
      comps.push({ L, x0, y0, x1, y1, n });
    }
    // colour stats
    for (const c of comps) {
      const h = new Map(); let sr = 0, sg = 0, sb = 0;
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
        const i = y * W + x; if (label[i] !== c.L) continue;
        const k = col(i); h.set(k, (h.get(k) || 0) + 1); sr += R(i); sg += G(i); sb += B(i);
      }
      const top = [...h.entries()].sort((a, b) => b[1] - a[1])[0];
      // core colour: most common among the pixels furthest from the background (ignores anti-alias halo)
      let maxD = 0; for (const k of h.keys()) maxD = Math.max(maxD, d(k, bg));
      let core = top[0], coreN = -1; for (const [k, n] of h) if (d(k, bg) >= 0.6 * maxD && n > coreN) { core = k; coreN = n; }
      c.core = core;
      c.top = top[0]; c.share = top[1] / c.n; c.avg = (Math.round(sr / c.n) << 16) | (Math.round(sg / c.n) << 8) | Math.round(sb / c.n);
      c.w = c.x1 - c.x0 + 1; c.h = c.y1 - c.y0 + 1; c.fill = c.n / (c.w * c.h);
    }
    // a thin frame spanning the region (card with an inner border line) is connected to everything inside it:
    // emit it as a bordered box and analyse its inside again without it
    if (depth > 0) {
      const f = comps.filter(c => c.w >= 0.85 * rw && c.h >= 0.85 * rh && c.fill < 0.6).sort((a, b) => b.n - a.n)[0];
      if (f) {
        const along = (x0, y0, dx, dy, len) => { let n = 0; for (let k = 0; k < len; k++) if (label[(y0 + dy * k) * W + x0 + dx * k] === f.L) n++; return n / len; };
        const sides = [along(f.x0, f.y0, 0, 1, f.h), along(f.x1, f.y0, 0, 1, f.h), along(f.x0, f.y0, 1, 0, f.w), along(f.x0, f.y1, 1, 0, f.w)].filter(v => v >= 0.7).length;
        if (sides >= 3) {
          const my = f.y0 + (f.h >> 1);
          let t = 0; while (t < 4 * S && label[my * W + f.x0 + t] === f.L) t++;
          const entry = { kind: 'outline', x: f.x0, y: f.y0, w: f.w, h: f.h, border: hex(col(my * W + f.x0)), borderWidth: Math.max(1, Math.round(t / S)) };
          const r = radiusOf(entry, bg, parseInt(entry.border.slice(1), 16)); if (r) entry.radius = r;
          out.push(entry);
          const pad = t + S, ix = f.x0 + pad, iy = f.y0 + pad, iw = f.w - 2 * pad, ih = f.h - 2 * pad;
          nextLabelStart = nextLabel;
          analyze(ix, iy, iw, ih, bg, allowed, depth + 1);
          const inInner = c => c.x0 >= ix && c.y0 >= iy && c.x1 < ix + iw && c.y1 < iy + ih;
          const rest = comps.filter(c => c !== f && !inInner(c));
          comps.length = 0; comps.push(...rest);
        }
      }
    }
    const content = [];
    for (const c of comps) {
      if (c.n < 3) continue;
      if (c.w >= 0.9 * rw && ((c.h >= 100 * S && c.share < 0.5) || (c.h >= 60 * S && c.fill < 0.75)) && splitBands(c, bg, depth)) continue;
      if (c.w >= 20 * S && c.h >= 20 * S && c.share < 0.35 && c.fill >= 0.7) { emitImage(c); continue; }
      if (c.w >= MIN_SURF && c.h >= MIN_SURF && c.fill >= 0.75 && c.share >= 0.35) { emitSurface(c, bg, depth); continue; }
      if (c.w >= MIN_OUT_W && c.h >= MIN_OUT_H && c.fill < 0.35 && isRing(c)) { emitOutline(c, bg, depth); continue; }
      content.push(c);
    }
    mergeContent(content, bg);
  }
  let nextLabelStart = 1;
  let respectExcluded = true;

  function isRing(c) {
    const t = Math.max(3, Math.round(S * 3));
    let edge = 0;
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
      if (label[y * W + x] !== c.L) continue;
      if (x - c.x0 < t || c.x1 - x < t || y - c.y0 < t || c.y1 - y < t) edge++;
    }
    // must also have pixels on all four sides
    const sides = [[c.x0, c.y0 + (c.h >> 1)], [c.x1, c.y0 + (c.h >> 1)], [c.x0 + (c.w >> 1), c.y0], [c.x0 + (c.w >> 1), c.y1]];
    const hasSides = sides.filter(([x, y]) => { for (let k = -t; k <= t; k++) { const xx = Math.min(c.x1, Math.max(c.x0, x + (x === c.x0 ? k + t : x === c.x1 ? k - t : 0))); const yy = Math.min(c.y1, Math.max(c.y0, y + (y === c.y0 ? k + t : y === c.y1 ? k - t : 0))); if (label[yy * W + xx] === c.L) return true; } return false; }).length >= 3;
    return hasSides && edge >= 0.85 * c.n;
  }

  function tighten(c, colour, parentBg) {
    // trim rows/cols where the surface colour is sparse AND the pixels are soft (shadows, anti-alias);
    // strong pixels (a photo flush with the edge) keep the row/col
    const rows = [], cols = new Array(c.w).fill(0), rowStrong = [], colStrong = new Array(c.w).fill(0), rowN = [], colN = new Array(c.w).fill(0);
    for (let y = c.y0; y <= c.y1; y++) { let n = 0, st = 0, all = 0; for (let x = c.x0; x <= c.x1; x++) { const i = y * W + x; if (label[i] !== c.L) continue; all++; colN[x - c.x0]++; const k = col(i); if (d(k, colour) <= 10) { n++; cols[x - c.x0]++; } else if (d(k, parentBg) > 40) { st++; colStrong[x - c.x0]++; } } rows.push(n); rowStrong.push(st); rowN.push(all); }
    // strong but single-coloured rows/cols are hairline borders → still trimmable
    const uniform = (pixels) => { const h = new Map(); let n = 0; for (const i of pixels) { if (label[i] !== c.L) continue; const k = col(i); if (d(k, parentBg) <= 40) continue; n++; h.set(k, (h.get(k) || 0) + 1); } if (!n) return false; const top = [...h.entries()].sort((a, b) => b[1] - a[1])[0][0]; let near = 0; for (const [k, m] of h) if (d(k, top) <= 24) near += m; return near >= 0.6 * n; };
    const rowPx = y => { const a = []; for (let x = c.x0; x <= c.x1; x++) a.push(y * W + x); return a; };
    const colPx = x => { const a = []; for (let y = c.y0; y <= c.y1; y++) a.push(y * W + x); return a; };
    for (let k = 0; k < rows.length; k++) if (rowStrong[k] >= 0.2 * rowN[k] && rowN[k] >= 0.5 * c.w && !(rows[k] < Math.max(2, 0.02 * Math.max(...rows)) && uniform(rowPx(c.y0 + k)))) rows[k] = 1e9;
    for (let k = 0; k < cols.length; k++) if (colStrong[k] >= 0.2 * colN[k] && colN[k] >= 0.5 * c.h && !(cols[k] < Math.max(2, 0.02 * Math.max(...cols)) && uniform(colPx(c.x0 + k)))) cols[k] = 1e9;
    const rmax = Math.max(...rows.filter(v => v < 1e9), 1), cmax = Math.max(...cols.filter(v => v < 1e9), 1);
    const rt = Math.max(2, 0.02 * rmax), ct = Math.max(2, 0.02 * cmax);
    let a = 0; while (a < rows.length && rows[a] < rt) a++;
    let b = rows.length - 1; while (b > a && rows[b] < rt) b--;
    let l = 0; while (l < cols.length && cols[l] < ct) l++;
    let r = cols.length - 1; while (r > l && cols[r] < ct) r--;
    return { x: c.x0 + l, y: c.y0 + a, w: r - l + 1, h: b - a + 1 };
  }

  function radiusOf(box, bg, colour) {
    // walk each corner's diagonal inward; corners whose first hit is content (a photo) are ignored
    const thr = d(colour, bg) / 2;
    const lim = Math.ceil(0.16 * Math.min(box.w, box.h)) + 2;
    const ts = [];
    for (const [cx, cy, sx, sy] of [[box.x, box.y, 1, 1], [box.x + box.w - 1, box.y, -1, 1], [box.x, box.y + box.h - 1, 1, -1], [box.x + box.w - 1, box.y + box.h - 1, -1, -1]]) {
      const at = k => col((cy + sy * k) * W + cx + sx * k);
      let k = 0, mid = 0; while (k < lim && d(at(k), bg) < thr) { if (d(at(k), bg) > 16) mid++; k++; }
      if (k >= lim || mid > 3) continue;
      if (d(at(k), colour) > 40 && d(at(k + 2), colour) > 40) continue;
      // sub-pixel: where along the diagonal the colour crosses 50 %; pixel centres sit at k + 0.5
      const prev = k > 0 ? d(at(k - 1), bg) : 0, cur = d(at(k), bg);
      const kf = k > 0 ? k - 1 + (thr - prev) / Math.max(1, cur - prev) : 0;
      ts.push(kf + 0.5);
    }
    const rs = ts.map(v => Math.round(v / (1 - Math.SQRT1_2) / S));
    const freq = new Map(); for (const v of rs) freq.set(v, (freq.get(v) || 0) + 1);
    const t = rs.length ? [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0] * (1 - Math.SQRT1_2) * S : 0;
    const r = t / (1 - Math.SQRT1_2) / S;
    const cap = Math.min(box.w, box.h) / 2 / S;
    if (r < 1.5) return undefined;
    return Math.round(Math.min(r, cap));
  }

  // A large full-width component with mixed content (e.g. topbar + logo strip + hero photo that touch):
  // split it into horizontal bands. Rows where one colour covers >= 60 % are flat (surfaces, analysed
  // for children); other rows are busy (photos).
  function splitBands(c, bg, depth) {
    const rowCol = [];
    for (let y = c.y0; y <= c.y1; y++) {
      const h = new Map(); let n = 0;
      for (let x = c.x0; x <= c.x1; x += 2) { const k = col(y * W + x); h.set(k, (h.get(k) || 0) + 1); n++; }
      // UI flats are one exact colour (photos are noisy): flat = the exact colour covers >= 60 % and
      // reaches both edges, or (rows through centred text) both edges are that exact colour at >= 30 %
      const [k, cov] = [...h.entries()].sort((a, b) => b[1] - a[1])[0];
      const e1 = col(y * W + c.x0 + 2), e2 = col(y * W + c.x1 - 2);
      const ecov = e1 === e2 ? h.get(e1) || 0 : 0;
      // a UI row (one exact colour dominates) framed by the same edge colour is that edge colour's band
      rowCol.push(cov >= 0.6 * n && e1 === k && e2 === k ? k : e1 === e2 && (ecov >= 0.3 * n || cov >= 0.6 * n) ? e1 : -1);
    }
    const bands = []; let start = 0;
    for (let i = 1; i <= rowCol.length; i++) {
      const a = rowCol[start], b = rowCol[i];
      const same = i < rowCol.length && a === b;
      if (!same) { bands.push({ y0: c.y0 + start, y1: c.y0 + i - 1, colour: a }); start = i; }
    }
    // busy slivers under 3 css between flat rows are anti-aliasing, not photos
    for (const b of bands) if (b.colour === -1 && b.y1 - b.y0 + 1 < 3 * S) b.colour = rowCol[b.y0 - c.y0 - 1] ?? rowCol[b.y1 - c.y0 + 1] ?? -1;
    // flat slivers under 8 css between busy rows belong to the photo
    for (let i = 0; i < bands.length; i++) { const b = bands[i]; if (b.colour !== -1 && b.y1 - b.y0 + 1 < 8 * S && bands[i - 1]?.colour === -1 && bands[i + 1]?.colour === -1) b.colour = -1; }
    for (let i = bands.length - 1; i > 0; i--) if (bands[i].colour === -1 && bands[i - 1].colour === -1) { bands[i - 1].y1 = bands[i].y1; bands.splice(i, 1); }
    if (!bands.some(b => b.colour !== -1 && b.y1 - b.y0 + 1 >= 20 * S)) return false;
    const L = c.L;
    for (const b of bands) {
      const bh = b.y1 - b.y0 + 1;
      if (b.colour === -1) {
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let y = b.y0; y <= b.y1; y++) for (let x = c.x0; x <= c.x1; x += 2) { const i = y * W + x; sr += R(i); sg += G(i); sb += B(i); n++; }
        out.push({ kind: 'image', x: c.x0, y: b.y0, w: c.w, h: bh, fill: hex((Math.round(sr / n) << 16) | (Math.round(sg / n) << 8) | Math.round(sb / n)) });
      } else if (bh <= 2 * S) {
        if (d(b.colour, bg0) > TOL) out.push({ kind: 'line', x: c.x0, y: b.y0, w: c.w, h: bh, fill: hex(b.colour) });
      } else {
        if (d(b.colour, bg) > TOL) out.push({ kind: 'surface', x: c.x0, y: b.y0, w: c.w, h: bh, fill: hex(b.colour) });
        nextLabelStart = nextLabel;
        const er = S;
        analyze(c.x0, b.y0, c.w, bh, b.colour, i => { const y = (i / W) | 0; return label[i] === L && y - b.y0 >= er && b.y1 - y >= er; }, depth + 1);
      }
    }
    return true;
  }

  function emitImage(c) {
    out.push({ kind: 'image', x: c.x0, y: c.y0, w: c.w, h: c.h, fill: hex(c.avg) });
  }

  function emitSurface(c, parentBg, depth) {
    // the surface colour is what runs along its edges (a bar holding a big black button is still the bar)
    {
      const ins = 3 * S, h = new Map(); let n = 0;
      const add = (x, y) => { if (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1) return; const i = y * W + x; if (label[i] !== c.L) return; const k = col(i); h.set(k, (h.get(k) || 0) + 1); n++; };
      for (let x = c.x0 + ins; x <= c.x1 - ins; x += 2) { add(x, c.y0 + ins); add(x, c.y1 - ins); }
      for (let y = c.y0 + ins; y <= c.y1 - ins; y += 2) { add(c.x0 + ins, y); add(c.x1 - ins, y); }
      if (n) { const [k, m] = [...h.entries()].sort((a, b) => b[1] - a[1])[0]; if (k !== c.top && m >= 0.5 * n) c.top = k; }
    }
    let box = tighten(c, c.top, parentBg);
    const entry = { kind: 'surface', ...box, fill: hex(c.top) };
    // border: strongest non-surface colour in the first scale-px columns (only if tighten trimmed there)
    {
      const my = box.y + (box.h >> 1); let best = null, bd = 0, bestR = null, bdR = 0;
      for (let x = c.x0; x < c.x0 + S; x++) { const k = col(my * W + x); const dd = d(k, c.top); if (dd > bd && d(k, parentBg) >= 48) { bd = dd; best = k; } }
      for (let x = c.x1; x > c.x1 - S; x--) { const k = col(my * W + x); const dd = d(k, c.top); if (dd > bdR && d(k, parentBg) >= 48) { bdR = dd; bestR = k; } }
      if (best !== null && bestR !== null && d(best, bestR) <= 32 && bd > 24 && d(best, parentBg) > 24) { entry.border = hex(best); box = { x: c.x0, y: c.y0, w: c.w, h: c.h }; Object.assign(entry, box); }
    }
    const r = radiusOf(box, parentBg, entry.border ? parseInt(entry.border.slice(1), 16) : c.top); if (r) entry.radius = r;
    out.push(entry);
    // hairlines directly above/below the surface (trimmed rows with one strong colour across the width)
    if (!entry.border) for (const y of [box.y - 1, box.y - 2, box.y + box.h, box.y + box.h + 1]) {
      if (y < c.y0 || y > c.y1) continue;
      const h2 = new Map(); for (let x = box.x; x < box.x + box.w; x++) { const k = col(y * W + x); h2.set(k, (h2.get(k) || 0) + 1); }
      const [k, n] = [...h2.entries()].sort((a, b) => b[1] - a[1])[0];
      if (n >= 0.8 * box.w && d(k, c.top) > 24 && d(k, parentBg) > 24) { out.push({ kind: 'line', x: box.x, y, w: box.w, h: 1, fill: hex(k) }); break; }
    }
    // children: pixels of this component (or its holes) that differ from the surface colour,
    // at least `er` px away from the outside
    const L = c.L, er = Math.max(2, 2 * S);
    const outside = new Uint8Array(c.w * c.h);
    const q = new Int32Array(c.w * c.h); let qh = 0, qt = 0;
    const idx = (x, y) => (y - c.y0) * c.w + (x - c.x0);
    const seed = (x, y) => { const k = idx(x, y); if (!outside[k] && label[y * W + x] !== L) { outside[k] = 1; q[qt++] = k; } };
    for (let x = c.x0; x <= c.x1; x++) { seed(x, c.y0); seed(x, c.y1); }
    for (let y = c.y0; y <= c.y1; y++) { seed(c.x0, y); seed(c.x1, y); }
    while (qh < qt) { const k = q[qh++]; const x = c.x0 + (k % c.w), y = c.y0 + Math.floor(k / c.w);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (nx >= c.x0 && nx <= c.x1 && ny >= c.y0 && ny <= c.y1) seed(nx, ny); }
    // dilate outside by er (separable box)
    const dil = new Uint8Array(c.w * c.h), tmp = new Uint8Array(c.w * c.h);
    for (let y = 0; y < c.h; y++) { let last = -1e9; for (let x = 0; x < c.w; x++) { if (outside[y * c.w + x]) last = x; if (x - last <= er) tmp[y * c.w + x] = 1; } last = 1e9; for (let x = c.w - 1; x >= 0; x--) { if (outside[y * c.w + x]) last = x; if (last - x <= er) tmp[y * c.w + x] = 1; } }
    for (let x = 0; x < c.w; x++) { let last = -1e9; for (let y = 0; y < c.h; y++) { if (tmp[y * c.w + x]) last = y; if (y - last <= er) dil[y * c.w + x] = 1; } last = 1e9; for (let y = c.h - 1; y >= 0; y--) { if (tmp[y * c.w + x]) last = y; if (last - y <= er) dil[y * c.w + x] = 1; } }
    // children stay inside the trimmed box (shadows outside it are not content); image edges are not outside
    const allowed = i => { const x = i % W, y = (i - x) / W; const k = idx(x, y); const nearBox = x - box.x < er || box.x + box.w - 1 - x < er || y - box.y < er || box.y + box.h - 1 - y < er; if (dil[k] || nearBox) { const atEdge = x <= er || y <= er || x >= W - 1 - er || y >= H - 1 - er; if (!atEdge || outside[k]) return false; } return true; };
    // relabel region pixels so they can be claimed by children
    nextLabelStart = nextLabel;
    analyze(c.x0, c.y0, c.w, c.h, c.top, allowed, depth + 1);
  }

  function emitOutline(c, parentBg, depth) {
    // border thickness at mid-left
    const my = c.y0 + (c.h >> 1);
    let t = 0; while (t < 20 && label[my * W + c.x0 + t] === c.L) t++;
    const entry = { kind: 'outline', x: c.x0, y: c.y0, w: c.w, h: c.h, border: hex(c.top), borderWidth: Math.max(1, Math.round(t / S)) };
    const r = radiusOf(entry, parentBg, c.top); if (r) entry.radius = r;
    out.push(entry);
    const pad = t + Math.max(2, S);
    nextLabelStart = nextLabel;
    analyze(c.x0 + pad, c.y0 + pad, Math.max(1, c.w - 2 * pad), Math.max(1, c.h - 2 * pad), parentBg, () => true, depth + 1);
  }

  function mergeContent(list, bg) {
    const parent = list.map((_, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const sorted = list.map((c, i) => i).sort((a, b) => list[a].x0 - list[b].x0);
    for (let a = 0; a < sorted.length; a++) {
      const A = list[sorted[a]];
      for (let b = a + 1; b < sorted.length; b++) {
        const Bc = list[sorted[b]];
        if (Bc.x0 > A.x1 + 40 * S) break;
        if (Bc.y0 > A.y1 + GY || A.y0 > Bc.y1 + GY) continue;
        if (d(A.core, Bc.core) > 60) continue;
        if (Bc.x0 > A.x1 + Math.max(GX, 0.6 * Math.min(A.h, Bc.h))) continue;
        if (Bc.x0 > A.x1 && Math.max(A.h, Bc.h) > 2.5 * Math.min(A.h, Bc.h)) continue;
        parent[find(sorted[a])] = find(sorted[b]);
      }
    }
    // repeat on merged groups until stable (groups may bridge after growth)
    const groups = new Map();
    list.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
    let boxes = [...groups.values()].map(g => {
      const x0 = Math.min(...g.map(c => c.x0)), y0 = Math.min(...g.map(c => c.y0)), x1 = Math.max(...g.map(c => c.x1)), y1 = Math.max(...g.map(c => c.y1));
      const colours = new Map(); for (const c of g) colours.set(c.core, (colours.get(c.core) || 0) + c.n);
      const top = [...colours.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { x0, y0, x1, y1, top, n: g.reduce((s, c) => s + c.n, 0) };
    });
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], Bb = boxes[j];
        const gx = Math.max(GX, 0.6 * (1 + Math.min(A.y1 - A.y0, Bb.y1 - Bb.y0)));
        if (Bb.x0 > A.x1 + gx || A.x0 > Bb.x1 + gx || Bb.y0 > A.y1 + GY || A.y0 > Bb.y1 + GY) continue;
        const ha = A.y1 - A.y0 + 1, hb = Bb.y1 - Bb.y0 + 1;
        if ((Bb.x0 > A.x1 || A.x0 > Bb.x1) && Math.max(ha, hb) > 2.5 * Math.min(ha, hb)) continue;
        if (d(A.top, Bb.top) > 60) continue;
        boxes[i] = { x0: Math.min(A.x0, Bb.x0), y0: Math.min(A.y0, Bb.y0), x1: Math.max(A.x1, Bb.x1), y1: Math.max(A.y1, Bb.y1), top: A.n >= Bb.n ? A.top : Bb.top, n: A.n + Bb.n };
        boxes.splice(j, 1); changed = true; break outer;
      }
    }
    for (const b of boxes) {
      const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
      if (Math.max(w, h) < 3.5 * S) continue;
      if (d(b.top, bg) < 20) continue;
      if ((h <= 2 * S && w >= 20 * S) || (w <= 2 * S && h >= 20 * S) || (h <= 6 * S && w >= 30 * S && w >= 8 * h)) { out.push({ kind: 'line', x: b.x0, y: b.y0, w, h, fill: hex(b.top) }); continue; }
      const textLike = h <= 34 * S && w >= 1.6 * h && w > 14 * S;
      out.push({ kind: textLike ? 'text' : 'icon', x: b.x0, y: b.y0, w, h, fill: hex(b.top) });
    }
  }

  const pre = [];
  const lum = k => (0.2126 * (k >> 16) + 0.7152 * ((k >> 8) & 255) + 0.0722 * (k & 255)) / 255;
  if (S === 3) {
    // "Feedback" tab: dark vertical tab glued to the right edge, <= 16 css wide
    for (let y = 60 * S; y < H; ) {
      if (lum(col(y * W + W - 2)) >= 0.15) { y++; continue; }
      let y2 = y; while (y2 < H && lum(col(y2 * W + W - 2)) < 0.15) y2++;
      if (y2 - y >= 40 * S && y2 - y <= 160 * S) {
        const lefts = [];
        // leftmost dark pixel per row, allowing light text inside the tab (gaps up to 8 css)
        for (let yy = y; yy < y2; yy += 2) { let last = W - 1; for (let x = W - 1; x > W - 60 * S && x > last - 8 * S; x--) if (lum(col(yy * W + x)) < 0.15) last = x; lefts.push(last); }
        lefts.sort((a, b) => a - b);
        const left = lefts[lefts.length >> 1];
        if (W - left <= 40 * S && W - left >= 6 * S) {
          const tabCol = col(((y + y2) >> 1) * W + W - 2);
          for (let yy = y - S; yy < y2 + S; yy++) for (let x = left - S; x < W; x++) if (yy >= 0 && yy < H) excluded[yy * W + x] = 1;
          pre.push({ kind: 'surface', name: 'Feedback-fane', x: left, y, w: W - left, h: y2 - y, fill: hex(tabCol), rect: [left, y, W - left, y2 - y], bg: tabCol });
        }
      }
      y = y2 + 1;
    }
    // scroll indicators: thin vertical bars within 6 css of the right edge, background-like 3 css to their left
    for (let x = W - 1; x >= W - 6 * S; x--) {
      let y = 0;
      while (y < H) {
        const bar = yy => !excluded[yy * W + x] && d(col(yy * W + x), pageBg) > 15 && d(col(yy * W + x - 3 * S), pageBg) <= 8 && d(col(yy * W + x), col(yy * W + x - 3 * S)) > 15;
        if (!bar(y)) { y++; continue; }
        let y2 = y, gap = 0; while (y2 < H && (bar(y2) || gap++ < 3)) { if (bar(y2)) gap = 0; y2++; }
        if (y2 - y >= 30 * S) {
          let x0 = x; while (x0 > W - 8 * S && d(col(((y + y2) >> 1) * W + x0 - 1), pageBg) > 15) x0--;
          if (x - x0 + 1 <= 3 * S) {
            for (let yy = y; yy < y2; yy++) for (let xx = x0; xx <= x; xx++) excluded[yy * W + xx] = 1;
            pre.push({ kind: 'line', name: 'Rullebjælke', x: x0, y, w: x - x0 + 1, h: y2 - y, fill: hex(col(((y + y2) >> 1) * W + x)) });
          }
        }
        y = y2 + 1;
      }
    }
  }
  bg0 = pageBg;
  analyze(0, 0, W, H, pageBg, i => !excluded[i], 0);
  for (const p of pre) {
    const { rect, bg: pbg, ...box } = p;
    out.push(box);
    if (rect) { nextLabelStart = nextLabel; respectExcluded = false; const [rx, ry, rw, rh] = rect; analyze(rx + S, ry + S, rw - S, rh - 2 * S, pbg, () => true, 1); respectExcluded = true; }
  }
  if (S === 3 && W === 1206) {
    const inBar = b => b.y + b.h <= 54 * S && b.kind !== 'surface' && b.kind !== 'line';
    const merged = [];
    for (const side of ['left', 'right']) {
      const group = out.filter(b => inBar(b) && (side === 'left' ? b.x + b.w / 2 < W / 2 : b.x + b.w / 2 >= W / 2));
      if (!group.length) continue;
      const x0 = Math.min(...group.map(b => b.x)), y0 = Math.min(...group.map(b => b.y)), x1 = Math.max(...group.map(b => b.x + b.w)), y1 = Math.max(...group.map(b => b.y + b.h));
      const under = col(Math.max(0, y0 - 4) * W + Math.max(0, x0 - 6));
      const main = group.slice().sort((a, b) => d(parseInt(b.fill.slice(1), 16), under) - d(parseInt(a.fill.slice(1), 16), under))[0];
      merged.push({ kind: 'status', side, x: x0, y: y0, w: x1 - x0, h: y1 - y0, fill: main.fill });
    }
    const first = out.findIndex(inBar);
    const rest = out.filter(b => !inBar(b));
    out.length = 0; out.push(...rest.slice(0, Math.max(0, first)), ...merged, ...rest.slice(Math.max(0, first)));
  }
  // drop content in the same colour as the box it sits on (letter counters, holes)
  const containers = out.filter(b => b.kind === 'surface' || b.kind === 'image');
  const inside = (o, b) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h;
  const visible = out.filter(b => {
    if (b.kind === 'surface' || b.kind === 'image' || b.kind === 'outline' || !b.fill) return true;
    const host = containers.filter(o => o !== b && inside(o, b)).sort((a, c) => a.w * a.h - c.w * c.h)[0];
    const under = host ? parseInt(host.fill.slice(1), 16) : pageBg;
    return d(parseInt(b.fill.slice(1), 16), under) > 12;
  });
  out.length = 0; out.push(...visible);
  const seen = new Set();
  const dedup = out.filter(b => { const key = [b.x, b.y, b.w, b.h].join(','); if (seen.has(key)) return false; seen.add(key); return true; });
  out.length = 0; out.push(...dedup);
  return { width: W, height: H, scale: S, background: hex(pageBg), boxes: out };
}
