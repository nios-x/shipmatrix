/**
 * On-device parcel measurement from a photo — no reference object.
 *
 * A small, dependency-free vision model: no network, no ML runtime, so it runs
 * in Expo Go and on low-end Android phones alike.
 *
 * Pixels alone have no absolute scale — a small box close up and a big box far
 * away photograph the same — so the scale comes from how the photo was taken:
 * the phone is held flat (the in-app level makes sure of it) at a known height
 * above the floor. With the lens focal length, one pixel then covers a known
 * number of centimetres on the floor. The model:
 *
 * 1. Learns the floor's colours from the edge of the photo.
 * 2. Marks everything unlike the floor — forgiving the box's own shadow — and
 *    keeps the largest region that sits wholly inside the frame, favouring the
 *    middle, where the seller aimed.
 * 3. Relearns that region's own colours and re-cuts its edge, which follows a
 *    box whose cardboard is close to the floor colour.
 * 4. Maps the region's outline onto the floor in centimetres.
 *
 * The top of a box is closer to the camera than the floor, so it looks bigger
 * than it is. That is corrected in `solveParcel` once the box's height is
 * known from a true side view (`measureSide`), which reads height as a
 * proportion of length.
 *
 * Accuracy follows the height: a phone held 10 cm off the assumed height reads
 * about 8% off. Results are estimates and are shown as such.
 *
 * Pure TypeScript with no imports, so it can be exercised headlessly.
 */

export type Point = { x: number; y: number };

export interface RgbaImage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/** How the photo was taken — the source of the scale. */
export interface CaptureInfo {
  /** 35 mm-equivalent focal length of the lens. */
  focal35mm: number;
  /** Height of the camera above the floor, cm. */
  cameraHeight: number;
}

/** What one photo tells us: the parcel's outline on the floor and where the camera was. */
export interface FaceReading {
  /** The parcel's silhouette on the floor: a convex polygon, in cm. */
  outline: Point[];
  /** The floor point straight below the camera, in the same coordinates. */
  nadir: Point;
  /** Camera height above the floor, cm. */
  cameraHeight: number;
  /** The parcel's outline in image pixels, for drawing over the analysed photo. */
  overlay: { width: number; height: number; parcel: Point[] };
}

/**
 * What the side photo tells us: the front face's proportions. Photographed
 * head-on with the camera level and between the box's top and bottom, that
 * face is parallel to the sensor, and a plane parallel to the sensor keeps its
 * true shape at any distance — so height ÷ length needs no scale at all.
 */
export interface SideReading {
  /** Front face height ÷ width, as photographed. */
  aspect: number;
  /** The front face's outline in image pixels, for drawing over the photo. */
  overlay: { width: number; height: number; parcel: Point[] };
}

export type VisionFailure = 'no-parcel' | 'parcel-cut' | 'too-close' | 'side-too-high';

export type FaceResult = { ok: true; reading: FaceReading } | { ok: false; reason: VisionFailure };
export type SideResult = { ok: true; reading: SideReading } | { ok: false; reason: VisionFailure };

export const VISION_MESSAGES: Record<VisionFailure, string> = {
  'no-parcel':
    'Couldn’t pick out the box. Try a plain floor that contrasts with it, in even light.',
  'parcel-cut': 'Part of the box is outside the photo. Hold the phone a little higher.',
  'too-close': 'The box fills the photo. Step back so there is space around it.',
  'side-too-high': 'Crouch lower, so the line across the viewfinder crosses the box.',
};

/** Diagonal of a 36 × 24 mm frame — the reference for "35 mm equivalent" focal lengths. */
const FULL_FRAME_DIAGONAL_MM = 43.2666;
/** A typical phone main camera, used when the photo carries no focal length. */
export const DEFAULT_FOCAL_35MM = 26;
/** Chest height for a standing adult holding a phone flat in front of them. */
export const DEFAULT_CAMERA_HEIGHT_CM = 120;

/* ─── Colour ─────────────────────────────────────────── */

