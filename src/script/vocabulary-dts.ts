/**
 * @fileoverview The script vocabulary as TypeScript declarations: the exact API a
 * script runs against, in the compact form a model reads best. `paintscript
 * vocabulary` prints it.
 * @module script/vocabulary-dts
 */

/** Declarations for every global a script can use. */
export const VOCABULARY_DTS = `/**
 * paintscript: a script is one passage of painting, plain JavaScript (ES2023) run in a
 * sandbox. There are no imports, timers, I/O, clock, or Math.random; rand() and noise()
 * replay exactly. Coordinates are canvas px, origin top left, y down; angles are
 * radians. A run lands whole or not at all: an uncaught error rolls the canvas back.
 * Brushes and palette colors a run names stay defined for later runs.
 */

/**
 * A color argument: "#rrggbb" or "#rgb"; { r, g, b } (sRGB 0–1, any precision);
 * { l, a, b } (OKLab); a Color the engine returned (passes its exact paint); or the
 * name of a palette color. A string without a leading # is a palette name.
 */
type ColorInput = string | { r: number; g: number; b: number } | { l: number; a: number; b: number } | Color;

/** A color as the engine reports it. \`bands\` is the paint's 8-band reflectance spectrum. */
interface Color {
  hex: string;
  rgb: { r: number; g: number; b: number };
  oklab: { l: number; a: number; b: number };
  bands: number[];
}

/** A rectangle in canvas px. Clipped to the canvas; a region with no pixels on it is an error. */
interface Region { x: number; y: number; w: number; h: number }

/**
 * flat: square, chisel-edged, streaky. round: tapers to a point as pressure falls.
 * filbert: a flat with rounded corners. fan: sparse, wide. splayed: worn, clumped
 * bristles. soft: a smooth sable, no streaks, soft edge, for blended passages. knife:
 * a palette knife: flat thick paint, crisp edges, scrapes up wet paint, skips across
 * the weave when lightly loaded.
 */
type BrushType = 'flat' | 'round' | 'filbert' | 'fan' | 'splayed' | 'soft' | 'knife';

interface BrushSpec {
  type: BrushType;
  /** px, from 0.5 to the canvas's long side. */
  width: number;
  /** 0–1. Stiffer bristles pick up less wet paint. Default 0.6 (knife 1). */
  stiffness?: number;
  /** 0–1. Bristle spread: wobble and clumping. Default 0.2 (soft and knife 0). */
  splay?: number;
  /** 0–1. Streaks, ragged edges, dropped bristles. Default 1 (soft and knife 0). Brushes under ~10 px streak less. */
  streak?: number;
  /** 0–1. Tint variation between bristles. Default 0.5 × streak. */
  toneVar?: number;
  /** Paint each bristle holds, as a multiple of the default (~420 px of stroke at load 1). 0.01–20. Default 1. */
  reservoir?: number;
}

/**
 * opaque: one full-load pass hides what is under it. semi_opaque: some shows through.
 * transparent: mostly a tinted filter. glaze: a transparent film over dry paint.
 * medium: clear, colorless; thins and moves wet paint.
 */
type PaintKind = 'opaque' | 'semi_opaque' | 'transparent' | 'glaze' | 'medium';

interface StrokeOptions {
  /**
   * Control points, [x, y] or [x, y, pressure 0–1]; the stroke follows a smooth curve
   * through them. One point is a dab. At most 10,000 points, no point more than a
   * canvas width or height off the canvas, and at most 20 × (width + height) px long.
   */
  path: Array<[number, number] | [number, number, number]>;
  /** A brush name defined with brush(), or a spec inline. */
  brush: string | BrushSpec;
  /** Paint on the brush. Absent: a clean brush that only moves wet paint. */
  color?: ColorInput;
  /** Default 'opaque'. */
  paint?: PaintKind;
  /** Paint on the brush, 0–1. Below about 0.4 the brush runs dry and skips across the canvas weave; for a thin, even film (a glaze), keep load up and raise thinner. Default 0.7. */
  load?: number;
  /** Pressure where a point gives none, 0–1. Near 0 thins round, soft, and filbert brushes to a point. Default 0.7. */
  pressure?: number;
  /** Solvent in the paint, 0–1: a leaner, more transparent film that picks up more. Default 0. */
  thinner?: number;
  /** lift: tapers out (default). taper: thins to a point. stop: ends square, pressed in. flick: tapers long and thin. */
  end?: 'lift' | 'taper' | 'stop' | 'flick';
  /** How fully the brush meets the surface, 0–1; lower touches only the tops of the canvas weave (scumble, dry brush). Dried paint does not change which tops it catches. Default 1. */
  contact?: number;
  /** Straight segments between points instead of a curve. Default false. */
  corners?: boolean;
  /** Direction of a one-point dab. Default about -0.6 rad, varied a little. */
  angle?: number;
}

interface StrokeResult {
  /** Pixels that took paint. */
  covered: number;
  /** Share (0–1) of the footprint the bristles passed over that took no paint. */
  gaps: number;
  /** Share (0–1) of the wet paint in the painted pixels that is not this stroke's own color: paint it landed in or carried. */
  mixed: number;
  /** Wet paint volume the bristles lifted. */
  pickedUp: number;
  /** Path length in px; 0 for a dab. */
  length: number;
  /** Pixels the stroke changed, or null if none. */
  bbox: Region | null;
}

/** Define (or replace) a named brush. Returns the name. */
declare function brush(name: string, spec: BrushSpec): string;
/** A named brush's spec; brush() lists them all. */
declare function brush(name: string): BrushSpec;
declare function brush(): Record<string, BrushSpec>;

/** Lay one stroke. It mixes with wet paint it crosses and sits cleanly on dry paint. */
declare function stroke(options: StrokeOptions): StrokeResult;

/** Mix paints by parts (Kubelka–Munk, as on a palette): mix(['#1c3f94', 2], '#f2efe6') is 2 parts blue to 1 white. Zero parts leaves a color out. */
declare function mix(...parts: Array<ColorInput | [color: ColorInput, parts: number]>): Color;

/** Name a color (kept across runs; usable wherever a color goes). Returns it. */
declare function palette(name: string, color: ColorInput): Color;
/** A named color; palette() lists them all. */
declare function palette(name: string): Color;
declare function palette(): Record<string, Color>;

/** Dry the wet paint in a region (default: the whole canvas): its color fixes and its relief stays, so later strokes sit on top instead of mixing in. */
declare function dry(region?: Region): void;

/** Paint color at a point, unlit (rounded and clamped to the canvas). */
declare function at(x: number, y: number): Color;
/** Wet paint volume at a point: 0 is dry; a fresh full-load stroke leaves about 0.2. */
declare function wet(x: number, y: number): number;
/** Surface height at a point: weave plus dried and wet paint (weave peaks near 0.1). */
declare function height(x: number, y: number): number;

declare const canvas: { readonly width: number; readonly height: number; readonly pxPerMm: number };

/** The reference image placed on the canvas, or null when the painting has none. Points are canvas px, clamped. */
declare const ref: null | {
  /** Where the image lands on the canvas. */
  readonly region: Region;
  /** Reference color at a point (bilinear), or null where the image doesn't reach. */
  at(x: number, y: number): Color | null;
  /** Which way an edge runs at a point (angle along the contour, -π/2 to π/2) and how sharp it is (OKLab lightness change per px), or null where the image doesn't reach. */
  edge(x: number, y: number): { angle: number; strength: number } | null;
};

/** How far the painting's color is from the reference (OKLab distance), overall and in the worst cells. Needs a reference. */
declare function diff(region?: Region, options?: { /** Cell side in px, 4–4096. Default 32. */ cell?: number }): {
  mean: number;
  worst: Array<Region & { distance: number }>;
  region: Region;
  cell: number;
  samples: number;
  stride: number;
};

/**
 * Add a view of a region (default: the whole canvas) to the run's result, as it looks
 * at this point in the script. color: the painting lit; squint: blurred, for masses;
 * value: lightness only; relief: the paint's surface in grey; wet: where paint is
 * still wet. At most 4 views per run; more are dropped and counted.
 */
declare function show(region?: Region, options?: {
  mode?: 'color' | 'squint' | 'value' | 'relief' | 'wet';
  /** Longest side of the image, 16–4096 px. Default 1024. */
  maxSide?: number;
  /** Default 'satin'. */
  surface?: 'matte' | 'satin' | 'varnish';
  /** Grid lines every this many canvas px; every fifth is stronger. */
  grid?: number;
}): void;

/** Add a line of text to the run's result (values joined by spaces; objects as JSON). console.log is the same. */
declare function log(...values: unknown[]): void;

/** Seeded uniform random: [0, 1), [0, max), or [min, max). */
declare function rand(): number;
declare function rand(max: number): number;
declare function rand(min: number, max: number): number;

/** Smooth gradient noise in [-1, 1] on a unit lattice, the same field for every run of a painting: scale the inputs, e.g. noise(x / 40, y / 40). */
declare function noise(x: number, y: number): number;
`;
