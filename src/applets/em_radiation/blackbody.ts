import type { AppearanceMode, EmitterId, EmitterPreset, SpectrumSample } from "./types";

/** Shared temperature slider bounds (K). */
export const TEMP_MIN_K = 200;
export const TEMP_MAX_K = 12_000;

export const EMITTER_PRESETS: EmitterPreset[] = [
  {
    id: "bulb",
    label: "Light bulb",
    blurb: "Incandescent filament — warm optical glow when hot enough.",
    usualTempK: 2800
  },
  {
    id: "human",
    label: "Human",
    blurb: "Mostly infrared at body temperature — almost invisible to our eyes.",
    usualTempK: 310
  },
  {
    id: "star",
    label: "Star (Sun-like)",
    blurb: "Photosphere near 5800 K peaks in the optical.",
    usualTempK: 5800
  }
];

export function emitterPreset(id: EmitterId): EmitterPreset {
  return EMITTER_PRESETS.find((p) => p.id === id) ?? EMITTER_PRESETS[0];
}

export function clampTempK(t: number): number {
  return Math.min(TEMP_MAX_K, Math.max(TEMP_MIN_K, t));
}

/** Wavelength grid nm (near-UV through thermal IR; wide enough for cold Wien peaks). */
export const LAMBDA_MIN_NM = 100;
export const LAMBDA_MAX_NM = 30_000;
const N_SAMPLES = 480;

const H_PLANCK = 6.62607015e-34;
const C_LIGHT = 2.99792458e8;
const K_BOLTZMANN = 1.380649e-23;
/** Wien’s displacement constant for λ_max T (m·K). */
const WIEN_B = 2.897771955e-3;

/**
 * Spectral radiance B_λ (W·sr⁻¹·m⁻³) in SI, then used relatively.
 * λ in meters, T in kelvin.
 */
export function planckBLambda(lambdaM: number, tempK: number): number {
  if (lambdaM <= 0 || tempK <= 0) {
    return 0;
  }
  const x = (H_PLANCK * C_LIGHT) / (lambdaM * K_BOLTZMANN * tempK);
  // Numerically stable: for large x, exp(x)-1 ≈ exp(x).
  const denom = x > 50 ? Math.exp(x) : Math.expm1(x);
  if (!(denom > 0) || !Number.isFinite(denom)) {
    return 0;
  }
  const prefactor = (2 * H_PLANCK * C_LIGHT * C_LIGHT) / (lambdaM * lambdaM * lambdaM * lambdaM * lambdaM);
  return prefactor / denom;
}

export function wienPeakNm(tempK: number): number {
  if (tempK <= 0) {
    return LAMBDA_MAX_NM;
  }
  return (WIEN_B / tempK) * 1e9;
}

/** Peak B_λ for a blackbody (at Wien λ_max), SI units. */
export function blackbodyPeakRadiance(tempK: number): number {
  const t = clampTempK(tempK);
  return planckBLambda(wienPeakNm(t) * 1e-9, t);
}

/**
 * Fixed log₁₀ intensity window for the blackbody plot across the slider range,
 * so hotter curves rise while cooler ones stay visible.
 */
export function blackbodyLogIntensityRange(): { logMin: number; logMax: number } {
  const peakHot = blackbodyPeakRadiance(TEMP_MAX_K);
  const peakCold = blackbodyPeakRadiance(TEMP_MIN_K);
  const logMax = Math.log10(Math.max(peakHot, 1e-40));
  const logMin = Math.log10(Math.max(peakCold, 1e-40)) - 1.5;
  return { logMin, logMax };
}

export function buildBlackbodySpectrum(
  tempK: number,
  options?: { normalize?: boolean }
): SpectrumSample[] {
  const t = clampTempK(tempK);
  const samples: SpectrumSample[] = [];
  const logMin = Math.log(LAMBDA_MIN_NM);
  const logMax = Math.log(LAMBDA_MAX_NM);
  let peak = 0;
  for (let i = 0; i < N_SAMPLES; i += 1) {
    const u = i / (N_SAMPLES - 1);
    const lambdaNm = Math.exp(logMin + u * (logMax - logMin));
    const value = planckBLambda(lambdaNm * 1e-9, t);
    peak = Math.max(peak, value);
    samples.push({ lambdaNm, value });
  }
  if (options?.normalize && peak > 0) {
    for (const s of samples) {
      s.value /= peak;
    }
  }
  return samples;
}

