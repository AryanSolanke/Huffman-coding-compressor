export type RasterOptimizationFormat = 'image/webp' | 'image/jpeg' | 'image/png';
export type ImageOptimizationFormat = 'image/webp' | 'image/jpeg';

export interface ImageOptimizationOptions {
  format: RasterOptimizationFormat;
  quality: number;
  scalePercent: number;
}

export interface ImageOptimizationResult {
  bytes: Uint8Array;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image file.'));
    };

    image.src = url;
  });
}

function renderCanvasToBlob(
  canvas: HTMLCanvasElement,
  format: RasterOptimizationFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode optimized image.'));
          return;
        }

        resolve(blob);
      },
      format,
      quality
    );
  });
}

export async function optimizeImageBlob(
  blob: Blob,
  options: ImageOptimizationOptions
): Promise<ImageOptimizationResult> {
  const image = await loadImageFromBlob(blob);
  const scale = Math.min(1, Math.max(0.1, options.scalePercent / 100));
  const outputWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const outputHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, outputWidth, outputHeight);

  const encodedBlob = await renderCanvasToBlob(
    canvas,
    options.format,
    Math.min(1, Math.max(0.1, options.quality / 100))
  );
  const buffer = await encodedBlob.arrayBuffer();

  return {
    bytes: new Uint8Array(buffer),
    mimeType: encodedBlob.type || options.format,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    outputWidth,
    outputHeight,
  };
}

export async function optimizeImageFile(
  file: File,
  options: ImageOptimizationOptions
): Promise<ImageOptimizationResult> {
  return optimizeImageBlob(file, options);
}

export function getImageOutputExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return mimeType.split('/')[1] || 'img';
}
