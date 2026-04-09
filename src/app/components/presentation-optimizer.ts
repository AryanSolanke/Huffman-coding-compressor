import { unzipSync, zipSync } from 'fflate';
import { optimizeImageBlob } from './image-optimizer';

export interface PresentationOptimizationOptions {
  quality: number;
  scalePercent: number;
}

export interface PresentationOptimizationResult {
  bytes: Uint8Array;
  optimizedImages: number;
  totalImages: number;
  skippedImages: number;
}

const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function getMediaMimeType(fileName: string) {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) {
    return 'image/jpeg' as const;
  }

  if (lowerFileName.endsWith('.png')) {
    return 'image/png' as const;
  }

  if (lowerFileName.endsWith('.webp')) {
    return 'image/webp' as const;
  }

  return null;
}

export function isPptxFile(file: File | null) {
  if (!file) return false;

  return (
    file.type === PPTX_MIME_TYPE ||
    file.name.toLowerCase().endsWith('.pptx')
  );
}

export async function optimizePresentationFile(
  sourceBytes: Uint8Array,
  options: PresentationOptimizationOptions
): Promise<PresentationOptimizationResult> {
  const archiveEntries = unzipSync(sourceBytes);
  const rebuiltArchive: Record<string, Uint8Array> = {};
  let optimizedImages = 0;
  let totalImages = 0;
  let skippedImages = 0;

  for (const [entryName, entryBytes] of Object.entries(archiveEntries)) {
    const mediaMimeType = entryName.startsWith('ppt/media/')
      ? getMediaMimeType(entryName)
      : null;

    if (!mediaMimeType) {
      rebuiltArchive[entryName] = entryBytes;
      continue;
    }

    totalImages += 1;

    try {
      const optimizedImage = await optimizeImageBlob(
        new Blob([Uint8Array.from(entryBytes)], { type: mediaMimeType }),
        {
          format: mediaMimeType,
          quality: options.quality,
          scalePercent: options.scalePercent,
        }
      );

      if (optimizedImage.bytes.length < entryBytes.length) {
        rebuiltArchive[entryName] = optimizedImage.bytes;
        optimizedImages += 1;
      } else {
        rebuiltArchive[entryName] = entryBytes;
        skippedImages += 1;
      }
    } catch {
      rebuiltArchive[entryName] = entryBytes;
      skippedImages += 1;
    }
  }

  const optimizedArchive = zipSync(rebuiltArchive, { level: 9 });

  return {
    bytes: optimizedArchive.length < sourceBytes.length ? optimizedArchive : sourceBytes,
    optimizedImages: optimizedArchive.length < sourceBytes.length ? optimizedImages : 0,
    totalImages,
    skippedImages,
  };
}