/** Approximate CIE 1931 color matching (simplified analytic fits). */
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

function xyzToSrgb(X: number, Y: number, Z: number): { r: number; g: number; b: number } {
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
  // Soft normalize so bright sources fill the display without clipping to white only.
  if (m > 1) {
    r /= m;
    g /= m;
    b /= m;
  }
  return { r, g, b };
}

export type Rgb = { r: number; g: number; b: number };

export function rgbCss(c: Rgb, alpha = 1): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}

/**
 * Human-seen color: integrate Planck × CIE CMFs over ~380–780 nm.
 * Cold bodies → nearly black (correct teaching point).
 */
export function humanSeenColor(tempK: number): Rgb {
  const t = clampTempK(tempK);
  let X = 0;
  let Y = 0;
  let Z = 0;
  const n = 80;
  for (let i = 0; i < n; i += 1) {
    const lambdaNm = 380 + (i / (n - 1)) * 400;
    const B = planckBLambda(lambdaNm * 1e-9, t);
    const cmf = cieBar(lambdaNm);
    X += B * cmf.x;
    Y += B * cmf.y;
    Z += B * cmf.z;
  }
  // Scale by a reference so sunlight-ish temps look bright.
  const ref = planckBLambda(500e-9, 5800) * n * 0.35;
  const s = ref > 0 ? 1 / ref : 1;
  return xyzToSrgb(X * s, Y * s, Z * s);
}

/**
 * EM false-color: IR → red, optical → green, UV → blue (band-integrated radiance).
 * Keeps cold humans readable as red IR glow.
 */
export function emFalseColor(tempK: number): Rgb {
  const t = clampTempK(tempK);
  const band = (lo: number, hi: number): number => {
    let s = 0;
    const n = 40;
    for (let i = 0; i < n; i += 1) {
      const lambdaNm = lo + (i / (n - 1)) * (hi - lo);
      s += planckBLambda(lambdaNm * 1e-9, t);
    }
    return s / n;
  };
  const uv = band(200, 380);
  const opt = band(380, 750);
  const ir = band(750, 5000);
  const refHotUv = bandAt(5800, 200, 380);
  const refHotOpt = bandAt(5800, 380, 750);
  const refHotIr = bandAt(5800, 750, 5000);
  const nr = Math.min(1.4, ir / (refHotIr * 0.15 + 1e-30));
  const ng = Math.min(1.4, opt / (refHotOpt * 0.25 + 1e-30));
  const nb = Math.min(1.4, uv / (refHotUv * 0.4 + 1e-30));
  const m = Math.max(nr, ng, nb, 1e-6);
  return {
    r: Math.min(1, nr / m),
    g: Math.min(1, ng / m),
    b: Math.min(1, nb / m)
  };
}

function bandAt(tempK: number, lo: number, hi: number): number {
  let s = 0;
  const n = 40;
  for (let i = 0; i < n; i += 1) {
    const lambdaNm = lo + (i / (n - 1)) * (hi - lo);
    s += planckBLambda(lambdaNm * 1e-9, tempK);
  }
  return s / n;
}

export function appearanceColor(tempK: number, mode: AppearanceMode): Rgb {
  return mode === "human-seen" ? humanSeenColor(tempK) : emFalseColor(tempK);
}

/** Flavor text for the human emitter only. */
export function humanJoke(tempK: number): string | null {
  const t = clampTempK(tempK);
  if (t >= 480 && t <= 520) {
    return "Oklahoma!";
  }
  if (t >= 900) {
    return "Congratulations: you’ve invented a human-shaped star. Please do not.";
  }
  if (t >= 600) {
    return "Not OSHA-approved. Melting is not a recommended lifestyle.";
  }
  if (t >= 370 && t < 480) {
    return "Fever territory… and climbing. Someone call a physicist (and a doctor).";
  }
  return null;
}
