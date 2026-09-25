// src/utils/imageCompressor.ts
// Robust client-side image compression for manager profile pictures.
// Converts any image format (JPG, PNG, WebP, HEIC/generic) to a super-compact square JPEG/WebP data URL (<35KB).

export interface CompressionResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  width: number;
  height: number;
}

export async function compressProfileImage(
  file: File,
  targetSize = 256,
  quality = 0.82
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No image file selected.'));
    }

    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|gif|heic|bmp|svg)$/i)) {
      return reject(new Error('Selected file is not a supported image format.'));
    }

    const originalSizeKb = Math.round((file.size / 1024) * 10) / 10;
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not process or decode the image. Please try another picture.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error('Browser does not support 2D canvas processing.'));
          }

          // Smooth high-quality scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Square center-crop
          const minDimension = Math.min(img.width, img.height);
          const cropX = (img.width - minDimension) / 2;
          const cropY = (img.height - minDimension) / 2;

          ctx.drawImage(
            img,
            cropX,
            cropY,
            minDimension,
            minDimension,
            0,
            0,
            targetSize,
            targetSize
          );

          // Export as compressed WebP or JPEG fallback
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Compute size in KB from base64 string
          const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
          const compressedBytes = (base64Length * 3) / 4;
          const compressedSizeKb = Math.round((compressedBytes / 1024) * 10) / 10;

          resolve({
            dataUrl,
            originalSizeKb,
            compressedSizeKb,
            width: targetSize,
            height: targetSize,
          });
        } catch (err: any) {
          reject(new Error(err?.message || 'Error occurred while compressing image.'));
        }
      };

      if (typeof readerEvent.target?.result === 'string') {
        img.src = readerEvent.target.result;
      } else {
        reject(new Error('Invalid image reader result.'));
      }
    };

    reader.readAsDataURL(file);
  });
}
