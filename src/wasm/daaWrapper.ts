let wasmModule: any = null;

export async function initWasm(): Promise<void> {
  if (wasmModule) return;
  const module = await import('./daa_core');
  wasmModule = await module();
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  savings: number;
}

export interface HuffmanResult {
  data: Uint8Array;
  stats: CompressionStats;
}

export interface ImageOptimizationResult {
  bytes: Uint8Array;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export interface PresentationResult {
  bytes: Uint8Array;
  optimizedImages: number;
  totalImages: number;
  skippedImages: number;
}

export function huffmanCompress(data: Uint8Array): HuffmanResult {
  const resultPtr = (wasmModule as any)._huffmanCompress(data, data.length);
  const resultSize = (wasmModule as any).HEAPU32[(resultPtr >> 2) - 1];
  const outputPtr = resultPtr + 4;
  
  const result: HuffmanResult = {
    data: new Uint8Array((wasmModule as any).HEAPU8.subarray(outputPtr, outputPtr + resultSize)),
    stats: {
      originalSize: data.length * 8,
      compressedSize: resultSize * 8,
      ratio: 0,
      savings: 0,
    },
  };
  
  result.stats.savings = result.stats.originalSize - result.stats.compressedSize;
  result.stats.ratio = result.stats.originalSize > 0 
    ? (result.stats.savings / result.stats.originalSize) * 100 
    : 0;
  
  (wasmModule as any)._free(resultPtr);
  
  return result;
}

export function huffmanDecompress(data: Uint8Array, originalSize: number): Uint8Array {
  const resultPtr = (wasmModule as any)._huffmanDecompress(data, data.length, originalSize);
  const result = new Uint8Array((wasmModule as any).HEAPU8.subarray(resultPtr, resultPtr + originalSize));
  (wasmModule as any)._free(resultPtr);
  return result;
}

export function optimizeImage(
  data: Uint8Array,
  format: number,
  quality: number,
  scalePercent: number
): ImageOptimizationResult {
  const resultPtr = (wasmModule as any)._optimizeImage(data, data.length, format, quality, scalePercent);
  const resultSize = (wasmModule as any).HEAPU32[(resultPtr >> 2) - 1];
  const outputPtr = resultPtr + 4;
  
  const result: ImageOptimizationResult = {
    bytes: new Uint8Array((wasmModule as any).HEAPU8.subarray(outputPtr + 8, outputPtr + 8 + resultSize)),
    mimeType: "image/jpeg",
    originalWidth: (wasmModule as any).HEAPU32[(outputPtr + 8) >> 2],
    originalHeight: (wasmModule as any).HEAPU32[(outputPtr + 12) >> 2],
    outputWidth: (wasmModule as any).HEAPU32[(outputPtr + 16) >> 2],
    outputHeight: (wasmModule as any).HEAPU32[(outputPtr + 20) >> 2],
  };
  
  (wasmModule as any)._free(resultPtr);
  
  return result;
}

export function optimizePresentation(
  data: Uint8Array,
  quality: number,
  scalePercent: number
): PresentationResult {
  const resultPtr = (wasmModule as any)._optimizePresentation(data, data.length, quality, scalePercent);
  const resultSize = (wasmModule as any).HEAPU32[(resultPtr >> 2) - 1];
  
  const result: PresentationResult = {
    bytes: new Uint8Array((wasmModule as any).HEAPU8.subarray(resultPtr + 16, resultPtr + 16 + resultSize)),
    optimizedImages: (wasmModule as any).HEAPU32[resultPtr >> 2],
    totalImages: (wasmModule as any).HEAPU32[(resultPtr + 4) >> 2],
    skippedImages: (wasmModule as any).HEAPU32[(resultPtr + 8) >> 2],
  };
  
  (wasmModule as any)._free(resultPtr);
  
  return result;
}

export function isPptxFile(filename: string): boolean {
  return (wasmModule as any)._isPptxFile(filename) === 1;
}

export function isPptxData(data: Uint8Array): boolean {
  return (wasmModule as any)._isPptxData(data, data.length) === 1;
}

export function isWasmLoaded(): boolean {
  return wasmModule !== null;
}