const SRGB_TO_LINEAR = (() => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

function toLab(img: RgbaImage) {
  const n = img.width * img.height;
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const d = img.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = SRGB_TO_LINEAR[d[p]!]!;
    const g = SRGB_TO_LINEAR[d[p + 1]!]!;
    const b = SRGB_TO_LINEAR[d[p + 2]!]!;
    const fx = labF((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const fy = labF(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const fz = labF((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    L[i] = 116 * fy - 16;
    A[i] = 500 * (fx - fy);
    B[i] = 200 * (fy - fz);
  }
  return { L, A, B };
}

/* ─── Masks ──────────────────────────────────────────── */

/** 3×3 dilation (grow = true) or erosion, done as two separable passes. */
function morph(mask: Uint8Array, w: number, h: number, grow: boolean): Uint8Array {
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  const hit = grow ? 1 : 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const l = x > 0 ? mask[i - 1] : mask[i];
      const r = x < w - 1 ? mask[i + 1] : mask[i];
      tmp[i] = mask[i] === hit || l === hit || r === hit ? hit : 1 - hit;
    }
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const u = y > 0 ? tmp[i - w] : tmp[i];
      const dn = y < h - 1 ? tmp[i + w] : tmp[i];
      out[i] = tmp[i] === hit || u === hit || dn === hit ? hit : 1 - hit;
    }
  }
  return out;
}

const open = (m: Uint8Array, w: number, h: number) => morph(morph(m, w, h, false), w, h, true);
const close = (m: Uint8Array, w: number, h: number) => morph(morph(m, w, h, true), w, h, false);

interface Component {
  label: number;
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  touchesBorder: boolean;
}

/** 4-connected components. Labels start at 1; 0 is background. */
function components(mask: Uint8Array, w: number, h: number, minArea: number) {
  const labels = new Int32Array(mask.length);
  const stack = new Int32Array(mask.length);
  const found: Component[] = [];
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const c: Component = {
      label: next,
      area: 0,
      minX: w,
      maxX: 0,
      minY: h,
      maxY: 0,
      touchesBorder: false,
    };
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % w;
      const y = (i - x) / w;
      c.area++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.touchesBorder = true;
      if (x > 0 && mask[i - 1] && !labels[i - 1]) {
        labels[i - 1] = next;
        stack[top++] = i - 1;
      }
      if (x < w - 1 && mask[i + 1] && !labels[i + 1]) {
        labels[i + 1] = next;
        stack[top++] = i + 1;
      }
      if (y > 0 && mask[i - w] && !labels[i - w]) {
        labels[i - w] = next;
        stack[top++] = i - w;
      }
      if (y < h - 1 && mask[i + w] && !labels[i + w]) {
        labels[i + w] = next;
        stack[top++] = i + w;
      }
    }
    if (c.area >= minArea) found.push(c);
    next++;
  }
  return { labels, found };
}

