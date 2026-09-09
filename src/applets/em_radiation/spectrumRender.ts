import type { SpectrumSample } from "./types";
import { LAMBDA_MAX_NM, LAMBDA_MIN_NM, wienPeakNm } from "./blackbody";
import type { SpectralLine } from "./atomicLines";

const PAD_L = 78;
const PAD_R = 22;
const PAD_T = 42;
const PAD_B = 58;

export type SpectrumOverlay = {
  samples: SpectrumSample[];
  color: string;
  label: string;
  /** Dashed stroke (default true for reference curves). */
  dashed?: boolean;
};

export type SpectrumPlotOptions = {
  title: string;
  logX?: boolean;
  /** Log₁₀ intensity axis with a fixed window (blackbody temperature comparisons). */
  logY?: boolean;
  logYMin?: number;
  logYMax?: number;
  showOpticalBand?: boolean;
  wienTempK?: number | null;
  lineMarkers?: SpectralLine[];
  lambdaMinNm?: number;
  lambdaMaxNm?: number;
  yAxisLabel?: string;
  /** Extra curves drawn under the primary sample (e.g. usual-T presets). */
  overlays?: SpectrumOverlay[];
  primaryLabel?: string;
};

function fillFromStroke(color: string): string {
  const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(",").map((p) => p.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, 0.12)`;
  }
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    return `${color.length === 7 ? color : color}22`;
  }
  return "rgba(80, 160, 255, 0.12)";
}

export function drawSpectrumPlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  samples: SpectrumSample[],
  options: SpectrumPlotOptions
): void {
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#071018");
  bg.addColorStop(1, "#121a28");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const lo = options.lambdaMinNm ?? LAMBDA_MIN_NM;
  const hi = options.lambdaMaxNm ?? LAMBDA_MAX_NM;
  const logX = Boolean(options.logX);
  const logY = Boolean(options.logY);
  const overlays = options.overlays ?? [];

  let yMin = 0;
  let yMax = 1;
  if (logY) {
    yMin = options.logYMin ?? -20;
    yMax = options.logYMax ?? 0;
    if (!(yMax > yMin)) {
      yMax = yMin + 1;
    }
  } else {
    let peak = 0;
    for (const s of samples) {
      peak = Math.max(peak, s.value);
    }
    for (const overlay of overlays) {
      for (const s of overlay.samples) {
        peak = Math.max(peak, s.value);
      }
    }
    yMax = peak > 0 ? peak : 1;
    yMin = 0;
  }

  const xAt = (lambdaNm: number): number => {
    const clamped = Math.min(hi, Math.max(lo, lambdaNm));
    if (logX) {
      const t = (Math.log(clamped) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
      return PAD_L + t * plotW;
    }
    return PAD_L + ((clamped - lo) / (hi - lo)) * plotW;
  };

  const yAt = (value: number): number => {
    if (logY) {
      const v = Math.max(value, 1e-300);
      const lv = Math.log10(v);
      const t = (lv - yMin) / (yMax - yMin);
      return PAD_T + plotH - Math.min(1, Math.max(0, t)) * plotH;
    }
    const t = value / yMax;
    return PAD_T + plotH - Math.min(1, Math.max(0, t)) * plotH * 0.92;
  };

  const strokeCurve = (
    curve: SpectrumSample[],
    color: string,
    lineWidth: number,
    dashed: boolean,
    withFill: boolean
  ): void => {
    if (curve.length < 2) {
      return;
    }
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < curve.length; i += 1) {
      const s = curve[i];
      if (logY && !(s.value > 0)) {
        started = false;
        continue;
      }
      const x = xAt(s.lambdaNm);
      const y = yAt(s.value);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (!started) {
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashed ? [7, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (withFill) {
      ctx.lineTo(xAt(curve[curve.length - 1].lambdaNm), PAD_T + plotH);
      ctx.lineTo(xAt(curve[0].lambdaNm), PAD_T + plotH);
      ctx.closePath();
      ctx.fillStyle = fillFromStroke(color);
      ctx.fill();
    }
  };

  // Optical band tint.
  if (options.showOpticalBand !== false) {
    const x0 = xAt(380);
    const x1 = xAt(750);
    ctx.fillStyle = "rgba(255, 255, 220, 0.06)";
    ctx.fillRect(x0, PAD_T, Math.max(0, x1 - x0), plotH);
    ctx.fillStyle = "rgba(255, 240, 180, 0.85)";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("optical", (x0 + x1) / 2, PAD_T + 20);
  }

  // Axes.
  ctx.strokeStyle = "rgba(160, 190, 230, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, PAD_T + plotH);
  ctx.lineTo(PAD_L + plotW, PAD_T + plotH);
  ctx.stroke();

  ctx.fillStyle = "rgba(230, 238, 250, 0.95)";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(options.title, PAD_L, 28);

  // Reference overlays first, then the live curve on top.
  for (const overlay of overlays) {
    strokeCurve(overlay.samples, overlay.color, 2, overlay.dashed !== false, false);
  }
  strokeCurve(samples, "rgba(120, 210, 255, 0.95)", 2.5, false, true);

  // Log-Y decade ticks.
  if (logY) {
    const tickStart = Math.ceil(yMin);
    const tickEnd = Math.floor(yMax);
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let exp = tickStart; exp <= tickEnd; exp += 1) {
      const y = yAt(10 ** exp);
      if (y < PAD_T - 2 || y > PAD_T + plotH + 2) {
        continue;
      }
      ctx.strokeStyle = "rgba(140, 160, 190, 0.22)";
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + plotW, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(200, 215, 235, 0.9)";
      ctx.fillText(`10^${exp}`, PAD_L - 8, y + 4);
    }
  }

  // Wien marker.
  if (options.wienTempK != null && options.wienTempK > 0) {
    const peak = wienPeakNm(options.wienTempK);
    if (peak >= lo && peak <= hi) {
      const x = xAt(peak);
      ctx.strokeStyle = "rgba(255, 190, 120, 0.9)";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 215, 160, 0.98)";
      ctx.font = "600 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`λ_max ≈ ${peak.toFixed(0)} nm`, x, PAD_T + plotH + 36);
    }
  }

  // Line markers.
  if (options.lineMarkers) {
    for (const line of options.lineMarkers) {
      if (line.lambdaNm < lo || line.lambdaNm > hi) {
        continue;
      }
      const x = xAt(line.lambdaNm);
      ctx.strokeStyle = "rgba(255, 160, 200, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, PAD_T + plotH);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, PAD_T + 10);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "rgba(255, 210, 230, 0.95)";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(line.label, 0, -5);
      ctx.restore();
    }
  }

  // Legend when overlays are present.
  if (overlays.length > 0) {
    const items = [
      ...(options.primaryLabel
        ? [{ label: options.primaryLabel, color: "rgba(120, 210, 255, 0.95)", dashed: false }]
        : []),
      ...overlays.map((o) => ({
        label: o.label,
        color: o.color,
        dashed: o.dashed !== false
      }))
    ];
    let legendY = PAD_T + 36;
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    for (const item of items) {
      const lx = PAD_L + plotW - 168;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(item.dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(lx, legendY);
      ctx.lineTo(lx + 22, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(220, 230, 245, 0.95)";
      ctx.fillText(item.label, lx + 28, legendY + 4);
      legendY += 18;
    }
  }

  // X ticks.
  const ticks = logX
    ? [100, 200, 400, 700, 1000, 2000, 5000, 10_000, 30_000].filter((v) => v >= lo && v <= hi)
    : [100, 200, 400, 600, 800].filter((v) => v >= lo && v <= hi);
  ctx.fillStyle = "rgba(210, 220, 240, 0.92)";
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const tick of ticks) {
    const x = xAt(tick);
    ctx.strokeStyle = "rgba(140, 160, 190, 0.3)";
    ctx.beginPath();
    ctx.moveTo(x, PAD_T + plotH);
    ctx.lineTo(x, PAD_T + plotH + 6);
    ctx.stroke();
    ctx.fillText(tick >= 1000 ? `${(tick / 1000).toFixed(0)} μm` : `${tick}`, x, PAD_T + plotH + 22);
  }
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("wavelength", PAD_L + plotW / 2, height - 10);

  // Y label.
  ctx.save();
  ctx.translate(18, PAD_T + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(210, 220, 240, 0.92)";
  ctx.fillText(options.yAxisLabel ?? (logY ? "intensity (log scale)" : "relative intensity"), 0, 0);
  ctx.restore();
}
