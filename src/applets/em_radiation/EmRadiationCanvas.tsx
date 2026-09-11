import { useEffect, useMemo, useRef, useState } from "react";
import { AppletHostAdapter } from "../../core/host";
import { ControlCard } from "../../ui/ControlCard";
import { AtomicSpectraPanel } from "./AtomicSpectraPanel";
import {
  EMITTER_PRESETS,
  TEMP_MAX_K,
  TEMP_MIN_K,
  blackbodyLogIntensityRange,
  buildBlackbodySpectrum,
  clampTempK,
  emitterPreset,
  humanJoke,
  wienPeakNm
} from "./blackbody";
import { drawEmitterPortrait, ensureEmitterImage } from "./emitterVisuals";
import {
  WAVE_LAMBDA_DEFAULT_NM,
  WAVE_LAMBDA_MAX_NM,
  WAVE_LAMBDA_MIN_NM,
  clampWaveLambdaNm,
  formatFrequency,
  formatWavelength,
  frequencyHzFromLambdaNm,
  lambdaNmFromFrequencyHz
} from "./emWave";
import { drawSpectrumPlot } from "./spectrumRender";
import { drawTravelingEmWave, drawWavelengthSwatch } from "./waveRender";
import type {
  AppearanceMode,
  EmModeId,
  EmWaveViewMode,
  EmitterId
} from "./types";

type EmRadiationCanvasProps = {
  host?: AppletHostAdapter;
};

const SPECTRUM_W = 720;
const SPECTRUM_H = 420;
const PORTRAIT_W = 300;
const PORTRAIT_H = 420;

function tempToSlider(tempK: number): number {
  const min = Math.log10(TEMP_MIN_K);
  const max = Math.log10(TEMP_MAX_K);
  return ((Math.log10(clampTempK(tempK)) - min) / (max - min)) * 100;
}

function sliderToTemp(slider: number): number {
  const min = Math.log10(TEMP_MIN_K);
  const max = Math.log10(TEMP_MAX_K);
  const t = Math.min(100, Math.max(0, slider)) / 100;
  return clampTempK(10 ** (min + t * (max - min)));
}

function lambdaToSlider(lambdaNm: number): number {
  const min = Math.log10(WAVE_LAMBDA_MIN_NM);
  const max = Math.log10(WAVE_LAMBDA_MAX_NM);
  return ((Math.log10(clampWaveLambdaNm(lambdaNm)) - min) / (max - min)) * 100;
}

function sliderToLambda(slider: number): number {
  const min = Math.log10(WAVE_LAMBDA_MIN_NM);
  const max = Math.log10(WAVE_LAMBDA_MAX_NM);
  const t = Math.min(100, Math.max(0, slider)) / 100;
  return clampWaveLambdaNm(10 ** (min + t * (max - min)));
}

const FREQ_MIN_HZ = frequencyHzFromLambdaNm(WAVE_LAMBDA_MAX_NM);
const FREQ_MAX_HZ = frequencyHzFromLambdaNm(WAVE_LAMBDA_MIN_NM);

function freqToSlider(freqHz: number): number {
  const min = Math.log10(FREQ_MIN_HZ);
  const max = Math.log10(FREQ_MAX_HZ);
  const f = Math.min(FREQ_MAX_HZ, Math.max(FREQ_MIN_HZ, freqHz));
  return ((Math.log10(f) - min) / (max - min)) * 100;
}

function sliderToFreq(slider: number): number {
  const min = Math.log10(FREQ_MIN_HZ);
  const max = Math.log10(FREQ_MAX_HZ);
  const t = Math.min(100, Math.max(0, slider)) / 100;
  return 10 ** (min + t * (max - min));
}

const MODE_OPTIONS: { id: EmModeId; label: string }[] = [
  { id: "atomic-lines", label: "Atomic spectra" },
  { id: "blackbody", label: "Blackbody" },
  { id: "em-wave", label: "EM wave (E & B)" }
];