/* ─── Geometry ───────────────────────────────────────── */

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Convex hull, counter-clockwise, by monotone chain. */
function convexHull(points: Point[]): Point[] {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function polygonArea(poly: Point[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Outline of a labelled region: the outer pixel corners of each row's extremes. */
function regionOutline(labels: Int32Array, w: number, c: Component): Point[] {
  const pts: Point[] = [];
  for (let y = c.minY; y <= c.maxY; y++) {
    const row = y * w;
    let lo = -1;
    let hi = -1;
    for (let x = c.minX; x <= c.maxX; x++) {
      if (labels[row + x] === c.label) {
        if (lo < 0) lo = x;
        hi = x;
      }
    }
    if (lo < 0) continue;
    pts.push({ x: lo, y }, { x: lo, y: y + 1 }, { x: hi + 1, y }, { x: hi + 1, y: y + 1 });
  }
  return convexHull(pts);
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Minimum-area enclosing rectangle of a convex polygon, by testing each edge direction. */
function minAreaRect(hull: Point[]) {
  let best: {
    area: number;
    ux: number;
    uy: number;
    u: [number, number];
    v: [number, number];
  } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const len = dist(a, b);
    if (len < 1e-9) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const p of hull) {
      const pu = p.x * ux + p.y * uy;
      const pv = -p.x * uy + p.y * ux;
      if (pu < uMin) uMin = pu;
      if (pu > uMax) uMax = pu;
      if (pv < vMin) vMin = pv;
      if (pv > vMax) vMax = pv;
    }
    const area = (uMax - uMin) * (vMax - vMin);
    if (!best || area < best.area) best = { area, ux, uy, u: [uMin, uMax], v: [vMin, vMax] };
  }
  if (!best) return null;
  const { ux, uy, u, v } = best;
  const at = (pu: number, pv: number): Point => ({ x: pu * ux - pv * uy, y: pu * uy + pv * ux });
  return {
    ux,
    uy,
    u,
    v,
    corners: [at(u[0], v[0]), at(u[1], v[0]), at(u[1], v[1]), at(u[0], v[1])],
  };
}

/** Lightness counts half as much as colour, so shadows stay close to what they fall on. */
function colourDistance(c: number[], L: Float32Array, A: Float32Array, B: Float32Array, i: number) {
  return Math.sqrt((L[i]! - c[0]!) ** 2 * 0.25 + (A[i]! - c[1]!) ** 2 + (B[i]! - c[2]!) ** 2);
}

function nearestColour(
  centres: number[][],
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  i: number
) {
  let d = Infinity;
  for (const c of centres) d = Math.min(d, colourDistance(c, L, A, B, i));
  return d;
}

/**
 * Distance to the floor, forgiving shadow. A shadow is the same surface, only
 * darker, with its colour dimmed in proportion — so being darker than a floor
 * colour costs little, while a change of hue (brown cardboard on grey tiles)
 * still counts in full. Without this a box's own shadow is measured as box.
 */
function floorDistance(
  centres: number[][],
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  i: number
) {
  let best = Infinity;
  for (const c of centres) {
    const l = L[i]!;
    let d: number;
    if (l < c[0]! && c[0]! > 1) {
      const dim = Math.max(0.2, l / c[0]!);
      d = Math.sqrt(
        ((c[0]! - l) * 0.12) ** 2 + (A[i]! - c[1]! * dim) ** 2 + (B[i]! - c[2]! * dim) ** 2
      );
    } else {
      d = colourDistance(c, L, A, B, i);
    }
    best = Math.min(best, d);
  }
  return best;
}

/** Three k-means colour centres summarising a set of pixels. */
function colourCentres(
  pixels: number[],
  L: Float32Array,
  A: Float32Array,
  B: Float32Array
): number[][] {
  if (pixels.length < 20) return [];
  const sorted = pixels.slice().sort((a, b) => L[a]! - L[b]!);
  const centres = [0.15, 0.5, 0.85].map((p) => {
    const i = sorted[Math.floor(p * (sorted.length - 1))]!;
    return [L[i]!, A[i]!, B[i]!];
  });
  const stride = Math.max(1, Math.floor(pixels.length / 4000));
  for (let iter = 0; iter < 6; iter++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < pixels.length; p += stride) {
      const i = pixels[p]!;
      let bestK = 0;
      let bestD = Infinity;
      for (let k = 0; k < centres.length; k++) {
        const d = colourDistance(centres[k]!, L, A, B, i);
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      const s = sums[bestK]!;
      s[0]! += L[i]!;
      s[1]! += A[i]!;
      s[2]! += B[i]!;
      s[3]! += 1;
    }
    sums.forEach((s, k) => {
      if (s[3]! > 0) centres[k] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    });
  }
  return centres;
}

/* ─── Model ──────────────────────────────────────────── */

/**
 * Picks the parcel among candidate regions: the biggest one fully inside the
 * frame, weighted towards the centre of the photo, where the seller aimed.
 */
function pickParcel(found: Component[], w: number, h: number) {
  let best: Component | null = null;
  let bestScore = 0;
  let largestAtEdge = 0;
  for (const c of found) {
    if (c.touchesBorder) {
      largestAtEdge = Math.max(largestAtEdge, c.area);
      continue;
    }
    const cx = (c.minX + c.maxX) / 2 / w - 0.5;
    const cy = (c.minY + c.maxY) / 2 / h - 0.5;
    const score = c.area / (1 + 2 * Math.hypot(cx, cy));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { best, largestAtEdge };
}

type Segmented = { ok: true; outline: Point[] } | { ok: false; reason: VisionFailure };

/**
 * Finds the parcel in a photo and returns its outline in image pixels. Shared
 * by both views: "background" is whatever surrounds the box at the photo's
 * edges — floor from above, floor and wall from the side.
 */
function segmentParcel(img: RgbaImage): Segmented {
  const { width: w, height: h } = img;
  const n = w * h;
  const { L, A, B } = toLab(img);

  // Background colours, sampled from the photo's edges.
  const border: number[] = [];
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && y >= ring && x < w - ring && y < h - ring) continue;
      border.push(y * w + x);
    }
  }
  const floor = colourCentres(border, L, A, B);
  if (floor.length === 0) return { ok: false, reason: 'no-parcel' };

  // Pass 1, with hysteresis. Pixels clearly unlike the floor seed the parcel —
  // on a brown box over a brown floor that may be only its label and tape — and
  // the region then grows through anything even faintly unlike the floor. How
  // faint is learned from how much the floor itself varies around the edge.
  const distance = new Float32Array(n);
  for (let i = 0; i < n; i++) distance[i] = floorDistance(floor, L, A, B, i);
  const borderSpread = new Float32Array(border.length);
  border.forEach((i, k) => (borderSpread[k] = distance[i]!));
  borderSpread.sort();
  const strong = 14;
  const weak = Math.min(
    strong,
    Math.max(5, borderSpread[Math.floor(borderSpread.length * 0.9)]! * 2.2)
  );

  let candidate: Uint8Array = new Uint8Array(n);
  for (let i = 0; i < n; i++) candidate[i] = distance[i]! > weak ? 1 : 0;
  candidate = open(candidate, w, h);
  const grown = components(candidate, w, h, 1);
  const seeded = new Uint8Array(grown.labels.length ? grown.found.length + 2 + n : 1);
  for (let i = 0; i < n; i++) {
    if (candidate[i] && distance[i]! > strong) seeded[grown.labels[i]!] = 1;
  }
  let rough: Uint8Array = new Uint8Array(n);
  for (let i = 0; i < n; i++) rough[i] = candidate[i] && seeded[grown.labels[i]!] ? 1 : 0;
  rough = close(rough, w, h);
  const first = components(rough, w, h, n * 0.004);
  const { best: seed, largestAtEdge } = pickParcel(first.found, w, h);
  // A big region running off the frame is most likely the parcel, cut off —
  // measuring the next-biggest thing instead would report a wrong size.
  if (largestAtEdge > Math.max(n * 0.03, seed?.area ?? 0))
    return { ok: false, reason: 'parcel-cut' };
  if (!seed) return { ok: false, reason: 'no-parcel' };

  // Pass 2: learn the parcel's own colours from that region and re-cut its
  // edge nearby, pixel by pixel, parcel-or-floor — whichever it is closer to.
  const seedPixels: number[] = [];
  for (let i = 0; i < n; i++) if (first.labels[i] === seed.label) seedPixels.push(i);
  const parcel = colourCentres(seedPixels, L, A, B);
  const pad = Math.round(Math.max(seed.maxX - seed.minX, seed.maxY - seed.minY) * 0.15) + 2;
  const x0 = Math.max(0, seed.minX - pad);
  const x1 = Math.min(w - 1, seed.maxX + pad);
  const y0 = Math.max(0, seed.minY - pad);
  const y1 = Math.min(h - 1, seed.maxY + pad);
  let fine: Uint8Array = new Uint8Array(n);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      fine[i] = nearestColour(parcel, L, A, B, i) < distance[i]! ? 1 : 0;
    }
  }
  fine = close(open(fine, w, h), w, h);
  const second = components(fine, w, h, n * 0.004);
  // Keep the re-cut region that contains the seed's centre.
  const seedCentre =
    Math.round((seed.minY + seed.maxY) / 2) * w + Math.round((seed.minX + seed.maxX) / 2);
  let region = second.found.find((c) => c.label === second.labels[seedCentre]) ?? null;
  if (!region || region.touchesBorder) region = null;

  const labels = region ? second.labels : first.labels;
  const chosen = region ?? seed;
  if ((chosen.maxX - chosen.minX) / w > 0.9 || (chosen.maxY - chosen.minY) / h > 0.9) {
    return { ok: false, reason: 'too-close' };
  }
  return { ok: true, outline: regionOutline(labels, w, chosen) };
}

