import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { safeGetItem, safeSetItem } from './storage';
import {
  DEFAULT_CAMERA_HEIGHT_CM,
  DEFAULT_FOCAL_35MM,
  VISION_MESSAGES,
  measureFace,
  measureSide,
  type FaceReading,
  type SideReading,
} from './parcelVision';

/**
 * Captured photo → a top or side reading, on the device.
 *
 * The camera frame is shrunk to 480 px on its long side first: plenty to find
 * a box, and small enough that decoding and the model together stay well under
 * a second on a budget phone. Nothing leaves the device.
 */

/** Long side the model analyses. Tested: 480 px holds ±0.5 cm at a correct height. */
const ANALYSIS_SIZE = 480;

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  exif?: Record<string, any> | null;
}

export interface ScanPhoto {
  /** The downscaled image the model saw — shown back with its outline drawn on. */
  uri: string;
  width: number;
  height: number;
}

/** Which view a photo is: flat above the box, or upright beside it. */
export type ScanView = { view: 'top'; cameraHeightCm: number } | { view: 'side' };

export type ScanResult<R> =
  { ok: true; reading: R; photo: ScanPhoto } | { ok: false; message: string; photo?: ScanPhoto };

/* ─── Holding height ─────────────────────────────────── */

const HEIGHT_KEY = 'parcelScan.cameraHeightCm';
export const CAMERA_HEIGHT_RANGE = { min: 50, max: 200, step: 5 } as const;

/** The seller's phone height, remembered between scans. */
export async function loadCameraHeight(): Promise<number> {
  const stored = Number(await safeGetItem('local', HEIGHT_KEY));
  return Number.isFinite(stored) &&
    stored >= CAMERA_HEIGHT_RANGE.min &&
    stored <= CAMERA_HEIGHT_RANGE.max
    ? stored
    : DEFAULT_CAMERA_HEIGHT_CM;
}

export function saveCameraHeight(cm: number): Promise<void> {
  return safeSetItem('local', HEIGHT_KEY, String(cm));
}

/* ─── Analysis ───────────────────────────────────────── */

/** 35 mm-equivalent focal length from EXIF, when the camera recorded one. */
function focalFromExif(exif: Record<string, any> | null | undefined): number {
  const raw = exif?.FocalLengthIn35mmFilm ?? exif?.FocalLenIn35mmFilm;
  const value = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(value) && value >= 12 && value <= 120 ? value : DEFAULT_FOCAL_35MM;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lets a spinner paint before the model holds the JS thread for a moment. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 16));

export async function analysePhoto(
  captured: CapturedPhoto,
  view: { view: 'top'; cameraHeightCm: number }
): Promise<ScanResult<FaceReading>>;
export async function analysePhoto(
  captured: CapturedPhoto,
  view: { view: 'side' }
): Promise<ScanResult<SideReading>>;
export async function analysePhoto(
  captured: CapturedPhoto,
  view: ScanView
): Promise<ScanResult<FaceReading | SideReading>> {
  let photo: ScanPhoto | undefined;
  try {
    const landscape = (captured.width || 0) >= (captured.height || 0);
    const context = ImageManipulator.manipulate(captured.uri);
    let saved;
    try {
      context.resize(landscape ? { width: ANALYSIS_SIZE } : { height: ANALYSIS_SIZE });
      const image = await context.renderAsync();
      try {
        saved = await image.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.92 });
      } finally {
        image.release();
      }
    } finally {
      // Both hold a native bitmap; a seller retaking photos would otherwise
      // accumulate full-resolution frames until the next garbage collection.
      context.release();
    }
    if (!saved.base64) throw new Error('no pixels');
    photo = { uri: saved.uri, width: saved.width, height: saved.height };

    await nextFrame();
    const pixels = decode(base64ToBytes(saved.base64), {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 2,
    });
    const rgba = { data: pixels.data, width: pixels.width, height: pixels.height };
    const focal35mm = focalFromExif(captured.exif);
    const result =
      view.view === 'top'
        ? measureFace(rgba, { focal35mm, cameraHeight: view.cameraHeightCm })
        : measureSide(rgba, focal35mm);
    return result.ok
      ? { ok: true, reading: result.reading, photo }
      : { ok: false, message: VISION_MESSAGES[result.reason], photo };
  } catch {
    return { ok: false, message: 'That photo couldn’t be read. Please try again.', photo };
  }
}
