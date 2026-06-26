import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

import { SEGMENTER_MODEL_URL } from "../config";
import type { BackgroundDefinition } from "../types";

const PERSON_CLASS_INDEX = 15;
const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 240;

let videoSegmenterPromise: Promise<ImageSegmenter> | null = null;
let imageSegmenterPromise: Promise<ImageSegmenter> | null = null;

function getTempCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function createSegmenter(runningMode: "VIDEO" | "IMAGE"): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL },
    outputCategoryMask: true,
    outputConfidenceMasks: false,
    runningMode,
  });
}

async function getVideoSegmenter(): Promise<ImageSegmenter> {
  if (!videoSegmenterPromise) {
    videoSegmenterPromise = createSegmenter("VIDEO");
  }
  return videoSegmenterPromise;
}

async function getImageSegmenter(): Promise<ImageSegmenter> {
  if (!imageSegmenterPromise) {
    imageSegmenterPromise = createSegmenter("IMAGE");
  }
  return imageSegmenterPromise;
}

function getAspectRatio(image: HTMLCanvasElement | HTMLVideoElement): number {
  if (image instanceof HTMLVideoElement) {
    return (image.videoWidth || PREVIEW_WIDTH) / Math.max(1, image.videoHeight || PREVIEW_HEIGHT);
  }
  return image.width / Math.max(1, image.height);
}

function drawGradientBackground(
  context: CanvasRenderingContext2D,
  background: BackgroundDefinition | undefined,
  width: number,
  height: number,
): void {
  if (!background) {
    context.fillStyle = "#14213d";
    context.fillRect(0, 0, width, height);
    return;
  }
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, background.gradient[0]);
  gradient.addColorStop(1, background.gradient[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  background.accents.forEach((accent) => {
    context.fillStyle = `${accent.color}88`;
    context.beginPath();
    context.arc(width * accent.x, height * accent.y, Math.min(width, height) * accent.radius, 0, Math.PI * 2);
    context.fill();
  });
}

function buildCutoutCanvas(
  source: HTMLCanvasElement | HTMLVideoElement,
  mask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
): HTMLCanvasElement {
  const sourceCanvas = getTempCanvas(maskWidth, maskHeight);
  const sourceContext = sourceCanvas.getContext("2d");
  const outputCanvas = getTempCanvas(maskWidth, maskHeight);
  const outputContext = outputCanvas.getContext("2d");
  if (!sourceContext || !outputContext) {
    return outputCanvas;
  }
  sourceContext.drawImage(source, 0, 0, maskWidth, maskHeight);
  const sourcePixels = sourceContext.getImageData(0, 0, maskWidth, maskHeight);
  const outputPixels = outputContext.createImageData(maskWidth, maskHeight);
  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    outputPixels.data[offset] = sourcePixels.data[offset];
    outputPixels.data[offset + 1] = sourcePixels.data[offset + 1];
    outputPixels.data[offset + 2] = sourcePixels.data[offset + 2];
    outputPixels.data[offset + 3] = mask[pixelIndex] === PERSON_CLASS_INDEX ? 255 : 0;
  }
  outputContext.putImageData(outputPixels, 0, 0);
  return outputCanvas;
}

function drawParticipant(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement | HTMLVideoElement,
  slotIndex: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const slotWidth = canvasWidth / 2;
  const targetHeight = canvasHeight * 0.82;
  const targetWidth = targetHeight * getAspectRatio(image);
  const x = slotIndex * slotWidth + slotWidth / 2 - targetWidth / 2;
  const y = canvasHeight - targetHeight;
  context.drawImage(image, x, y, targetWidth, targetHeight);
}

function drawPlainPreview(
  context: CanvasRenderingContext2D,
  videos: Array<HTMLVideoElement | null>,
  canvasWidth: number,
  canvasHeight: number,
): void {
  videos.forEach((video, slotIndex) => {
    if (!video || video.readyState < 2) {
      return;
    }
    drawParticipant(context, video, slotIndex, canvasWidth, canvasHeight);
  });
}

function hasVisiblePerson(mask: Uint8Array): boolean {
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === PERSON_CLASS_INDEX) {
      return true;
    }
  }
  return false;
}

export async function warmUpSegmenters(): Promise<void> {
  await Promise.all([getVideoSegmenter(), getImageSegmenter()]);
}

export async function captureTransparentPng(video: HTMLVideoElement): Promise<Blob> {
  const width = Math.max(video.videoWidth, 960);
  const height = Math.max(video.videoHeight, 720);
  const sourceCanvas = getTempCanvas(width, height);
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Canvas unavailable.");
  }
  sourceContext.drawImage(video, 0, 0, width, height);
  let cutoutCanvas = sourceCanvas;
  try {
    const segmenter = await getImageSegmenter();
    const result = segmenter.segment(sourceCanvas);
    const mask = result.categoryMask?.getAsUint8Array();
    if (mask && hasVisiblePerson(mask)) {
      cutoutCanvas = buildCutoutCanvas(
        sourceCanvas,
        mask,
        result.categoryMask!.width,
        result.categoryMask!.height,
      );
    }
  } catch {
    cutoutCanvas = sourceCanvas;
  }
  return new Promise<Blob>((resolve, reject) => {
    cutoutCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to capture image."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function drawCompositePreview(
  canvas: HTMLCanvasElement,
  background: BackgroundDefinition | undefined,
  localVideo: HTMLVideoElement | null,
  remoteVideo: HTMLVideoElement | null,
): Promise<void> {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  drawGradientBackground(context, background, canvas.width, canvas.height);

  const videos = [localVideo, remoteVideo];
  try {
    const segmenter = await getVideoSegmenter();
    for (const [slotIndex, video] of videos.entries()) {
      if (!video || video.readyState < 2) {
        continue;
      }
      const result = segmenter.segmentForVideo(video, performance.now());
      const mask = result.categoryMask?.getAsUint8Array();
      if (!mask || !hasVisiblePerson(mask)) {
        drawParticipant(context, video, slotIndex, canvas.width, canvas.height);
        continue;
      }
      const cutout = buildCutoutCanvas(video, mask, result.categoryMask!.width, result.categoryMask!.height);
      drawParticipant(context, cutout, slotIndex, canvas.width, canvas.height);
    }
  } catch {
    drawPlainPreview(context, videos, canvas.width, canvas.height);
  }

  context.strokeStyle = "rgba(255,255,255,0.6)";
  context.lineWidth = 3;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
}