/** Top view: the phone flat above the box, at a known height. */
export function measureFace(img: RgbaImage, capture: CaptureInfo): FaceResult {
  const { width: w, height: h } = img;
  // Scale: a level camera `D` cm above the floor sees `D / f` cm per pixel.
  const f = (Math.hypot(w, h) * capture.focal35mm) / FULL_FRAME_DIAGONAL_MM;
  const cmPerPx = capture.cameraHeight / f;
  const toFloor = (p: Point): Point => ({ x: (p.x - w / 2) * cmPerPx, y: (p.y - h / 2) * cmPerPx });
  const toImage = (p: Point): Point => ({ x: p.x / cmPerPx + w / 2, y: p.y / cmPerPx + h / 2 });

  const found = segmentParcel(img);
  if (!found.ok) return found;

  const onFloor = convexHull(found.outline.map(toFloor));
  const rect = minAreaRect(onFloor);
  if (!rect) return { ok: false, reason: 'no-parcel' };
  const sideU = rect.u[1] - rect.u[0];
  const sideV = rect.v[1] - rect.v[0];
  // Smaller than a matchbox is a stray mark, not a parcel.
  if (Math.min(sideU, sideV) < 2.5 || Math.max(sideU, sideV) > 300) {
    return { ok: false, reason: 'no-parcel' };
  }

  return {
    ok: true,
    reading: {
      outline: onFloor,
      nadir: { x: 0, y: 0 },
      cameraHeight: capture.cameraHeight,
      overlay: { width: w, height: h, parcel: rect.corners.map(toImage) },
    },
  };
}

