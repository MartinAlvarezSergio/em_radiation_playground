import { useEffect, useMemo, useRef, useState } from "react";
import { logicalPointer, setLogicalTransform } from "../../core/canvasScale";
import { AppletHostAdapter } from "../../core/host";
import { AppletStage } from "../../ui/stage/AppletStage";
import { useCanvasBackingStore } from "../../ui/stage/hooks";
import {
  StageDivider,
  StageHero,
  StageIconButton,
  StagePillButton,
  StagePills,
  StageReadout,
  StageSection,
  StageSegmented,
  StageSlider,
  StageToggle
} from "../../ui/stage/StageControls";
import { atomicLineColor } from "./atomicColor";
import {
  ATOMIC_SPECIES,
  atomicSpecies,
  atomicWindow,
  buildAtomicSpectrum,
  photonEnergyEv,
  type SpectralLine
} from "./atomicLines";
import { AtomicTransition } from "./AtomicVisualAids";
import {
  EMITTER_PRESETS,
  TEMP_MAX_K,
  TEMP_MIN_K,
  appearanceColor,
  blackbodyLogIntensityRange,
  buildBlackbodySpectrum,
  clampTempK,
  emitterPreset,
  humanJoke,
  rgbCss,
  wienPeakNm
} from "./blackbody";
import { drawEmitterPortrait } from "./emitterVisuals";
import {
  WAVE_LAMBDA_DEFAULT_NM,
  WAVE_LAMBDA_MAX_NM,
  WAVE_LAMBDA_MIN_NM,
  bandLabel,
  clampWaveLambdaNm,
  formatFrequency,
  formatWavelength,
  frequencyHzFromLambdaNm,
  lambdaNmFromFrequencyHz,
  monochromaticSeenColor
} from "./emWave";
import {
  drawAtomicScene,
  drawBlackbodyScene,
  drawColorTile,
  drawStageSurface,
  type AtomicLineHit,
  type SceneRect
} from "./stageScene";
import { drawTravelingEmWave } from "./waveRender";
import type { AppearanceMode, AtomicSpeciesId, AtomicViewMode, EmModeId, EmWaveViewMode, EmitterId } from "./types";
import "./emRadiationStage.css";

type Props = {
  host?: AppletHostAdapter;
};

/** Logical stage size. The scene draws in the part left clear of the overlay panels. */
const STAGE_W = 1040;
const STAGE_H = 600;
/** Overlay panel widths (CSS px); the side column holds the readouts and the inset. */
const CONTROLS_W = 250;
const SIDE_W = 250;
const PANEL_INSET = 12;
const PANEL_GAP = 18;
/** Top bar plus its inset (CSS px): the scene starts below it. */
const TOPBAR_CLEAR = 60;

const MODE_OPTIONS: { value: EmModeId; label: string; tip: string }[] = [
  { value: "atomic-lines", label: "Atomic spectra", tip: "Emission and absorption lines of H, He, Na and Ca⁺." },
  { value: "blackbody", label: "Blackbody", tip: "Thermal glow of a bulb, a person and a star." },
  { value: "em-wave", label: "EM wave (E & B)", tip: "Electric and magnetic fields of a travelling wave or photon." }
];

const ATOMIC_VIEWS: { value: AtomicViewMode; label: string; tip: string }[] = [
  { value: "emission", label: "Emission", tip: "Excited gas emits light toward the observer." },
  {
    value: "absorption",
    label: "Absorption",
    tip: "Light from a hot source crosses cooler gas; the line wavelengths are removed along the line of sight."
  },
  { value: "continuum", label: "Continuum", tip: "Light from a hot source reaches the observer without intervening gas." }
];

