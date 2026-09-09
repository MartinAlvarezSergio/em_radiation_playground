import type { AtomicSpeciesId, AtomicViewMode, SpectrumSample } from "./types";
import { buildBlackbodySpectrum, clampTempK } from "./blackbody";

export type SpectralLine = {
  lambdaNm: number;
  label: string;
  /** Relative strength 0–1 for drawing. */
  strength: number;
};

export type AtomicSpecies = {
  id: AtomicSpeciesId;
  label: string;
  blurb: string;
  lines: SpectralLine[];
};

export const ATOMIC_SPECIES: AtomicSpecies[] = [
  {
    id: "hydrogen",
    label: "Hydrogen",
    blurb: "Balmer series in the optical (plus a couple UV lines). Teaching cartoon — not a full level diagram.",
    lines: [
      { lambdaNm: 121.6, label: "Ly-α", strength: 0.55 },
      { lambdaNm: 102.6, label: "Ly-β", strength: 0.25 },
      { lambdaNm: 656.3, label: "Hα", strength: 1 },
      { lambdaNm: 486.1, label: "Hβ", strength: 0.55 },
      { lambdaNm: 434.0, label: "Hγ", strength: 0.35 },
      { lambdaNm: 410.2, label: "Hδ", strength: 0.22 }
    ]
  },
  {
    id: "sodium",
    label: "Sodium",
    blurb: "The famous orange D lines — the streetlight look.",
    lines: [
      { lambdaNm: 589.0, label: "D₂", strength: 1 },
      { lambdaNm: 589.6, label: "D₁", strength: 0.85 }
    ]
  }
];

export function atomicSpecies(id: AtomicSpeciesId): AtomicSpecies {
  return ATOMIC_SPECIES.find((s) => s.id === id) ?? ATOMIC_SPECIES[0];
}

/** Continuum lamp for absorption mode (schematic warm blackbody). */
const ABSORPTION_CONTINUUM_T = 5500;

export function buildAtomicSpectrum(
  speciesId: AtomicSpeciesId,
  view: AtomicViewMode
): SpectrumSample[] {
  const species = atomicSpecies(speciesId);
  // Optical-focused window for line pedagogy (near-UV through near-IR).
  const lo = 90;
  const hi = 900;
  const n = 420;
  const samples: SpectrumSample[] = [];

  if (view === "emission") {
    for (let i = 0; i < n; i += 1) {
      const lambdaNm = lo + (i / (n - 1)) * (hi - lo);
      let value = 0.02;
      for (const line of species.lines) {
        if (line.lambdaNm < lo || line.lambdaNm > hi) {
          continue;
        }
        const sigma = Math.max(0.8, line.lambdaNm * 0.0015);
        const g = Math.exp(-0.5 * ((lambdaNm - line.lambdaNm) / sigma) ** 2);
        value += line.strength * g;
      }
      samples.push({ lambdaNm, value });
    }
  } else {
    const continuum = buildBlackbodySpectrum(clampTempK(ABSORPTION_CONTINUUM_T), {
      normalize: true
    });
    for (let i = 0; i < n; i += 1) {
      const lambdaNm = lo + (i / (n - 1)) * (hi - lo);
      // Sample continuum via nearest neighbor on log grid.
      let c = 0.2;
      let best = Infinity;
      for (const s of continuum) {
        const d = Math.abs(s.lambdaNm - lambdaNm);
        if (d < best) {
          best = d;
          c = Math.max(0.05, s.value);
        }
      }
      let absorb = 1;
      for (const line of species.lines) {
        if (line.lambdaNm < lo || line.lambdaNm > hi) {
          continue;
        }
        const sigma = Math.max(0.7, line.lambdaNm * 0.0012);
        const g = Math.exp(-0.5 * ((lambdaNm - line.lambdaNm) / sigma) ** 2);
        absorb *= 1 - 0.92 * line.strength * g;
      }
      samples.push({ lambdaNm, value: c * absorb });
    }
  }

  let peak = 0;
  for (const s of samples) {
    peak = Math.max(peak, s.value);
  }
  if (peak > 0) {
    for (const s of samples) {
      s.value /= peak;
    }
  }
  return samples;
}

export const ATOMIC_NOTE =
  "Schematic line lists for teaching (H Balmer / Na D). Wavelengths are approximate; strengths are exaggerated for legibility. Absorption uses a warm continuum “lamp” behind the gas — not a fitted stellar atmosphere.";
