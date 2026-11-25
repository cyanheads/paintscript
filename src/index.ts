/**
 * @fileoverview paintscript: paint by code. A `Painting` runs JavaScript passages in a
 * WebAssembly sandbox against simulated oil paint (8-band Kubelka–Munk pigment,
 * bristle-strand brushes, a wet film over a dry base, relief lighting); its journal
 * replays it exactly, to a PNG or a timelapse GIF.
 * @module paintscript
 */

export type { BrushSpec, BrushType } from './brush/brush.js';
export { TEXTURES, type Texture } from './canvas/canvas.js';
export type { Color, ColorInput, OklabColor, RgbColor } from './color/color.js';
export { PaintscriptError, type PaintscriptErrorCode } from './errors.js';
export { decodePng, encodePng } from './image/png.js';
export {
  formatJournal,
  type Journal,
  type JournalHeader,
  type JournalReplayOptions,
  type JournalRun,
  journalOf,
  openJournal,
  parseJournal,
  replayJournal,
} from './journal/journal.js';
export {
  DEFAULT_LIMITS,
  Painting,
  type PaintingLimits,
  type PaintingOptions,
  type ReferenceInfo,
  type ReferenceInput,
  type ReplayOptions,
  type RevertResult,
  type RunEntry,
  type RunOptions,
  type RunReport,
  type RunResult,
  type RunStats,
  type RunStatus,
} from './painting/painting.js';
export type { RunReview, Spread } from './painting/run-review.js';
export {
  type DiffCell,
  type DiffResult,
  REFERENCE_FITS,
  type ReferenceEdge,
  type ReferenceFit,
} from './reference/reference.js';
export { type RgbImage, SURFACES, type Surface } from './render/render.js';
export {
  type Region,
  VIEW_MODES,
  type View,
  type ViewMode,
  type ViewOptions,
} from './render/view.js';
export type { StrokeEvent, StrokeReport } from './script/vocabulary.js';
export { VOCABULARY_DTS } from './script/vocabulary-dts.js';
export { renderTimelapse, type Timelapse, type TimelapseOptions } from './timelapse/timelapse.js';
export { VERSION } from './version.js';
