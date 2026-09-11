import type { AtomicSpeciesId, AtomicViewMode, SpectrumSample } from "./types";

export type SpectralLine = {
  /** Representative rest wavelength in standard air, nm. See ATOMIC_DATA.md. */
  lambdaNm: number;
  label: string;
  /** Illustrative strength, not an abundance or a measured line ratio. */
  strength: number;
  lowerN?: number;
  upperN?: number;
};

export type AtomicSpecies = {
  id: AtomicSpeciesId;
  label: string;
  symbol: string;
  ion: string;
  sourceUrl: string;
  lines: SpectralLine[];
};

const handbook = "https://physics.nist.gov/PhysRefData/Handbook/Tables/";

export const ATOMIC_SPECIES: AtomicSpecies[] = [
  {
    id: "hydrogen", label: "Hydrogen", symbol: "H", ion: "H I · neutral",
    sourceUrl: `${handbook}hydrogentable2.htm`,
    lines: [
      { lambdaNm: 410.174, label: "Hδ", strength: 0.30, lowerN: 2, upperN: 6 },
      { lambdaNm: 434.046, label: "Hγ", strength: 0.42, lowerN: 2, upperN: 5 },
      { lambdaNm: 486.133, label: "Hβ", strength: 0.62, lowerN: 2, upperN: 4 },
      { lambdaNm: 656.28, label: "Hα", strength: 1, lowerN: 2, upperN: 3 }
    ]
  },
  {
    id: "helium", label: "Helium", symbol: "He", ion: "He I · neutral",
    sourceUrl: `${handbook}heliumtable2.htm`,
    lines: [
      { lambdaNm: 402.619, label: "He I", strength: 0.32 },
      { lambdaNm: 447.148, label: "He I", strength: 0.60 },
      { lambdaNm: 501.568, label: "He I", strength: 0.42 },
      { lambdaNm: 587.562, label: "He I", strength: 1 },
      { lambdaNm: 667.815, label: "He I", strength: 0.65 },
      { lambdaNm: 706.518, label: "He I", strength: 0.45 }
    ]
  },
  {
    id: "sodium", label: "Sodium", symbol: "Na", ion: "Na I · neutral",
    sourceUrl: `${handbook}sodiumtable2.htm`,
    lines: [
      { lambdaNm: 588.995, label: "D₂", strength: 1 },
      { lambdaNm: 589.5924, label: "D₁", strength: 0.75 }
    ]
  },
  {
    id: "calcium", label: "Calcium", symbol: "Ca⁺", ion: "Ca II · singly ionized",
    sourceUrl: `${handbook}calciumtable2.htm`,
    lines: [
      { lambdaNm: 393.366, label: "K", strength: 1 },
      { lambdaNm: 396.847, label: "H", strength: 0.8 }
    ]
  }
];

export function atomicSpecies(id: AtomicSpeciesId): AtomicSpecies {
  return ATOMIC_SPECIES.find((species) => species.id === id) ?? ATOMIC_SPECIES[0];
}

export type SpectralWindow = { minNm: number; maxNm: number };
export const VISIBLE_WINDOW: SpectralWindow = { minNm: 380, maxNm: 750 };

/** Fixed teaching width: zoom changes the axis, never the underlying spectrum. */
export const ATOMIC_LINE_SIGMA_NM = 0.07;

export function atomicWindow(line: SpectralLine, zoomed: boolean): SpectralWindow {
  if (!zoomed) return VISIBLE_WINDOW;
  const minNm = Math.max(380, Math.min(742, line.lambdaNm - 4));
  return { minNm, maxNm: minNm + 8 };
}

export function atomicIntensityAt(
  lambdaNm: number,
  lines: SpectralLine[],
  view: AtomicViewMode
): number {
  if (view === "continuum") return 1;
  let value = view === "emission" ? 0 : 1;
  for (const line of lines) {
    const profile = Math.exp(-0.5 * ((lambdaNm - line.lambdaNm) / ATOMIC_LINE_SIGMA_NM) ** 2);
    if (view === "emission") value += line.strength * profile;
    else value *= 1 - 0.88 * line.strength * profile;
  }
  return value;
}

export function buildAtomicSpectrum(
  speciesId: AtomicSpeciesId,
  view: AtomicViewMode,
  window: SpectralWindow = VISIBLE_WINDOW
): SpectrumSample[] {
  const { lines } = atomicSpecies(speciesId);
  const wavelengths = new Set<number>();
  for (let i = 0; i <= 720; i += 1) {
    wavelengths.add(window.minNm + (i / 720) * (window.maxNm - window.minNm));
  }
  // Include every line center and its wings, even when narrower than the overview grid.
  // This preserves line heights and resolves the Na doublet on zooming.
  for (const line of lines) {
    for (let step = -24; step <= 24; step += 1) {
      const lambdaNm = line.lambdaNm + (step / 4) * ATOMIC_LINE_SIGMA_NM;
      if (lambdaNm >= window.minNm && lambdaNm <= window.maxNm) wavelengths.add(lambdaNm);
    }
  }
  return [...wavelengths].sort((a, b) => a - b).map((lambdaNm) => ({
    lambdaNm,
    value: atomicIntensityAt(lambdaNm, lines, view)
  }));
}

/** hc in eV nm. Air wavelengths make this an approximation (<0.04% here). */
export function photonEnergyEv(lambdaNm: number): number {
  return 1239.841984 / lambdaNm;
}

/** Hydrogen approximation relative to the ionization limit; fine structure omitted. */
export function hydrogenLevelEnergyEv(n: number): number {
  return -13.6 / (n * n);
}
