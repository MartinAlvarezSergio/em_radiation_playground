import { ATOMIC_LINE_SIGMA_NM, type AtomicSpecies, type SpectralLine, type SpectralWindow } from "./atomicLines";
import { atomicLineColor } from "./atomicColor";
import { LAMBDA_MAX_NM, LAMBDA_MIN_NM, wienPeakNm, type Rgb } from "./blackbody";
import type { AtomicViewMode, SpectrumSample } from "./types";

/**
 * Stage scenes for the Light, heat, and spectra applet. Each draws inside `rect` (logical
 * units), the part of the stage left clear of the overlay panels, over the stage surface.
 */

export type SceneRect = { x: number; y: number; w: number; h: number };

const TEXT = "rgba(230, 228, 220, 0.92)";
const MUTED = "rgba(200, 196, 188, 0.7)";
const HAIRLINE = "rgba(255, 255, 255, 0.12)";
const GRID = "rgba(255, 255, 255, 0.06)";
const MARKER = "#fff1bf";
const FONT = "12px system-ui, sans-serif";
const FONT_SMALL = "11px system-ui, sans-serif";
const FONT_HEADING = "600 13px system-ui, sans-serif";

export function drawStageSurface(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#060a12");
  bg.addColorStop(1, "#0f141c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// Atomic spectra
// ---------------------------------------------------------------------------

export type AtomicSceneInput = {
  species: AtomicSpecies;
  view: AtomicViewMode;
  window: SpectralWindow;
  selected: SpectralLine;
  samples: SpectrumSample[];
};

/** Where each visible line sits, for click selection. */
export type AtomicLineHit = { line: SpectralLine; x: number; yTop: number; yBottom: number };

export function drawAtomicScene(
  ctx: CanvasRenderingContext2D,
  rect: SceneRect,
  input: AtomicSceneInput
): AtomicLineHit[] {
  const { species, view, window, selected, samples } = input;
  const padL = rect.w < 420 ? 34 : 44;
  const x0 = rect.x + padL;
  const x1 = rect.x + rect.w - 8;
  const plotW = Math.max(40, x1 - x0);
  const { minNm, maxNm } = window;
  const span = maxNm - minNm;
  const xAt = (lambdaNm: number): number => x0 + ((lambdaNm - minNm) / span) * plotW;

  const lightPathH = Math.min(118, Math.max(78, rect.h * 0.21));
  const stripTop = rect.y + 30;
  const stripH = Math.min(72, Math.max(44, rect.h * 0.13));
  const plotTop = stripTop + stripH + 40;
  const plotBottom = rect.y + rect.h - lightPathH - 56;
  const plotH = Math.max(60, plotBottom - plotTop);
  const yAt = (value: number): number => plotBottom - Math.min(1.05, Math.max(0, value)) * plotH;

  // Heading row: spectrum type and wavelength window.
  ctx.font = FONT_HEADING;
  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(view[0].toUpperCase() + view.slice(1), x0, rect.y + 14);
  ctx.font = FONT_SMALL;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText(`${minNm.toFixed(span < 20 ? 1 : 0)}–${maxNm.toFixed(span < 20 ? 1 : 0)} nm`, x1, rect.y + 14);

  // Colour strip: what a spectrograph would show.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, stripTop, plotW, stripH, 5);
  ctx.clip();
  if (view === "emission") {
    ctx.fillStyle = "#000";
  } else {
    const rainbow = ctx.createLinearGradient(x0, 0, x1, 0);
    for (let i = 0; i <= 80; i += 1) {
      rainbow.addColorStop(i / 80, atomicLineColor(minNm + (i / 80) * span));
    }
    ctx.fillStyle = rainbow;
  }
  ctx.fillRect(x0, stripTop, plotW, stripH);
  const visibleLines = species.lines.filter((line) => line.lambdaNm >= minNm && line.lambdaNm <= maxNm);
  if (view !== "continuum") {
    // A minimum display width keeps unresolved lines visible in the overview.
    const sigmaPx = Math.max(0.75, (ATOMIC_LINE_SIGMA_NM * plotW) / span);
    for (const line of visibleLines) {
      const cx = xAt(line.lambdaNm);
      const g = ctx.createLinearGradient(cx - 6 * sigmaPx, 0, cx + 6 * sigmaPx, 0);
      const color = view === "absorption" ? "0, 0, 0" : rgbTriplet(atomicLineColor(line.lambdaNm));
      const depth = view === "absorption" ? 0.88 : 1;
      for (let j = 0; j <= 24; j += 1) {
        const alpha = Math.exp(-0.5 * ((j - 12) / 2) ** 2) * line.strength * depth;
        g.addColorStop(j / 24, `rgba(${color}, ${alpha.toFixed(3)})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(cx - 6 * sigmaPx, stripTop, 12 * sigmaPx, stripH);
    }
  }
  ctx.restore();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x0 + 0.5, stripTop + 0.5, plotW - 1, stripH - 1, 5);
  ctx.stroke();

  // Intensity plot.
  ctx.font = FONT_SMALL;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.fillText(view === "emission" ? "Relative intensity" : "Intensity / continuum", x0, plotTop - 12);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const value of [0, 0.5, 1]) {
    const y = Math.round(yAt(value)) + 0.5;
    ctx.strokeStyle = value === 0 ? HAIRLINE : GRID;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.fillText(String(value), x0 - 8, y);
  }
  const narrow = plotW < 420;
  const tickStep = span < 20 ? (narrow ? 2 : 1) : narrow ? 100 : 50;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let tick = Math.ceil(minNm / tickStep) * tickStep; tick <= maxNm + 1e-9; tick += tickStep) {
    const x = Math.round(xAt(tick)) + 0.5;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(String(tick), x, plotBottom + 8);
  }
  ctx.fillText("Wavelength (nm, air)", x0 + plotW / 2, plotBottom + 26);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, plotTop - 4, plotW, plotH + 4);
  ctx.clip();
  ctx.beginPath();
  samples.forEach((s, i) => {
    const x = xAt(s.lambdaNm);
    const y = yAt(s.value);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = "#d4eaff";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineTo(x1, plotBottom);
  ctx.lineTo(x0, plotBottom);
  ctx.closePath();
  ctx.fillStyle = "rgba(172, 217, 255, 0.07)";
  ctx.fill();
  ctx.restore();

  // Selected-line marker through strip and plot.
  const hits: AtomicLineHit[] = [];
  if (view !== "continuum") {
    for (const line of visibleLines) {
      hits.push({ line, x: xAt(line.lambdaNm), yTop: stripTop - 8, yBottom: plotBottom + 6 });
    }
    if (selected.lambdaNm >= minNm && selected.lambdaNm <= maxNm) {
      const x = Math.round(xAt(selected.lambdaNm)) + 0.5;
      ctx.strokeStyle = MARKER;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(x, stripTop - 5);
      ctx.lineTo(x, stripTop + stripH + 5);
      ctx.moveTo(x, plotTop - 2);
      ctx.lineTo(x, plotBottom + 5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = MARKER;
      ctx.beginPath();
      ctx.moveTo(x - 5, stripTop - 13);
      ctx.lineTo(x + 5, stripTop - 13);
      ctx.lineTo(x, stripTop - 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawLightPath(ctx, { x: x0, y: rect.y + rect.h - lightPathH, w: plotW, h: lightPathH }, view, selected);
  return hits;
}

function rgbTriplet(css: string): string {
  const m = css.match(/rgba?\(([^)]+)\)/);
  return m ? m[1].split(",").slice(0, 3).join(",") : "255, 255, 255";
}

function photonPath(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, amp: number): void {
  ctx.beginPath();
  for (let i = 0; i <= 64; i += 1) {
    const t = i / 64;
    const x = x0 + (x1 - x0) * t;
    const yy = y + amp * Math.sin(t * Math.PI * 8);
    if (i === 0) {
      ctx.moveTo(x, yy);
    } else {
      ctx.lineTo(x, yy);
    }
  }
}

/** Source → gas → observer schematic (static; arbitrary spatial scale). */
function drawLightPath(
  ctx: CanvasRenderingContext2D,
  r: SceneRect,
  view: AtomicViewMode,
  line: SpectralLine
): void {
  const k = r.h / 122;
  const color = atomicLineColor(line.lambdaNm);
  const cy = r.y + 49 * k;
  const labelY = r.y + 108 * k;
  const sourceX = r.x + Math.max(30 * k, r.w * 0.06);
  const gasHalf = 57 * k;
  const gasX = view === "emission" ? r.x + gasHalf + 12 * k : r.x + r.w * 0.44;
  const observerX = r.x + r.w - 26 * k;

  ctx.font = FONT_SMALL;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  if (view !== "emission") {
    const star = ctx.createRadialGradient(sourceX, cy, 0, sourceX, cy, 24 * k);
    star.addColorStop(0, "#fffbe3");
    star.addColorStop(0.7, "#ffd88a");
    star.addColorStop(1, "#e5a053");
    ctx.fillStyle = star;
    ctx.beginPath();
    ctx.arc(sourceX, cy, 24 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.fillText("Hot source", sourceX, labelY);
    const beamEnd = view === "absorption" ? gasX - gasHalf - 9 * k : observerX - 36 * k;
    ctx.strokeStyle = "rgba(230, 231, 223, 0.28)";
    ctx.lineWidth = 8 * k;
    ctx.beginPath();
    ctx.moveTo(sourceX + 34 * k, cy);
    ctx.lineTo(beamEnd, cy);
    ctx.stroke();
    if (view === "absorption") {
      photonPath(ctx, sourceX + 34 * k, gasX - gasHalf - 8 * k, cy, 5 * k);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * k;
      ctx.stroke();
    }
  }

  if (view !== "continuum") {
    ctx.fillStyle = view === "emission" ? "#243346" : "#172431";
    ctx.strokeStyle = "#7697b6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.roundRect(gasX - gasHalf, r.y + 19 * k, gasHalf * 2, 61 * k, 20 * k);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = view === "emission" ? "#f2dcb0" : "#90b9dc";
    for (const [dx, dy] of [[-30, -10], [-5, 14], [24, -13], [34, 10], [-27, 16], [0, -9]]) {
      ctx.beginPath();
      ctx.arc(gasX + dx * k, cy + dy * k, 3.5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = MUTED;
    ctx.fillText(view === "emission" ? "Excited gas" : "Cooler gas", gasX, labelY);
    if (view === "absorption") {
      ctx.strokeStyle = "rgba(230, 231, 223, 0.22)";
      ctx.lineWidth = 8 * k;
      ctx.beginPath();
      ctx.moveTo(gasX + gasHalf + 9 * k, cy);
      ctx.lineTo(observerX - 36 * k, cy);
      ctx.stroke();
      // Absorbed light re-emitted in other directions, out of the line of sight.
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.moveTo(gasX, r.y + 18 * k);
      ctx.lineTo(gasX + 14 * k, r.y + 5 * k);
      ctx.moveTo(gasX, r.y + 81 * k);
      ctx.lineTo(gasX + 14 * k, r.y + 92 * k);
      ctx.stroke();
    } else {
      photonPath(ctx, gasX + gasHalf + 10 * k, observerX - 43 * k, cy, 5 * k);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * k;
      ctx.stroke();
    }
  }

  // Observer: small telescope on a tripod, with an arrow showing the light arriving.
  ctx.strokeStyle = "#bbc9da";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(observerX - 81 * k, r.y + 67 * k);
  ctx.lineTo(observerX - 40 * k, r.y + 67 * k);
  ctx.stroke();
  ctx.fillStyle = "#bbc9da";
  ctx.beginPath();
  ctx.moveTo(observerX - 36 * k, r.y + 67 * k);
  ctx.lineTo(observerX - 43 * k, r.y + 63.5 * k);
  ctx.lineTo(observerX - 43 * k, r.y + 70.5 * k);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#c0d6eb";
  ctx.fillStyle = "#26394c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(observerX - 20 * k, r.y + 31 * k);
  ctx.lineTo(observerX + 22 * k, r.y + 40 * k);
  ctx.lineTo(observerX + 18 * k, r.y + 63 * k);
  ctx.lineTo(observerX - 24 * k, r.y + 54 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(observerX, r.y + 60 * k);
  ctx.lineTo(observerX, r.y + 71 * k);
  ctx.lineTo(observerX - 14 * k, r.y + 87 * k);
  ctx.moveTo(observerX, r.y + 71 * k);
  ctx.lineTo(observerX + 14 * k, r.y + 87 * k);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.fillText("Observer", observerX, labelY);
}

// ---------------------------------------------------------------------------
// Blackbody
// ---------------------------------------------------------------------------

export type BlackbodyCurve = { samples: SpectrumSample[]; color: string; label: string };

export type BlackbodySceneInput = {
  samples: SpectrumSample[];
  tempK: number;
  logY: boolean;
  logYMin: number;
  logYMax: number;
  /** Dashed reference curves (usual temperatures). */
  overlays: BlackbodyCurve[];
  liveLabel?: string;
};

const LIVE = "rgba(120, 210, 255, 0.95)";
const SUPERSCRIPT: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

function decadeLabel(exp: number): string {
  return `10${String(exp).replace(/[-0-9]/g, (c) => SUPERSCRIPT[c])}`;
}

export function drawBlackbodyScene(ctx: CanvasRenderingContext2D, rect: SceneRect, input: BlackbodySceneInput): void {
  const { samples, tempK, logY, overlays } = input;
  const x0 = rect.x + 56;
  const x1 = rect.x + rect.w - 10;
  const top = rect.y + 28;
  const bottom = rect.y + rect.h - 58;
  const plotW = Math.max(40, x1 - x0);
  const plotH = Math.max(60, bottom - top);
  const lo = LAMBDA_MIN_NM;
  const hi = LAMBDA_MAX_NM;
  const xAt = (lambdaNm: number): number =>
    x0 + ((Math.log(Math.min(hi, Math.max(lo, lambdaNm))) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * plotW;

  let yMin = 0;
  let yMax = 1;
  if (logY) {
    yMin = input.logYMin;
    yMax = input.logYMax > input.logYMin ? input.logYMax : input.logYMin + 1;
  } else {
    let peak = 0;
    for (const curve of [samples, ...overlays.map((o) => o.samples)]) {
      for (const s of curve) {
        peak = Math.max(peak, s.value);
      }
    }
    yMax = peak > 0 ? peak * 1.08 : 1;
  }
  const yAt = (value: number): number => {
    const t = logY ? (Math.log10(Math.max(value, 1e-300)) - yMin) / (yMax - yMin) : value / yMax;
    return bottom - Math.min(1, Math.max(0, t)) * plotH;
  };

  // Band context: faint visible-band wash and band names along the top.
  const v0 = xAt(380);
  const v1 = xAt(750);
  ctx.fillStyle = "rgba(255, 255, 220, 0.045)";
  ctx.fillRect(v0, top, v1 - v0, plotH);
  ctx.font = FONT_SMALL;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("UV", (x0 + v0) / 2, top - 10);
  ctx.fillText("visible", (v0 + v1) / 2, top - 10);
  ctx.fillText("infrared", (v1 + x1) / 2, top - 10);

  // Gridlines and y labels.
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  if (logY) {
    const step = plotH / (yMax - yMin) < 18 ? 2 : 1;
    for (let exp = Math.ceil(yMin); exp <= Math.floor(yMax); exp += 1) {
      const y = Math.round(yAt(10 ** exp)) + 0.5;
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      if (exp % step === 0) {
        ctx.fillStyle = MUTED;
        ctx.fillText(decadeLabel(exp), x0 - 8, y);
      }
    }
  } else {
    for (const f of [0, 0.5, 1]) {
      const y = Math.round(bottom - f * plotH) + 0.5;
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.fillText((f * yMax).toFixed(f === 0 ? 0 : 1), x0 - 8, y);
    }
  }

  const strokeCurve = (curve: SpectrumSample[], color: string, width: number, dashed: boolean, fill: boolean): void => {
    ctx.beginPath();
    let started = false;
    let first = 0;
    let last = 0;
    for (const s of curve) {
      if (logY && !(s.value > 0)) {
        continue;
      }
      const x = xAt(s.lambdaNm);
      const y = yAt(s.value);
      if (!started) {
        ctx.moveTo(x, y);
        first = x;
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      last = x;
    }
    if (!started) {
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.setLineDash(dashed ? [6, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (fill) {
      ctx.lineTo(last, bottom);
      ctx.lineTo(first, bottom);
      ctx.closePath();
      ctx.fillStyle = "rgba(120, 210, 255, 0.09)";
      ctx.fill();
    }
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, top, plotW, plotH);
  ctx.clip();
  for (const overlay of overlays) {
    strokeCurve(overlay.samples, overlay.color, 1.6, true, false);
  }
  strokeCurve(samples, LIVE, 2.5, false, true);
  ctx.restore();

  // Wien peak: dashed drop line from the curve's peak, with a dot and a short label.
  const peakNm = wienPeakNm(tempK);
  if (peakNm >= lo && peakNm <= hi) {
    let peakValue = 0;
    for (const s of samples) {
      if (Math.abs(Math.log(s.lambdaNm / peakNm)) < 0.02) {
        peakValue = Math.max(peakValue, s.value);
      }
    }
    if (peakValue === 0) {
      peakValue = samples.reduce((m, s) => Math.max(m, s.value), 0);
    }
    const x = xAt(peakNm);
    const y = yAt(peakValue);
    ctx.strokeStyle = "rgba(255, 200, 140, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffd8a8";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = FONT;
    ctx.fillStyle = TEXT;
    const toLeft = x > x1 - 60;
    ctx.textAlign = toLeft ? "right" : "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("λ_max", x + (toLeft ? -8 : 8), y - 4);
  }

  // Legend for reference curves.
  if (overlays.length > 0) {
    const items = [
      ...(input.liveLabel ? [{ label: input.liveLabel, color: LIVE, dashed: false }] : []),
      ...overlays.map((o) => ({ label: o.label, color: o.color, dashed: true }))
    ];
    ctx.font = FONT_SMALL;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lx = x1 - 150;
    let ly = top + 14;
    for (const item of items) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(item.dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 20, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = MUTED;
      ctx.fillText(item.label, lx + 26, ly);
      ly += 17;
    }
  }

  // X axis with a thin visible-spectrum strip under 380–750 nm.
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, Math.round(bottom) + 0.5);
  ctx.lineTo(x1, Math.round(bottom) + 0.5);
  ctx.stroke();
  const strip = ctx.createLinearGradient(v0, 0, v1, 0);
  for (let i = 0; i <= 24; i += 1) {
    strip.addColorStop(i / 24, atomicLineColor(380 + (i / 24) * 370));
  }
  ctx.fillStyle = strip;
  ctx.fillRect(v0, bottom + 3, v1 - v0, 4);
  const ticks: [number, string][] = [
    [100, "100 nm"], [200, "200"], [400, "400"], [700, "700"], [1000, "1 µm"],
    [2000, "2"], [5000, "5"], [10_000, "10"], [30_000, "30 µm"]
  ];
  ctx.font = FONT_SMALL;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const [nm, label] of ticks) {
    ctx.fillText(label, xAt(nm), bottom + 12);
  }
  ctx.fillText("wavelength", x0 + plotW / 2, bottom + 32);
  ctx.save();
  ctx.translate(rect.x + 12, top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText(logY ? "intensity (log scale)" : "relative intensity", 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Colour tile (EM wave inset)
// ---------------------------------------------------------------------------

/** Rounded swatch of the human-seen colour, glowing only for visible light. Device-pixel sized. */
export function drawColorTile(ctx: CanvasRenderingContext2D, width: number, height: number, color: Rgb, visible: boolean): void {
  ctx.clearRect(0, 0, width, height);
  const pad = Math.round(Math.min(width, height) * 0.12);
  const css = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
  ctx.save();
  if (visible) {
    ctx.shadowColor = css;
    ctx.shadowBlur = pad * 1.2;
  }
  ctx.fillStyle = css;
  ctx.globalAlpha = visible ? 1 : 0.55;
  ctx.beginPath();
  ctx.roundRect(pad, pad, width - 2 * pad, height - 2 * pad, pad * 0.6);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = Math.max(1, width / 250);
  ctx.beginPath();
  ctx.roundRect(pad, pad, width - 2 * pad, height - 2 * pad, pad * 0.6);
  ctx.stroke();
}