export function EmRadiationCanvas({ host }: EmRadiationCanvasProps): JSX.Element {
  const spectrumRef = useRef<HTMLCanvasElement | null>(null);
  const portraitRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<EmModeId>("atomic-lines");
  const [emitter, setEmitter] = useState<EmitterId>("bulb");
  const [tempK, setTempK] = useState(emitterPreset("bulb").usualTempK);
  const [appearance, setAppearance] = useState<AppearanceMode>("human-seen");
  const [intensityScale, setIntensityScale] = useState<"relative" | "absolute">("absolute");
  const [showUsualTemps, setShowUsualTemps] = useState(false);
  const [waveLambdaNm, setWaveLambdaNm] = useState(WAVE_LAMBDA_DEFAULT_NM);
  const [wavePlaying, setWavePlaying] = useState(true);
  const [waveView, setWaveView] = useState<EmWaveViewMode>("wave");

  const reducedMotion = host?.readReducedMotion?.() ?? false;

  const joke = mode === "blackbody" && emitter === "human" ? humanJoke(tempK) : null;
  const preset = emitterPreset(emitter);
  const waveFreqHz = frequencyHzFromLambdaNm(waveLambdaNm);

  const spectrum = useMemo(() => {
    if (mode === "blackbody") {
      return buildBlackbodySpectrum(tempK, { normalize: intensityScale === "relative" });
    }
    return [];
  }, [mode, tempK, intensityScale]);

  const usualOverlays = useMemo(() => {
    if (mode !== "blackbody" || !showUsualTemps) {
      return [];
    }
    const colors: Record<string, string> = {
      human: "rgba(255, 140, 90, 0.95)",
      bulb: "rgba(255, 210, 90, 0.95)",
      star: "rgba(255, 120, 180, 0.95)"
    };
    return EMITTER_PRESETS.map((p) => ({
      samples: buildBlackbodySpectrum(p.usualTempK, { normalize: intensityScale === "relative" }),
      color: colors[p.id] ?? "rgba(200, 200, 200, 0.9)",
      label: `${p.label.split(" ")[0]} ${Math.round(p.usualTempK)} K`,
      dashed: true
    }));
  }, [mode, showUsualTemps, intensityScale]);

  // Blackbody plot (static).
  useEffect(() => {
    if (mode !== "blackbody") {
      return;
    }
    const canvas = spectrumRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    if (mode === "blackbody") {
      const shared = {
        title: `Blackbody · T = ${Math.round(tempK)} K · λ_max ≈ ${wienPeakNm(tempK).toFixed(0)} nm`,
        logX: true as const,
        showOpticalBand: true,
        wienTempK: tempK,
        lambdaMinNm: 100,
        lambdaMaxNm: 30_000,
        overlays: usualOverlays,
        primaryLabel: showUsualTemps ? `Live ${Math.round(tempK)} K` : undefined
      };
      if (intensityScale === "absolute") {
        const logRange = blackbodyLogIntensityRange();
        drawSpectrumPlot(ctx, SPECTRUM_W, SPECTRUM_H, spectrum, {
          ...shared,
          logY: true,
          logYMin: logRange.logMin,
          logYMax: logRange.logMax,
          yAxisLabel: "intensity (log scale)"
        });
      } else {
        drawSpectrumPlot(ctx, SPECTRUM_W, SPECTRUM_H, spectrum, {
          ...shared,
          yAxisLabel: "relative intensity"
        });
      }
    }
  }, [spectrum, mode, tempK, intensityScale, usualOverlays, showUsualTemps]);

  // Traveling EM wave animation.
  useEffect(() => {
    if (mode !== "em-wave") {
      return;
    }
    const canvas = spectrumRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let raf = 0;
    let phase = 0;
    let travel01 = 0;
    let last = performance.now();
    const paused = reducedMotion || !wavePlaying;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Oscillation phase: faster for higher frequency (soft-capped).
      const fNorm =
        (Math.log10(waveFreqHz) - Math.log10(FREQ_MIN_HZ)) /
        (Math.log10(FREQ_MAX_HZ) - Math.log10(FREQ_MIN_HZ));
      const omega = 1.6 + 3.4 * Math.min(1, Math.max(0, fNorm));
      phase += omega * dt;
      // Packet travel: same visual “c” for all λ; wraps 0→1.
      travel01 = (travel01 + dt * 0.28) % 1;
      drawTravelingEmWave(ctx, SPECTRUM_W, SPECTRUM_H, {
        lambdaNm: waveLambdaNm,
        phaseRad: phase,
        travel01,
        view: waveView
      });
      raf = requestAnimationFrame(frame);
    };

    if (paused) {
      drawTravelingEmWave(ctx, SPECTRUM_W, SPECTRUM_H, {
        lambdaNm: waveLambdaNm,
        phaseRad: phase,
        travel01,
        view: waveView
      });
      return;
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, waveLambdaNm, waveFreqHz, wavePlaying, waveView, reducedMotion]);

  // Right panel: emitter / wavelength swatch.
  useEffect(() => {
    const canvas = portraitRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    if (mode === "blackbody") {
      ensureEmitterImage(emitter);
      drawEmitterPortrait(ctx, PORTRAIT_W, PORTRAIT_H, emitter, tempK, appearance, () => {
        const again = portraitRef.current?.getContext("2d");
        if (again) {
          drawEmitterPortrait(again, PORTRAIT_W, PORTRAIT_H, emitter, tempK, appearance);
        }
      });
    } else if (mode === "em-wave") {
      drawWavelengthSwatch(ctx, PORTRAIT_W, PORTRAIT_H, waveLambdaNm);
    }
  }, [mode, emitter, tempK, appearance, waveLambdaNm]);

  function onUsualTemp(): void {
    setTempK(preset.usualTempK);
  }

  function onEmitterChange(next: EmitterId): void {
    setEmitter(next);
    setTempK(emitterPreset(next).usualTempK);
  }

  function onLambdaChange(nextNm: number): void {
    setWaveLambdaNm(clampWaveLambdaNm(nextNm));
  }

  function onFreqChange(nextHz: number): void {
    setWaveLambdaNm(lambdaNmFromFrequencyHz(nextHz));
  }

  const modeControl = (
    <label className="em-mode-control">
      Mode
      <select value={mode} onChange={(event) => setMode(event.target.value as EmModeId)}
        aria-label="Radiation mode">
        {MODE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );

  if (mode === "atomic-lines") {
    return <AtomicSpectraPanel modeControl={modeControl} />;
  }

  return (
    <div className="gravity-layout">
      <ControlCard title="Light, heat, and spectra">
        <div className="control-grid">
          <div className="control-span-2">{modeControl}</div>

          {mode === "blackbody" ? (
            <>
              <label className="control-span-2">
                Emitter
                <select
                  value={emitter}
                  onChange={(event) => onEmitterChange(event.target.value as EmitterId)}
                  aria-label="Thermal emitter"
                >
                  {EMITTER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="subtle control-span-2">{preset.blurb}</p>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Temperature</span>
                  <strong>{Math.round(tempK)} K</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={tempToSlider(tempK)}
                  onChange={(event) => setTempK(sliderToTemp(Number(event.target.value)))}
                />
              </label>

              <div className="button-row control-span-2">
                <button type="button" onClick={onUsualTemp}>
                  Usual temperature ({Math.round(preset.usualTempK)} K)
                </button>
              </div>

              <label className="control-span-2">
                Intensity scale
                <select
                  value={intensityScale}
                  onChange={(event) =>
                    setIntensityScale(event.target.value as "relative" | "absolute")
                  }
                  aria-label="Intensity scale"
                >
                  <option value="absolute">Absolute (log scale)</option>
                  <option value="relative">Relative (peak-normalized)</option>
                </select>
              </label>

              <label className="checkbox control-span-2">
                <span>Show usual temperatures</span>
                <input
                  type="checkbox"
                  checked={showUsualTemps}
                  onChange={(event) => setShowUsualTemps(event.target.checked)}
                />
              </label>

              <label className="control-span-2">
                Appearance on the right
                <select
                  value={appearance}
                  onChange={(event) => setAppearance(event.target.value as AppearanceMode)}
                  aria-label="Appearance mode"
                >
                  <option value="human-seen">Human-seen color</option>
                  <option value="em-false-color">EM false-color (IR / optical / UV)</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="control-span-2">
                Picture
                <select
                  value={waveView}
                  onChange={(event) => setWaveView(event.target.value as EmWaveViewMode)}
                  aria-label="Wave or photon picture"
                >
                  <option value="wave">Wave (extended E &amp; B)</option>
                  <option value="photon">Photon (short packet)</option>
                </select>
              </label>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Wavelength</span>
                  <strong>{formatWavelength(waveLambdaNm)}</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={lambdaToSlider(waveLambdaNm)}
                  onChange={(event) => onLambdaChange(sliderToLambda(Number(event.target.value)))}
                  aria-label="Wavelength"
                />
              </label>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Frequency</span>
                  <strong>{formatFrequency(waveFreqHz)}</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={freqToSlider(waveFreqHz)}
                  onChange={(event) => onFreqChange(sliderToFreq(Number(event.target.value)))}
                  aria-label="Frequency"
                />
              </label>

              <div className="button-row control-span-2">
                <button type="button" onClick={() => onLambdaChange(WAVE_LAMBDA_DEFAULT_NM)}>
                  Green light (550 nm)
                </button>
                <button
                  type="button"
                  onClick={() => setWavePlaying((p) => !p)}
                  disabled={reducedMotion}
                >
                  {wavePlaying && !reducedMotion ? "Pause" : "Play"}
                </button>
              </div>
            </>

          )}
        </div>
      </ControlCard>

      <div className="em-radiation-stage">
        <canvas
          ref={spectrumRef}
          width={SPECTRUM_W}
          height={SPECTRUM_H}
          className="em-radiation-spectrum"
          aria-label={mode === "em-wave" ? "Traveling EM wave" : "Spectrum plot"}
        />
        <div className="em-radiation-side">
          <canvas
            ref={portraitRef}
            width={PORTRAIT_W}
            height={PORTRAIT_H}
            className="em-radiation-portrait"
            aria-label={
              mode === "blackbody" ? "Emitter appearance" : "Wavelength color swatch"
            }
          />
          {joke ? (
            <p className="em-radiation-joke" role="status">
              {joke}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
