import {
  bandLabel,
  formatFrequency,
  formatWavelength,
  frequencyHzFromLambdaNm,
  monochromaticSeenColor,
  rgbCss,
  schematicCyclesOnScreen
} from "./emWave";
import type { EmWaveViewMode } from "./types";

export type WaveDrawOptions = {
  lambdaNm: number;
  /** Continuous-wave field phase (radians). */
  phaseRad: number;
  /** Photon packet center 0…1 along the travel axis (wraps). */
  travel01: number;
  view: EmWaveViewMode;
};

/**
 * Classic teaching diagram of a linearly polarized plane wave,
 * or a short wrapping photon wave-packet.
 */
export function drawTravelingEmWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WaveDrawOptions
): void {
  const { lambdaNm, phaseRad, travel01, view } = options;
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#071018");
  bg.addColorStop(1, "#121a28");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const { color, band } = monochromaticSeenColor(lambdaNm);
  const fHz = frequencyHzFromLambdaNm(lambdaNm);
  const cycles = schematicCyclesOnScreen(lambdaNm);

  ctx.fillStyle = "rgba(230, 238, 250, 0.95)";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    view === "photon"
      ? `Photon · λ = ${formatWavelength(lambdaNm)} · f = ${formatFrequency(fHz)}`
      : `EM wave · λ = ${formatWavelength(lambdaNm)} · f = ${formatFrequency(fHz)}`,
    14,
    20
  );
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(180, 200, 230, 0.9)";
  ctx.fillText(
    view === "photon"
      ? "Localized ~2λ packet · wraps around when it leaves the right edge"
      : "E ⟂ B ⟂ travel — peaks pack tighter as λ shrinks",
    14,
    36
  );

  const originX = 48;
  const originY = height * 0.54;
  const axisLen = width - 68;
  const eAmp = height * 0.2;
  const bAmp = height * 0.14;
  const bSkewX = 0.55;
  const bSkewY = -0.42;
  const cyclePx = axisLen / cycles;
  const k = (2 * Math.PI) / cyclePx;

  drawAxes(ctx, originX, originY, axisLen, eAmp, bAmp, bSkewX, bSkewY);

  if (view === "photon") {
    drawPhotonPacket(ctx, {
      originX,
      originY,
      axisLen,
      eAmp,
      bAmp,
      bSkewX,
      bSkewY,
      cyclePx,
      k,
      phaseRad,
      travel01,
      colorCss: rgbCss(color, band === "optical" ? 0.95 : 0.7)
    });
  } else {
    drawContinuousWave(ctx, {
      originX,
      originY,
      axisLen,
      eAmp,
      bAmp,
      bSkewX,
      bSkewY,
      cyclePx,
      k,
      phaseRad,
      cycles
    });
  }

  // Tint strip matching the photon / wave color.
  ctx.fillStyle = rgbCss(color, band === "optical" ? 0.95 : 0.55);
  ctx.fillRect(14, height - 22, width - 28, 8);
  ctx.fillStyle = "rgba(200, 210, 230, 0.85)";
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(bandLabel(band), 14, height - 28);
}

type Layout = {
  originX: number;
  originY: number;
  axisLen: number;
  eAmp: number;
  bAmp: number;
  bSkewX: number;
  bSkewY: number;
  cyclePx: number;
  k: number;
  phaseRad: number;
};

