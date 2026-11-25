/**
 * @fileoverview Argument checks shared by the script vocabulary and the `Painting` API.
 * Each throws a `PaintscriptError` whose message names the function and the field and
 * quotes what it got.
 * @module arguments
 */

import { PaintscriptError, type PaintscriptErrorCode } from './errors.js';

/** An object whose fields have not been checked yet. */
export type Fields = Record<string, unknown>;

/**
 * How far past a bound a number may land and still be read as the bound. Float
 * arithmetic overshoots by a hair (`Math.sin(2 * Math.PI)` is -2.4e-16), and a script
 * computing a pressure or a load that way means the bound.
 */
export const SLACK = 1e-9;

/** Throw `code` with a message that starts with the function it came from. */
export function fail(code: PaintscriptErrorCode, where: string, message: string): never {
  throw new PaintscriptError(code, `${where}: ${message}`);
}

/** JSON would print a non-finite number as null; name it instead, as the prelude does for a script's arguments. */
const nameNonFinite = (_key: string, v: unknown) =>
  typeof v === 'number' && !Number.isFinite(v) ? String(v) : v;

/** A value as an error message quotes it, cut to 60 characters. */
export function shown(v: unknown): string {
  const s = v === undefined ? 'nothing' : (JSON.stringify(v, nameNonFinite) ?? String(v));
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

/** An options object with no keys outside `keys`; absent is `{}`. */
export function options(
  v: unknown,
  where: string,
  keys: readonly string[],
  code: PaintscriptErrorCode,
): Fields {
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v))
    fail(code, where, `expected an options object (got ${shown(v)})`);
  for (const k of Object.keys(v))
    if (!keys.includes(k)) fail(code, where, `unknown option "${k}"; it takes ${keys.join(', ')}`);
  return v as Fields;
}

/** A finite number from `min` to `max`; one within float error of a bound comes back as the bound. */
export function number(
  v: unknown,
  where: string,
  key: string,
  min: number,
  max: number,
  code: PaintscriptErrorCode,
): number {
  if (typeof v !== 'number' || !(v >= min - SLACK && v <= max + SLACK))
    fail(code, where, `${key} must be a number from ${min} to ${max} (got ${shown(v)})`);
  return Math.min(max, Math.max(min, v));
}

/** `number` for a field that may be absent. */
export function optNumber(
  o: Fields,
  key: string,
  where: string,
  min: number,
  max: number,
  code: PaintscriptErrorCode,
): number | undefined {
  return o[key] == null ? undefined : number(o[key], where, key, min, max, code);
}

/** One of `values`. */
export function oneOf<T extends string>(
  v: unknown,
  where: string,
  key: string,
  values: readonly T[],
  code: PaintscriptErrorCode,
): T {
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v))
    fail(code, where, `${key} must be one of ${values.join(', ')} (got ${shown(v)})`);
  return v as T;
}

/** `oneOf` for a field that may be absent. */
export function optEnum<T extends string>(
  o: Fields,
  key: string,
  values: readonly T[],
  where: string,
  code: PaintscriptErrorCode,
): T | undefined {
  return o[key] == null ? undefined : oneOf(o[key], where, key, values, code);
}

/** A canvas point given as `(x, y)`. */
export function point(args: readonly unknown[], where: string): [number, number] {
  const [x, y] = args;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
    fail('invalid_options', where, `takes (x, y) as finite numbers (got ${shown(args)})`);
  return [x, y];
}
