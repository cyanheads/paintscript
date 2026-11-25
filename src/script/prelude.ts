/**
 * @fileoverview The guest side of the script vocabulary, evaluated before every script
 * in the same global scope: thin wrappers that pass arguments to the host as JSON,
 * the seeded `rand()` and `noise()`, and stubs that make the clock and `Math.random`
 * fail with a pointer to `rand()`, so a script replays exactly.
 * @module script/prelude
 */

/**
 * Guest source. Reads `__host` (functions taking a JSON argument array) and `__config`
 * (`{ seed, noiseSeed, width, height, pxPerMm, reference }`) and deletes both, so a
 * script reaches the host only through the vocabulary.
 */
export const PRELUDE = `(() => {
  'use strict';
  const H = globalThis.__host;
  const C = JSON.parse(globalThis.__config);
  delete globalThis.__host;
  delete globalThis.__config;

  // non-finite numbers would become null in JSON; send them as text so errors can name them
  const replacer = (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
  const call = (name, args) => {
    const out = H[name](JSON.stringify(args, replacer));
    return out === undefined ? undefined : JSON.parse(out);
  };
  const define = (name, value) =>
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });

  define('brush', (name, spec) => call('brush', [name, spec]));
  define('stroke', (spec) => call('stroke', [spec]));
  define('mix', (...parts) => call('mix', parts));
  define('palette', (name, color) => call('palette', [name, color]));
  define('dry', (region) => { call('dry', [region]); });
  define('at', (x, y) => call('at', [x, y]));
  define('wet', (x, y) => call('wet', [x, y]));
  define('height', (x, y) => call('height', [x, y]));
  define('diff', (region, options) => call('diff', [region, options]));
  define('show', (region, options) => { call('show', [region, options]); });
  define('canvas', Object.freeze({ width: C.width, height: C.height, pxPerMm: C.pxPerMm }));
  define('ref', C.reference === null ? null : Object.freeze({
    region: Object.freeze(C.reference),
    at: (x, y) => call('refAt', [x, y]),
    edge: (x, y) => call('refEdge', [x, y]),
  }));

  const text = (v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean' || v === undefined || v === null) return String(v);
    if (typeof v === 'bigint') return v + 'n';
    if (typeof v === 'function') return '[function ' + (v.name || 'anonymous') + ']';
    try { return JSON.stringify(v, replacer) ?? String(v); } catch { return String(v); }
  };
  const log = (...values) => { H.log(JSON.stringify([values.map(text).join(' ')])); };
  define('log', log);
  define('console', Object.freeze({ log, info: log, warn: log, error: log, debug: log }));

  // mulberry32, seeded per run
  let state = C.seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const finite = (where, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new TypeError(where + ' takes finite numbers (got ' + text(v) + ')');
    return v;
  };
  define('rand', (a, b) => {
    if (a === undefined) return next();
    if (b === undefined) return next() * finite('rand(max)', a);
    finite('rand(min, max)', a);
    return a + next() * (finite('rand(min, max)', b) - a);
  });

  // 2D gradient noise on a unit lattice, one field per canvas seed
  const perm = new Uint8Array(512);
  {
    let s = C.noiseSeed >>> 0;
    const r = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const GX = [1, -1, 1, -1, 1, -1, 0, 0];
  const GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  define('noise', (x, y) => {
    finite('noise(x, y)', x);
    finite('noise(x, y)', y);
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const g = (h, dx, dy) => GX[h & 7] * dx + GY[h & 7] * dy;
    const u = fade(xf);
    const v = fade(yf);
    const n00 = g(perm[perm[X] + Y], xf, yf);
    const n10 = g(perm[perm[X + 1] + Y], xf - 1, yf);
    const n01 = g(perm[perm[X] + Y + 1], xf, yf - 1);
    const n11 = g(perm[perm[X + 1] + Y + 1], xf - 1, yf - 1);
    const n = (n00 + (n10 - n00) * u) * (1 - v) + (n01 + (n11 - n01) * u) * v;
    return Math.max(-1, Math.min(1, n));
  });

  // function expressions, so \`new Date()\` reaches the message too
  const unavailable = (what) => function () {
    throw new Error(what + ' is not available in a paintscript: use rand(), which replays exactly');
  };
  Math.random = unavailable('Math.random()');
  const NoDate = unavailable('Date');
  NoDate.now = unavailable('Date.now()');
  define('Date', NoDate);
  delete globalThis.performance;
  delete globalThis.WeakRef;
  delete globalThis.FinalizationRegistry;
})();`;
