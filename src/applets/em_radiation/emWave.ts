import type { Rgb } from "./blackbody";
import { rgbCss } from "./blackbody";

/** Speed of light (m/s). */
export const C_LIGHT = 2.99792458e8;

/** Teaching slider bounds for a monochromatic EM wave (nm). */
export const WAVE_LAMBDA_MIN_NM = 200;
export const WAVE_LAMBDA_MAX_NM = 2000;
export const WAVE_LAMBDA_DEFAULT_NM = 550;

/**
 * How many wavelengths fit across the plot. Shorter λ → more cycles → peaks closer.
 * Inverse in log-λ; range kept dense so schematic λ reads short on the long axis.
 */
export function schematicCyclesOnScreen(lambdaNm: number): number {
  const lam = clampWaveLambdaNm(lambdaNm);
  const t =
    (Math.log10(lam) - Math.log10(WAVE_LAMBDA_MIN_NM)) /
    (Math.log10(WAVE_LAMBDA_MAX_NM) - Math.log10(WAVE_LAMBDA_MIN_NM));
  // t=0 (short λ) → many cycles; t=1 (long λ) → fewer (still several)
  return 14.5 - 10.5 * t;
}

export function clampWaveLambdaNm(lambdaNm: number): number {
  return Math.min(WAVE_LAMBDA_MAX_NM, Math.max(WAVE_LAMBDA_MIN_NM, lambdaNm));
}

export function frequencyHzFromLambdaNm(lambdaNm: number): number {
  const lam = clampWaveLambdaNm(lambdaNm) * 1e-9;
  return C_LIGHT / lam;
}

export function lambdaNmFromFrequencyHz(freqHz: number): number {
  if (!(freqHz > 0)) {
    return WAVE_LAMBDA_DEFAULT_NM;
  }
  return clampWaveLambdaNm((C_LIGHT / freqHz) * 1e9);
}

export function formatFrequency(freqHz: number): string {
  if (freqHz >= 1e14) {
    return `${(freqHz / 1e12).toFixed(1)} THz`;
  }
  if (freqHz >= 1e11) {
    return `${(freqHz / 1e9).toFixed(2)} GHz`;
  }
  return `${freqHz.toExponential(2)} Hz`;
}

export function formatWavelength(lambdaNm: number): string {
  if (lambdaNm >= 1000) {
    return `${(lambdaNm / 1000).toFixed(2)} μm`;
  }
  return `${lambdaNm.toFixed(0)} nm`;
}

/** Approximate CIE 1931 color matching (same fits as blackbody.ts). */
function cieBar(lambdaNm: number): { x: number; y: number; z: number } {
  const t1 = (lambdaNm - 442) * (lambdaNm < 442 ? 0.0624 : 0.0374);
  const t2 = (lambdaNm - 599.8) * (lambdaNm < 599.8 ? 0.0264 : 0.0323);
  const t3 = (lambdaNm - 501.1) * (lambdaNm < 501.1 ? 0.049 : 0.0382);
  const x =
    0.362 * Math.exp(-0.5 * t1 * t1) + 1.056 * Math.exp(-0.5 * t2 * t2) - 0.065 * Math.exp(-0.5 * t3 * t3);
  const t4 = (lambdaNm - 568.8) * (lambdaNm < 568.8 ? 0.0213 : 0.0247);
  const t5 = (lambdaNm - 530.9) * (lambdaNm < 530.9 ? 0.0613 : 0.0322);
  const y = 0.821 * Math.exp(-0.5 * t4 * t4) + 0.286 * Math.exp(-0.5 * t5 * t5);
  const t6 = (lambdaNm - 437) * (lambdaNm < 437 ? 0.0845 : 0.0278);
  const t7 = (lambdaNm - 459) * (lambdaNm < 459 ? 0.0385 : 0.0725);
  const z = 1.217 * Math.exp(-0.5 * t6 * t6) + 0.681 * Math.exp(-0.5 * t7 * t7);
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    z: Math.max(0, z)
  };
}

function xyzToSrgb(X: number, Y: number, Z: number): Rgb {
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const tone = (c: number): number => {
    const v = Math.max(0, c);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  r = tone(r);
  g = tone(g);
  b = tone(b);
  const m = Math.max(r, g, b, 1e-12);
  if (m > 1) {
    r /= m;
    g /= m;
    b /= m;
  }
  return { r, g, b };
}

/**
 * Human-seen monochromatic color. Outside ~380–750 nm → nearly black
 * (eyes don’t see it), with a faint UV/IR cue for teaching.
 */
export function monochromaticSeenColor(lambdaNm: number): { color: Rgb; band: "uv" | "optical" | "ir" } {
  const lam = clampWaveLambdaNm(lambdaNm);
  if (lam < 380) {
    return { color: { r: 0.12, g: 0.05, b: 0.22 }, band: "uv" };
  }
  if (lam > 750) {
    return { color: { r: 0.18, g: 0.04, b: 0.04 }, band: "ir" };
  }
  const cmf = cieBar(lam);
  // Brighten for a saturated swatch at unit luminance-ish.
  const scale = 1.35 / Math.max(cmf.y, 0.08);
  return { color: xyzToSrgb(cmf.x * scale, cmf.y * scale, cmf.z * scale), band: "optical" };
}

export function bandLabel(band: "uv" | "optical" | "ir"): string {
  if (band === "uv") {
    return "Ultraviolet — not seen by eye";
  }
  if (band === "ir") {
    return "Infrared — not seen by eye";
  }
  return "Visible light";
}

export { rgbCss };