/** How far from level the side camera may be when judging where its horizon is. */
const SIDE_LEVEL_TOLERANCE_DEG = 6;

/**
 * Side view: the phone upright and level, facing the box's long side, held
 * between the box's top and bottom. A level camera's horizon runs across the
 * middle of the frame at the camera's own height, so a box that straddles
 * that line was shot from below its top edge and only its front face shows.
 * A box entirely below the line was shot from above — its top face would
 * inflate the height — and is sent back for a lower shot.
 */
export function measureSide(img: RgbaImage, focal35mm: number): SideResult {
  const { width: w, height: h } = img;
  const found = segmentParcel(img);
  if (!found.ok) return found;

  // A phone rolled a few degrees tips the face in the frame, and an upright
  // bounding box around a tipped rectangle is too tall. Fit the rectangle
  // itself; its more horizontal side is the face's width.
  const rect = minAreaRect(convexHull(found.outline));
  if (!rect) return { ok: false, reason: 'no-parcel' };
  const uHorizontal = Math.abs(rect.ux) >= Math.abs(rect.uy);
  const faceWidth = uHorizontal ? rect.u[1] - rect.u[0] : rect.v[1] - rect.v[0];
  const faceHeight = uHorizontal ? rect.v[1] - rect.v[0] : rect.u[1] - rect.u[0];
  if (faceWidth < 8 || faceHeight < 4) return { ok: false, reason: 'no-parcel' };

  const f = (Math.hypot(w, h) * focal35mm) / FULL_FRAME_DIAGONAL_MM;
  const slack = f * Math.tan((SIDE_LEVEL_TOLERANCE_DEG * Math.PI) / 180);
  const top = Math.min(...rect.corners.map((c) => c.y));
  if (top > h / 2 + slack) return { ok: false, reason: 'side-too-high' };

  return {
    ok: true,
    reading: {
      aspect: faceHeight / faceWidth,
      overlay: { width: w, height: h, parcel: rect.corners },
    },
  };
}

/* ─── Solving the box ────────────────────────────────── */