const TIP = {
  reset: "Restore this mode's starting settings.",
  play: "Pause or resume the wave.",
  element: "Gas whose lines are shown.",
  window: "Visible: 380–750 nm. Line zoom: an 8 nm window around the selected line.",
  lines: "Click a line here or in the plot to select it.",
  emitter: "Thermal emitter shown in the picture.",
  temperature: "Surface temperature (log scale from 200 K to 12,000 K).",
  usual: "Reset to this emitter's usual temperature.",
  scale: "Absolute: fixed log scale, so hotter bodies sit higher. Relative: each curve scaled to its own peak.",
  usualTemps: "Overlay the bulb, human and star at their usual temperatures.",
  appearance:
    "Human-seen color: what the eye would see. EM false-color: infrared → red, optical → green, ultraviolet → blue.",
  picture: "Wave: extended E and B fields. Photon: a short packet about two wavelengths long.",
  wavelength: "Wavelength (log scale, 200 nm–2 µm).",
  frequency: "Frequency, f = c / λ.",
  green: "Jump to green light at 550 nm.",
  lineHero: "Selected line: rest wavelength in standard air (NIST).",
  energy: "Photon energy ΔE ≈ hc/λ.",
  peakHero: "Wien peak: λ_max = b / T.",
  peakBand: "Part of the spectrum where the curve peaks.",
  seenColor: "Color of the glow in the picture (depends on the Appearance setting).",
  levels: "Energy levels of the selected transition. Emission arrows point down, absorption arrows up."
} as const;