function drawContinuousWave(
  ctx: CanvasRenderingContext2D,
  layout: Layout & { cycles: number }
): void {
  const { originX, originY, axisLen, eAmp, bAmp, bSkewX, bSkewY, cyclePx, k, phaseRad, cycles } =
    layout;
  const n = Math.max(180, Math.round(60 * cycles));

  ctx.beginPath();
  for (let i = 0; i <= n; i += 1) {
    const x = (i / n) * axisLen;
    const b = Math.sin(k * x - phaseRad);
    const px = originX + x + b * bAmp * bSkewX;
    const py = originY + b * bAmp * bSkewY;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.strokeStyle = "rgba(255, 120, 150, 0.9)";
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i <= n; i += 1) {
    const x = (i / n) * axisLen;
    const e = Math.sin(k * x - phaseRad);
    const px = originX + x;
    const py = originY - e * eAmp;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.strokeStyle = "rgba(100, 200, 255, 0.95)";
  ctx.lineWidth = 2.6;
  ctx.stroke();

  const stations = Math.min(11, Math.max(5, Math.round(cycles * 1.4)));
  for (let s = 0; s < stations; s += 1) {
    const x = ((s + 0.5) / stations) * axisLen;
    const e = Math.sin(k * x - phaseRad);
    const baseX = originX + x;
    const baseY = originY;
    ctx.strokeStyle = "rgba(120, 210, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX, baseY - e * eAmp);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 140, 160, 0.5)";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX + e * bAmp * bSkewX, baseY + e * bAmp * bSkewY);
    ctx.stroke();
  }

  // One-λ brace near the left, sized to the current schematic wavelength.
  const braceY = originY + eAmp + 36;
  const braceX0 = originX + Math.min(cyclePx * 0.2, axisLen * 0.08);
  const braceX1 = braceX0 + cyclePx;
  if (braceX1 < originX + axisLen - 8) {
    ctx.strokeStyle = "rgba(255, 220, 140, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(braceX0, braceY - 6);
    ctx.lineTo(braceX0, braceY);
    ctx.lineTo(braceX1, braceY);
    ctx.lineTo(braceX1, braceY - 6);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 230, 160, 0.95)";
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("one λ", (braceX0 + braceX1) / 2, braceY + 14);
  }
}

function drawPhotonPacket(
  ctx: CanvasRenderingContext2D,
  layout: Layout & { travel01: number; colorCss: string }
): void {
  const {
    originX,
    originY,
    axisLen,
    eAmp,
    bAmp,
    bSkewX,
    bSkewY,
    cyclePx,
    k,
    phaseRad,
    travel01,
    colorCss
  } = layout;

  // Packet spans about two wavelengths.
  const packetHalf = cyclePx;
  const center = ((travel01 % 1) + 1) % 1;
  const centerX = center * axisLen;

  // Draw wrapped copies so the packet can straddle the right/left edge.
  for (const shift of [-axisLen, 0, axisLen]) {
    const cx = centerX + shift;
    if (cx + packetHalf < -4 || cx - packetHalf > axisLen + 4) {
      continue;
    }

    const n = 80;
    // Envelope fill under E.
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= n; i += 1) {
      const x = cx - packetHalf + (i / n) * (2 * packetHalf);
      const env = packetEnvelope(x - cx, packetHalf);
      if (env <= 0.01) {
        continue;
      }
      const e = Math.sin(k * x - phaseRad) * env;
      const px = originX + x;
      const py = originY - e * eAmp;
      if (!started) {
        ctx.moveTo(px, originY);
        ctx.lineTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    if (started) {
      ctx.lineTo(originX + cx + packetHalf, originY);
      ctx.closePath();
      ctx.fillStyle = colorCss.replace(/[\d.]+\)$/, "0.22)");
      if (colorCss.startsWith("rgba")) {
        ctx.fillStyle = colorCss.replace(/,\s*[\d.]+\)$/, ", 0.22)");
      }
      ctx.fill();
    }

    // B packet
    ctx.beginPath();
    started = false;
    for (let i = 0; i <= n; i += 1) {
      const x = cx - packetHalf + (i / n) * (2 * packetHalf);
      const env = packetEnvelope(x - cx, packetHalf);
      if (env <= 0.01) {
        continue;
      }
      const b = Math.sin(k * x - phaseRad) * env;
      const px = originX + x + b * bAmp * bSkewX;
      const py = originY + b * bAmp * bSkewY;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.strokeStyle = "rgba(255, 120, 150, 0.85)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // E packet
    ctx.beginPath();
    started = false;
    for (let i = 0; i <= n; i += 1) {
      const x = cx - packetHalf + (i / n) * (2 * packetHalf);
      const env = packetEnvelope(x - cx, packetHalf);
      if (env <= 0.01) {
        continue;
      }
      const e = Math.sin(k * x - phaseRad) * env;
      const px = originX + x;
      const py = originY - e * eAmp;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.strokeStyle = "rgba(100, 200, 255, 0.95)";
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Photon “quantized” core glow at the packet center.
    const coreX = originX + cx;
    const coreY = originY;
    const glow = ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, 28);
    glow.addColorStop(0, colorCss);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colorCss;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 230, 160, 0.95)";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("~2 λ packet", originX + axisLen * 0.55, originY + eAmp + 40);
}

