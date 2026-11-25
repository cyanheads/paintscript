/**
 * @fileoverview sRGB transfer functions between encoded (0–1) and linear light (0–1).
 * @module color/srgb
 */

/** Encoded sRGB channel (0–1) to linear light. */
export function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear light channel (0–1) to encoded sRGB (0–1). Values outside 0–1 pass through the curve unclamped. */
export function toSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Linear light channel to an 8-bit encoded value, clamped to 0–255. */
export function linearToByte(c: number): number {
  return Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, c)))) * 255);
}