function logSlider(value: number, min: number, max: number): number {
  return ((Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 100;
}

function fromLogSlider(slider: number, min: number, max: number): number {
  const t = Math.min(100, Math.max(0, slider)) / 100;
  return 10 ** (Math.log10(min) + t * (Math.log10(max) - Math.log10(min)));
}

const FREQ_MIN_HZ = frequencyHzFromLambdaNm(WAVE_LAMBDA_MAX_NM);
const FREQ_MAX_HZ = frequencyHzFromLambdaNm(WAVE_LAMBDA_MIN_NM);

function strongestLine(id: AtomicSpeciesId): SpectralLine {
  return atomicSpecies(id).lines.reduce((a, b) => (a.strength >= b.strength ? a : b));
}

function peakBand(lambdaNm: number): string {
  return lambdaNm < 380 ? "ultraviolet" : lambdaNm <= 750 ? "visible" : "infrared";
}

export function EmRadiationCanvas({ host }: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const insetRef = useRef<HTMLCanvasElement | null>(null);
  const hitsRef = useRef<AtomicLineHit[]>([]);
  const reducedMotion = host?.readReducedMotion?.() ?? false;

  const [mode, setMode] = useState<EmModeId>("atomic-lines");
  const [controlsVisible, setControlsVisible] = useState(true);

  // Atomic spectra.
  const [speciesId, setSpeciesId] = useState<AtomicSpeciesId>("hydrogen");
  const [view, setView] = useState<AtomicViewMode>("emission");
  const [selectedNm, setSelectedNm] = useState(656.28);
  const [zoomed, setZoomed] = useState(false);

  // Blackbody.
  const [emitter, setEmitter] = useState<EmitterId>("bulb");
  const [tempK, setTempK] = useState(emitterPreset("bulb").usualTempK);
  const [appearance, setAppearance] = useState<AppearanceMode>("human-seen");
  const [intensityScale, setIntensityScale] = useState<"relative" | "absolute">("absolute");
  const [showUsualTemps, setShowUsualTemps] = useState(false);

  // EM wave.
  const [waveLambdaNm, setWaveLambdaNm] = useState(WAVE_LAMBDA_DEFAULT_NM);
  const [wavePlaying, setWavePlaying] = useState(!reducedMotion);
  const [waveView, setWaveView] = useState<EmWaveViewMode>("wave");

  const species = atomicSpecies(speciesId);
  const selected = species.lines.find((line) => line.lambdaNm === selectedNm) ?? species.lines[0];
  const window_ = atomicWindow(selected, zoomed);
  const { minNm: windowMin, maxNm: windowMax } = window_;
  const atomicSamples = useMemo(
    () => buildAtomicSpectrum(speciesId, view, { minNm: windowMin, maxNm: windowMax }),
    [speciesId, view, windowMin, windowMax]
  );

  const preset = emitterPreset(emitter);
  const bbSamples = useMemo(
    () => buildBlackbodySpectrum(tempK, { normalize: intensityScale === "relative" }),
    [tempK, intensityScale]
  );
  const bbOverlays = useMemo(() => {
    if (!showUsualTemps) {
      return [];
    }
    const colors: Record<EmitterId, string> = {
      human: "rgba(255, 140, 90, 0.95)",
      bulb: "rgba(255, 210, 90, 0.95)",
      star: "rgba(255, 120, 180, 0.95)"
    };
    return EMITTER_PRESETS.map((p) => ({
      samples: buildBlackbodySpectrum(p.usualTempK, { normalize: intensityScale === "relative" }),
      color: colors[p.id],
      label: `${p.label.split(" ")[0]} ${Math.round(p.usualTempK)} K`
    }));
  }, [showUsualTemps, intensityScale]);
  const logRange = useMemo(() => blackbodyLogIntensityRange(), []);

  const waveFreqHz = frequencyHzFromLambdaNm(waveLambdaNm);
  const waveSeen = monochromaticSeenColor(waveLambdaNm);
  const waveMoving = mode === "em-wave" && wavePlaying && !reducedMotion;

  /** Scene rectangle (logical units), clear of the panels when they float over the stage. */
  const sceneRect = (canvas: HTMLCanvasElement): SceneRect => {
    const overlaid = !globalThis.matchMedia("(max-width: 760px)").matches;
    const k = canvas.clientWidth > 0 ? STAGE_W / canvas.clientWidth : 1;
    const left = overlaid && controlsVisible ? (PANEL_INSET + CONTROLS_W + PANEL_GAP) * k : 24;
    const right = overlaid ? (PANEL_INSET + SIDE_W + PANEL_GAP) * k : 24;
    const top = overlaid ? TOPBAR_CLEAR * k : 24;
    return { x: left, y: top, w: Math.max(120, STAGE_W - left - right), h: STAGE_H - top - 22 };
  };

  // Everything the draw loop needs, read through a ref so the loop is not restarted on every change.
  const drawState = {
    mode,
    species,
    view,
    window: window_,
    selected,
    atomicSamples,
    bbSamples,
    bbOverlays,
    tempK,
    logY: intensityScale === "absolute",
    showUsualTemps,
    waveLambdaNm,
    waveView,
    waveFreqHz,
    sceneRect
  };
  const drawRef = useRef(drawState);
  drawRef.current = drawState;
  // Wave phase lives outside the loop so pausing freezes the picture instead of resetting it.
  const waveClock = useRef({ phase: 0, travel01: 0, moving: waveMoving });
  waveClock.current.moving = waveMoving;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    let raf = 0;
    let last = performance.now();
    const clock = waveClock.current;
    const frame = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = drawRef.current;
      setLogicalTransform(ctx, STAGE_W);
      drawStageSurface(ctx, STAGE_W, STAGE_H);
      const rect = s.sceneRect(canvas);
      hitsRef.current = [];
      if (s.mode === "atomic-lines") {
        hitsRef.current = drawAtomicScene(ctx, rect, {
          species: s.species,
          view: s.view,
          window: s.window,
          selected: s.selected,
          samples: s.atomicSamples
        });
      } else if (s.mode === "blackbody") {
        drawBlackbodyScene(ctx, rect, {
          samples: s.bbSamples,
          tempK: s.tempK,
          logY: s.logY,
          logYMin: logRange.logMin,
          logYMax: logRange.logMax,
          overlays: s.bbOverlays,
          liveLabel: s.showUsualTemps ? `Live ${Math.round(s.tempK)} K` : undefined
        });
      } else {
        if (clock.moving) {
          // Oscillation phase: faster for higher frequency (soft-capped).
          const fNorm =
            (Math.log10(s.waveFreqHz) - Math.log10(FREQ_MIN_HZ)) / (Math.log10(FREQ_MAX_HZ) - Math.log10(FREQ_MIN_HZ));
          clock.phase += (1.6 + 3.4 * Math.min(1, Math.max(0, fNorm))) * dt;
          // Packet travel: the same visual "c" for every wavelength; wraps 0→1.
          clock.travel01 = (clock.travel01 + dt * 0.28) % 1;
        }
        // Room on both sides: the slanted B field reaches past the ends of the travel axis.
        const waveInsetL = 28;
        const waveInsetR = 30;
        ctx.save();
        ctx.translate(rect.x + waveInsetL, rect.y);
        drawTravelingEmWave(ctx, rect.w - waveInsetL - waveInsetR, rect.h, {
          lambdaNm: s.waveLambdaNm,
          phaseRad: clock.phase,
          travel01: clock.travel01,
          view: s.waveView,
          chrome: false
        });
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [logRange]);

  // Inset picture: the emitter (blackbody) or the colour tile (EM wave), drawn at device resolution.
  const drawInset = (whenImageLoads = true): void => {
    const canvas = insetRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || canvas.width < 2) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (mode === "blackbody") {
      // The image callback can fire synchronously when cached, so the repaint asks for none.
      drawEmitterPortrait(ctx, canvas.width, canvas.height, emitter, tempK, appearance,
        whenImageLoads ? () => drawInsetRef.current(false) : undefined);
    } else if (mode === "em-wave") {
      drawColorTile(ctx, canvas.width, canvas.height, waveSeen.color, waveSeen.band === "optical");
    }
  };
  const drawInsetRef = useRef(drawInset);
  drawInsetRef.current = drawInset;
  useCanvasBackingStore([insetRef], () => drawInsetRef.current());
  useEffect(() => {
    drawInsetRef.current();
  }, [mode, emitter, tempK, appearance, waveLambdaNm]);

  // Click a line in the atomic plot to select it; show a pointer over selectable lines.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const lineAt = (e: PointerEvent): SpectralLine | null => {
      const p = logicalPointer(e, canvas, STAGE_W, STAGE_H);
      let best: AtomicLineHit | null = null;
      for (const hit of hitsRef.current) {
        if (p.y >= hit.yTop && p.y <= hit.yBottom && Math.abs(p.x - hit.x) <= 9) {
          if (!best || Math.abs(p.x - hit.x) < Math.abs(p.x - best.x)) {
            best = hit;
          }
        }
      }
      return best?.line ?? null;
    };
    const onDown = (e: PointerEvent): void => {
      const line = lineAt(e);
      if (line) {
        setSelectedNm(line.lambdaNm);
      }
    };
    const onMove = (e: PointerEvent): void => {
      canvas.style.cursor = lineAt(e) ? "pointer" : "default";
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
    };
  }, []);

  function selectSpecies(id: AtomicSpeciesId): void {
    setSpeciesId(id);
    setSelectedNm(strongestLine(id).lambdaNm);
  }

  function onEmitterChange(next: EmitterId): void {
    setEmitter(next);
    setTempK(emitterPreset(next).usualTempK);
  }

  function onReset(): void {
    if (mode === "atomic-lines") {
      setSpeciesId("hydrogen");
      setView("emission");
      setSelectedNm(656.28);
      setZoomed(false);
    } else if (mode === "blackbody") {
      setEmitter("bulb");
      setTempK(emitterPreset("bulb").usualTempK);
      setAppearance("human-seen");
      setIntensityScale("absolute");
      setShowUsualTemps(false);
    } else {
      setWaveLambdaNm(WAVE_LAMBDA_DEFAULT_NM);
      setWaveView("wave");
      setWavePlaying(!reducedMotion);
    }
    host?.onResult?.({ event: "reset", mode });
  }

  const toolbar = (
    <>
      <StageSegmented ariaLabel="Radiation mode" value={mode} options={MODE_OPTIONS} onChange={setMode} />
      <StageDivider />
      {mode === "em-wave" ? (
        <StageIconButton
          icon={waveMoving ? "pause" : "play"}
          label={waveMoving ? "Pause" : "Play"}
          tip={TIP.play}
          disabled={reducedMotion}
          onClick={() => setWavePlaying((p) => !p)}
        />
      ) : null}
      <StageIconButton icon="reset" label="Reset" tip={TIP.reset} onClick={onReset} />
    </>
  );

  const atomicControls = (
    <>
      <StageSegmented
        ariaLabel="Element"
        label="Element"
        tip={TIP.element}
        value={speciesId}
        options={ATOMIC_SPECIES.map((atom) => ({ value: atom.id, label: atom.symbol, tip: `${atom.label} · ${atom.ion}` }))}
        onChange={selectSpecies}
      />
      <StageSegmented ariaLabel="Spectrum type" label="Spectrum" value={view} options={ATOMIC_VIEWS} onChange={setView} />
      <StageSegmented
        ariaLabel="Wavelength window"
        label="Window"
        tip={TIP.window}
        value={zoomed ? "zoom" : "visible"}
        options={[
          { value: "visible", label: "Visible" },
          { value: "zoom", label: "Line zoom" }
        ]}
        onChange={(v) => setZoomed(v === "zoom")}
      />
      <StageSection title="Line reference">
        <div className="em-line-list" role="group" aria-label="Line reference" title={TIP.lines} data-hover-help={TIP.lines}>
          {species.lines.map((line) => (
            <button
              type="button"
              key={line.lambdaNm}
              className="em-line"
              aria-label={`${line.label} ${line.lambdaNm.toFixed(2)} nm`}
              aria-pressed={selected === line}
              onClick={() => setSelectedNm(line.lambdaNm)}
            >
              <span className="em-line-swatch" aria-hidden="true" style={{ backgroundColor: atomicLineColor(line.lambdaNm) }} />
              <span>{line.label}</span>
              <strong>{line.lambdaNm.toFixed(2)}</strong>
            </button>
          ))}
        </div>
      </StageSection>
    </>
  );

  const blackbodyControls = (
    <>
      <StageSegmented
        ariaLabel="Thermal emitter"
        label="Emitter"
        tip={TIP.emitter}
        value={emitter}
        options={EMITTER_PRESETS.map((p) => ({ value: p.id, label: p.label, tip: p.blurb }))}
        onChange={onEmitterChange}
      />
      <StageSlider
        label="Temperature"
        display={`${Math.round(tempK)} K`}
        value={logSlider(clampTempK(tempK), TEMP_MIN_K, TEMP_MAX_K)}
        min={0}
        max={100}
        step={0.1}
        tip={TIP.temperature}
        onChange={(v) => setTempK(clampTempK(fromLogSlider(v, TEMP_MIN_K, TEMP_MAX_K)))}
      />
      <StagePills>
        <StagePillButton
          label={`Usual temperature (${Math.round(preset.usualTempK)} K)`}
          tip={TIP.usual}
          onClick={() => setTempK(preset.usualTempK)}
        />
      </StagePills>
      <StageSegmented
        ariaLabel="Intensity scale"
        label="Intensity scale"
        tip={TIP.scale}
        value={intensityScale}
        options={[
          { value: "absolute", label: "Absolute (log scale)" },
          { value: "relative", label: "Relative (peak-normalized)" }
        ]}
        onChange={setIntensityScale}
      />
      <StagePills>
        <StageToggle label="Show usual temperatures" on={showUsualTemps} tip={TIP.usualTemps} onChange={setShowUsualTemps} />
      </StagePills>
      <StageSegmented
        ariaLabel="Appearance mode"
        label="Appearance on the right"
        tip={TIP.appearance}
        value={appearance}
        options={[
          { value: "human-seen", label: "Human-seen color" },
          { value: "em-false-color", label: "EM false-color (IR / optical / UV)" }
        ]}
        onChange={setAppearance}
      />
    </>
  );

  const waveControls = (
    <>
      <StageSegmented
        ariaLabel="Wave or photon picture"
        label="Picture"
        tip={TIP.picture}
        value={waveView}
        options={[
          { value: "wave", label: "Wave (extended E & B)" },
          { value: "photon", label: "Photon (short packet)" }
        ]}
        onChange={setWaveView}
      />
      <StageSlider
        label="Wavelength"
        display={formatWavelength(waveLambdaNm)}
        value={logSlider(waveLambdaNm, WAVE_LAMBDA_MIN_NM, WAVE_LAMBDA_MAX_NM)}
        min={0}
        max={100}
        step={0.1}
        tip={TIP.wavelength}
        onChange={(v) => setWaveLambdaNm(clampWaveLambdaNm(fromLogSlider(v, WAVE_LAMBDA_MIN_NM, WAVE_LAMBDA_MAX_NM)))}
      />
      <StageSlider
        label="Frequency"
        display={formatFrequency(waveFreqHz)}
        value={logSlider(Math.min(FREQ_MAX_HZ, Math.max(FREQ_MIN_HZ, waveFreqHz)), FREQ_MIN_HZ, FREQ_MAX_HZ)}
        min={0}
        max={100}
        step={0.1}
        tip={TIP.frequency}
        onChange={(v) => setWaveLambdaNm(lambdaNmFromFrequencyHz(fromLogSlider(v, FREQ_MIN_HZ, FREQ_MAX_HZ)))}
      />
      <StagePills>
        <StagePillButton label="Green light (550 nm)" tip={TIP.green} onClick={() => setWaveLambdaNm(WAVE_LAMBDA_DEFAULT_NM)} />
      </StagePills>
    </>
  );

  const hydrogen = selected.lowerN != null && selected.upperN != null;
  const transition =
    view === "continuum"
      ? "none"
      : hydrogen
        ? view === "emission"
          ? `n = ${selected.upperN} → ${selected.lowerN}`
          : `n = ${selected.lowerN} → ${selected.upperN}`
        : view === "emission"
          ? "upper → lower"
          : "lower → upper";
  const peakNm = wienPeakNm(tempK);
  const glow = appearanceColor(tempK, appearance);
  const joke = mode === "blackbody" && emitter === "human" ? humanJoke(tempK) : null;

  const numbers =
    mode === "atomic-lines" ? (
      <>
        <StageHero label={selected.label} value={`${selected.lambdaNm.toFixed(2)} nm`} tip={TIP.lineHero} />
        <StageReadout label="Photon energy" value={`${photonEnergyEv(selected.lambdaNm).toFixed(2)} eV`} tip={TIP.energy} />
        <StageReadout label="Transition" value={transition} />
        <StageReadout label={species.label} value={species.ion} muted />
      </>
    ) : mode === "blackbody" ? (
      <>
        <StageHero label="Peak λ_max" value={formatWavelength(peakNm)} tip={TIP.peakHero} />
        <StageReadout label="Temperature" value={`${Math.round(tempK)} K`} />
        <StageReadout label="Peak band" value={peakBand(peakNm)} tip={TIP.peakBand} />
        <StageReadout
          label="Glow color"
          value={<span className="em-color-dot" style={{ backgroundColor: rgbCss(glow) }} aria-hidden="true" />}
          tip={TIP.seenColor}
        />
        {joke ? <p className="em-joke" role="status">{joke}</p> : null}
      </>
    ) : (
      <>
        <StageHero label="Wavelength" value={formatWavelength(waveLambdaNm)} />
        <StageReadout label="Frequency" value={formatFrequency(waveFreqHz)} />
        <StageReadout label="Photon energy" value={`${photonEnergyEv(waveLambdaNm).toFixed(2)} eV`} tip={TIP.energy} />
        <StageReadout label="Band" value={bandLabel(waveSeen.band).split(" — ")[0]} />
      </>
    );

  const figure = (
    <div className="em-card-figure" title={mode === "atomic-lines" ? TIP.levels : undefined}>
      {mode === "atomic-lines" ? <AtomicTransition line={selected} view={view} /> : null}
      <canvas
        ref={insetRef}
        className="em-inset-canvas"
        style={{ display: mode === "atomic-lines" ? "none" : "block", aspectRatio: mode === "blackbody" ? "250 / 290" : "250 / 190" }}
        role="img"
        aria-label={mode === "blackbody" ? `${preset.label} at ${Math.round(tempK)} K` : `Color of ${formatWavelength(waveLambdaNm)} light`}
      />
    </div>
  );

  const readouts = (
    <>
      {numbers}
      {figure}
    </>
  );

  const info =
    mode === "atomic-lines" ? (
      <>
        <h4>Reading the picture</h4>
        <ul>
          <li>The strip is what a spectrograph would show; the curve below is its intensity at each wavelength.</li>
          <li>Click a line in the plot or the line list to select it; Line zoom shows 8 nm around it.</li>
          <li>The energy diagram shows the selected transition: emission arrows point down, absorption arrows up.</li>
          <li>Absorption removes light from the line of sight; it does not destroy photons.</li>
        </ul>
        <h4>Model</h4>
        <ul>
          <li>
            Wavelengths are rest values in standard air from the{" "}
            <a href={species.sourceUrl} target="_blank" rel="noreferrer">
              NIST Handbook ({species.ion})
            </a>
            . The line lists are deliberately incomplete.
          </li>
          <li>Line strengths are illustrative, not measured ratios. Each line is a Gaussian with a fixed width of 0.07 nm.</li>
          <li>Hydrogen levels use E ≈ −13.6 / n² eV (fine structure omitted); other species show only the energy gap.</li>
          <li>Colors are illustrative display colors, not calibrated colorimetry. ΔE ≈ hc/λ (air wavelengths: under 0.04% error).</li>
        </ul>
      </>
    ) : mode === "blackbody" ? (
      <>
        <h4>Reading the picture</h4>
        <ul>
          <li>The curve is the Planck spectrum for the chosen temperature; the dashed line marks its peak, λ_max = b / T.</li>
          <li>Absolute uses one fixed log scale, so hotter bodies sit higher; Relative scales each curve to its own peak.</li>
          <li>The picture shows the glow: human-seen color from the visible part of the curve, or false color with infrared → red, optical → green, ultraviolet → blue.</li>
          <li>{preset.blurb}</li>
        </ul>
        <h4>Model</h4>
        <ul>
          <li>Ideal blackbody spectra; real bulbs, people and stars only approximate one.</li>
          <li>Pictures are generated illustrative images, tinted by temperature; not scientific photographs.</li>
        </ul>
      </>
    ) : (
      <>
        <h4>Reading the picture</h4>
        <ul>
          <li>E (blue) and B (pink) are perpendicular to each other and to the direction of travel.</li>
          <li>Shorter wavelength means higher frequency: f = c / λ, so the peaks pack closer together.</li>
          <li>Photon view: a short packet about two wavelengths long that wraps around at the edge.</li>
        </ul>
        <h4>Model</h4>
        <ul>
          <li>Schematic: the number of cycles on screen is not to scale, and every wavelength travels at the same visual speed.</li>
          <li>The color tile is the human-seen color for visible light; ultraviolet and infrared are shown dimmed because the eye cannot see them.</li>
        </ul>
      </>
    );

  const controls = mode === "atomic-lines" ? atomicControls : mode === "blackbody" ? blackbodyControls : waveControls;
  const label =
    mode === "atomic-lines"
      ? `${species.label} ${view} spectrum`
      : mode === "blackbody"
        ? `Blackbody spectrum at ${Math.round(tempK)} K`
        : `Travelling ${waveView === "photon" ? "photon" : "electromagnetic wave"} at ${formatWavelength(waveLambdaNm)}`;

  return (
    <AppletStage
      logicalWidth={STAGE_W}
      logicalHeight={STAGE_H}
      canvasRef={canvasRef}
      canvasLabel={label}
      toolbar={toolbar}
      controls={controls}
      readouts={readouts}
      info={info}
      play={{ visible: mode === "em-wave" && !waveMoving && !reducedMotion, label: "Play", onClick: () => setWavePlaying(true) }}
      rootClassName="em-stage"
      controlsWidth={CONTROLS_W}
      onControlsVisibilityChange={setControlsVisible}
    />
  );
}
