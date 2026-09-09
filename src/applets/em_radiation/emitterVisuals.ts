import type { AppearanceMode, EmitterId } from "./types";
import { appearanceColor, rgbCss, type Rgb } from "./blackbody";

const imageCache = new Map<string, HTMLImageElement>();
const loadWaiters = new Map<string, Array<() => void>>();
/** Subject with baked alpha, keyed by emitter + canvas size. */
const cutoutCache = new Map<string, HTMLCanvasElement>();

function assetUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}em_radiation/${file}`;
}

/** Transparent-background portraits (alpha baked offline). */
const EMITTER_FILES: Record<EmitterId, string> = {
  bulb: "bulb.png",
  human: "human.png",
  star: "star.png"
};

function notifyLoaded(key: string): void {
  const waiters = loadWaiters.get(key);
  if (!waiters) {
    return;
  }
  loadWaiters.delete(key);
  for (const fn of waiters) {
    fn();
  }
}

/** Preload emitter photos; call `onReady` when the requested image is available. */
export function ensureEmitterImage(emitter: EmitterId, onReady?: () => void): HTMLImageElement | null {
  const key = EMITTER_FILES[emitter];
  const cached = imageCache.get(key);
  if (cached?.complete && cached.naturalWidth > 0) {
    onReady?.();
    return cached;
  }
  if (onReady) {
    const list = loadWaiters.get(key) ?? [];
    list.push(onReady);
    loadWaiters.set(key, list);
  }
  if (!cached) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imageCache.set(key, img);
      for (const k of [...cutoutCache.keys()]) {
        if (k.startsWith(`${emitter}:`)) {
          cutoutCache.delete(k);
        }
      }
      notifyLoaded(key);
    };
    img.onerror = () => {
      imageCache.delete(key);
      notifyLoaded(key);
    };
    img.src = assetUrl(key);
    imageCache.set(key, img);
  }
  return imageCache.get(key) ?? null;
}

/**
 * Fit the subject inside the portrait panel with a small margin
 * (contain, not cover — preserves silhouette instead of cropping limbs/glass).
 */
function containDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  margin = 0.06
): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0) {
    return;
  }
  const boxW = width * (1 - 2 * margin);
  const boxH = height * (1 - 2 * margin);
  const scale = Math.min(boxW / iw, boxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * Scale the pre-matted PNG into the panel. Alpha already follows the object;
 * only a light edge cleanup remains (kill near-zero alpha speckles).
 */
function subjectCutout(
  emitter: EmitterId,
  img: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const key = `${emitter}:${width}x${height}`;
  const cached = cutoutCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return canvas;
  }
  containDraw(ctx, img, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    // Harden soft rembg fringes so the tint glow hugs the true silhouette.
    if (a < 12) {
      data[i + 3] = 0;
    } else if (a < 40) {
      data[i + 3] = Math.round((a - 12) * (255 / 28));
    }
  }
  ctx.putImageData(imageData, 0, 0);
  cutoutCache.set(key, canvas);
  return canvas;
}

/** Tint only existing (opaque) subject pixels. */
function tintSubject(ctx: CanvasRenderingContext2D, width: number, height: number, glow: Rgb): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const r = 0.28 + 0.72 * glow.r;
  const g = 0.28 + 0.72 * glow.g;
  const b = 0.28 + 0.72 * glow.b;
  const strength = 0.5 + 0.4 * Math.max(glow.r, glow.g, glow.b);
  ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${strength})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function meltDistort(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = Math.min(0.55, amount * 0.5);
  ctx.filter = `blur(${2 + amount * 4}px)`;
  ctx.drawImage(ctx.canvas, 0, height * 0.35, width, height * 0.65, 0, height * 0.4, width, height * 0.7);
  ctx.restore();
  ctx.filter = "none";
}

/** Reused tint layer so temperature scrubbing does not allocate every frame. */
let tintLayer: HTMLCanvasElement | null = null;

function getTintLayer(width: number, height: number): HTMLCanvasElement {
  if (!tintLayer || tintLayer.width !== width || tintLayer.height !== height) {
    tintLayer = document.createElement("canvas");
    tintLayer.width = width;
    tintLayer.height = height;
  }
  return tintLayer;
}

export function drawEmitterPortrait(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  emitter: EmitterId,
  tempK: number,
  appearance: AppearanceMode,
  onImageReady?: () => void
): void {
  ctx.clearRect(0, 0, width, height);
  // Untinted panel backdrop.
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#070d14");
  bg.addColorStop(1, "#121820");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = appearanceColor(tempK, appearance);
  const img = ensureEmitterImage(emitter, onImageReady);

  if (img && img.complete && img.naturalWidth > 0) {
    const cutout = subjectCutout(emitter, img, width, height);
    const layer = getTintLayer(width, height);
    const lctx = layer.getContext("2d");
    if (!lctx) {
      return;
    }
    lctx.clearRect(0, 0, width, height);
    lctx.drawImage(cutout, 0, 0);
    tintSubject(lctx, width, height, glow);
    if (emitter === "human" && tempK >= 600) {
      meltDistort(lctx, width, height, Math.min(1, (tempK - 600) / 400));
    }
    // Soft glow hugging the object only (drawn under the subject).
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(18px)";
    ctx.globalAlpha = 0.35;
    ctx.drawImage(layer, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    ctx.drawImage(layer, 0, 0);
  } else {
    ctx.fillStyle = rgbCss(glow, 0.35);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220, 230, 245, 0.7)";
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading…", width / 2, height / 2 + 70);
  }
}