function packetEnvelope(dx: number, halfWidth: number): number {
  const u = Math.abs(dx) / halfWidth;
  if (u >= 1) {
    return 0;
  }
  // Raised cosine: smooth, about two wavelengths wide.
  return 0.5 * (1 + Math.cos(Math.PI * u));
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  axisLen: number,
  eAmp: number,
  bAmp: number,
  bSkewX: number,
  bSkewY: number
): void {
  ctx.strokeStyle = "rgba(200, 210, 230, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(originX - 20, originY);
  ctx.lineTo(originX + axisLen, originY);
  ctx.stroke();
  drawArrowHead(ctx, originX + axisLen, originY, 0, "rgba(200, 210, 230, 0.8)");
  ctx.fillStyle = "rgba(210, 220, 240, 0.9)";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("travel →", originX + axisLen * 0.55, originY + 22);

  ctx.strokeStyle = "rgba(120, 200, 255, 0.55)";
  ctx.beginPath();
  ctx.moveTo(originX, originY + eAmp + 10);
  ctx.lineTo(originX, originY - eAmp - 10);
  ctx.stroke();
  drawArrowHead(ctx, originX, originY - eAmp - 10, -Math.PI / 2, "rgba(120, 200, 255, 0.85)");
  ctx.fillStyle = "rgba(140, 210, 255, 0.95)";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("E", originX - 8, originY - eAmp - 10);

  const bTipX = originX + bAmp * bSkewX * 1.4;
  const bTipY = originY + bAmp * bSkewY * 1.4;
  ctx.strokeStyle = "rgba(255, 140, 160, 0.55)";
  ctx.beginPath();
  ctx.moveTo(originX - (bTipX - originX), originY - (bTipY - originY));
  ctx.lineTo(bTipX, bTipY);
  ctx.stroke();
  const bang = Math.atan2(bTipY - originY, bTipX - originX);
  drawArrowHead(ctx, bTipX, bTipY, bang, "rgba(255, 140, 160, 0.85)");
  ctx.fillStyle = "rgba(255, 160, 180, 0.95)";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("B", bTipX + 6, bTipY + 3);
}

export function drawWavelengthSwatch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lambdaNm: number
): void {
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#070d14");
  bg.addColorStop(1, "#121820");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const { color, band } = monochromaticSeenColor(lambdaNm);
  const pad = 28;
  const sw = width - pad * 2;
  const sh = Math.min(height * 0.55, width - pad * 2);
  const sx = pad;
  const sy = (height - sh) * 0.38;

  ctx.save();
  ctx.shadowColor = rgbCss(color, band === "optical" ? 0.85 : 0.35);
  ctx.shadowBlur = band === "optical" ? 36 : 16;
  ctx.fillStyle = rgbCss(color, 1);
  roundRect(ctx, sx, sy, sw, sh, 16);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(220, 230, 245, 0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, sx, sy, sw, sh, 16);
  ctx.stroke();

  ctx.fillStyle = "rgba(230, 238, 250, 0.95)";
  ctx.font = "700 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Human-seen color", width / 2, 36);

  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(200, 215, 235, 0.92)";
  ctx.fillText(formatWavelength(lambdaNm), width / 2, sy + sh + 36);
  ctx.font = "500 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(170, 190, 220, 0.88)";
  ctx.fillText(bandLabel(band), width / 2, sy + sh + 58);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string
): void {
  const size = 9;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, size * 0.55);
  ctx.lineTo(-size, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
