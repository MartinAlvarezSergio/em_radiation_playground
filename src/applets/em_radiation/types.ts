export type EmModeId = "blackbody" | "atomic-lines" | "em-wave";

export type EmitterId = "bulb" | "human" | "star";

export type AppearanceMode = "human-seen" | "em-false-color";

export type AtomicSpeciesId = "hydrogen" | "helium" | "sodium" | "calcium";

export type AtomicViewMode = "emission" | "absorption" | "continuum";

/** Within EM-wave mode: continuous fields vs localized photon packet. */
export type EmWaveViewMode = "wave" | "photon";

export type EmitterPreset = {
  id: EmitterId;
  label: string;
  blurb: string;
  /** Usual / default temperature (K). */
  usualTempK: number;
};

export type SpectrumSample = {
  /** Wavelength in nm. */
  lambdaNm: number;
  /** Relative spectral radiance (arbitrary units, peak-normalized in plot). */
  value: number;
};