/**
 * The true extent of a box along one axis, from its silhouette's extent.
 *
 * Seen from above, a box's top face — `raised` cm above the floor — appears
 * magnified about the camera's nadir by k = D / (D − raised), while its
 * footprint appears true to size; the silhouette spans both. So each end is
 * unwound on its own: an end lying beyond the nadir was drawn by the magnified
 * top and is pulled back in, an end on the near side is the footprint's own.
 */
function unwind(min: number, max: number, nadir: number, k: number): [number, number] {
  const lo = min >= nadir ? min : nadir + (min - nadir) / k;
  const hi = max <= nadir ? max : nadir + (max - nadir) / k;
  return [lo, hi];
}

/**
 * The top face's two sides, given how high it sat above the floor.
 *
 * A box photographed off-centre shows a side wall too, so its silhouette is a
 * hexagon, and the smallest rectangle around a hexagon can come out rotated
 * away from the box and too big. Instead, each orientation suggested by the
 * silhouette's edges is tried: unwind a box along it, redraw the silhouette
 * that box would cast, and keep the orientation whose box casts the tightest
 * one. With nothing raised this is exactly the minimum-area rectangle.
 */
function faceDims(face: FaceReading, raised: number): [number, number] {
  const D = face.cameraHeight;
  const hRaised = Math.min(Math.max(raised, 0), D * 0.85);
  const k = hRaised > 0 ? D / (D - hRaised) : 1;
  const { outline, nadir } = face;
  const tried: number[] = [];
  let best: { area: number; a: number; b: number } | null = null;

  for (let i = 0; i < outline.length; i++) {
    const p = outline[i]!;
    const q = outline[(i + 1) % outline.length]!;
    if (dist(p, q) < 1e-6) continue;
    const quarter = Math.PI / 2;
    const theta = ((Math.atan2(q.y - p.y, q.x - p.x) % quarter) + quarter) % quarter;
    if (tried.some((t) => Math.abs(t - theta) < 0.004 || Math.abs(t - theta) > quarter - 0.004))
      continue;
    tried.push(theta);

    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const o of outline) {
      const u = o.x * ux + o.y * uy;
      const v = -o.x * uy + o.y * ux;
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
    const nu = nadir.x * ux + nadir.y * uy;
    const nv = -nadir.x * uy + nadir.y * ux;
    const [u0, u1] = unwind(uMin, uMax, nu, k);
    const [v0, v1] = unwind(vMin, vMax, nv, k);
    if (u1 <= u0 || v1 <= v0) continue;

    const toPlane = (u: number, v: number): Point => ({ x: u * ux - v * uy, y: u * uy + v * ux });
    const footprint = [toPlane(u0, v0), toPlane(u1, v0), toPlane(u1, v1), toPlane(u0, v1)];
    const top = footprint.map((f) => ({
      x: nadir.x + (f.x - nadir.x) * k,
      y: nadir.y + (f.y - nadir.y) * k,
    }));
    const area = polygonArea(convexHull(footprint.concat(top)));
    if (!best || area < best.area) best = { area, a: u1 - u0, b: v1 - v0 };
  }

  if (!best) return [0, 0];
  return best.a >= best.b ? [best.a, best.b] : [best.b, best.a];
}

export interface ParcelSize {
  length: number;
  width: number;
  /** Present once the side photo has been read. */
  height?: number;
}

/**
 * Combines the top view and, when present, the side view into length ×
 * width × height.
 *
 * The side view gives height as a proportion of length. The top view gives
 * length — but its top face sits `height` above the floor and looks magnified
 * by it. Each needs the other, so they are solved together; a taller box only
 * shrinks the length a little, so this settles within a few rounds.
 */
export function solveParcel(top: FaceReading, side?: SideReading): ParcelSize {
  let [length, width] = faceDims(top, 0);
  if (!side) return { length, width };

  let height = length * side.aspect;
  for (let round = 0; round < 10; round++) {
    [length, width] = faceDims(top, height);
    height = length * side.aspect;
  }
  return { length, width, height };
}

/** Rounds a measurement to the nearest half centimetre, never below 1 cm. */
export const roundCm = (cm: number) => Math.max(1, Math.round(cm * 2) / 2);
