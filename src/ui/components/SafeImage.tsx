import React, { useEffect, useState } from "react";

/**
 * Converts a relative path to a safe file URL or fallback image
 *
 * @param row - The row position of the icon
 * @param col - The column position of the icon
 * @param imagePath - The original image path
 * @returns A safe file URL or fallback image path
 */
export const getImagePath = (row: number, col: number, imagePath: string) => {
  // If path already matches valid protocols return it.
  if (
    imagePath.startsWith("appdata-file://") ||
    imagePath.startsWith("src/assets/")
  ) {
    return imagePath;
  }

  const folderPath = `/data/[${row},${col}]`;

  // Encode the image path to handle spaces and special characters
  const encodedImagePath = encodeURIComponent(imagePath);

  const safeFilePath = `appdata-file://${folderPath}/${encodedImagePath}`;

  // Check if the path ends with a typical image extension
  const isImageExtension = /\.(png|jpg|jpeg|gif|bmp|svg|webp|lnk)$/i.test(
    imagePath
  );

  // If no image extension or we want to always use fallback
  if (!isImageExtension) {
    return "src/assets/unknown.png";
  }

  return safeFilePath;
};

/**
 * SafeImage component that handles image loading with fallback
 */
export const SafeImage: React.FC<{
  row: number;
  col: number;
  originalImage: string;
  width?: number;
  height?: number;
  className?: string;
  highlighted?: boolean;
}> = ({
  row,
  col,
  originalImage,
  width,
  height,
  className = "desktop-icon-image",
  highlighted = false,
}) => {
  const DEFAULT_MAX_SIZE = 64; // Default maximum width/height for the image
  const [imageSrc, setImageSrc] = useState<string>(() =>
    getImagePath(row, col, originalImage)
  );
  const [clampedDimensions, setClampedDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: DEFAULT_MAX_SIZE, height: DEFAULT_MAX_SIZE });

  useEffect(() => {
    setImageSrc(getImagePath(row, col, originalImage));
  }, [originalImage, row, col]);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {
      const aspectRatio = img.width / img.height;

      // Clamp the dimensions based on the max size
      let clampedWidth = width || DEFAULT_MAX_SIZE;
      let clampedHeight = height || DEFAULT_MAX_SIZE;

      if (aspectRatio > 1) {
        // Landscape image: width is the limiting factor
        clampedWidth = Math.min(clampedWidth, DEFAULT_MAX_SIZE);
        clampedHeight = clampedWidth / aspectRatio;
      } else {
        // Portrait or square image: height is the limiting factor
        clampedHeight = Math.min(clampedHeight, DEFAULT_MAX_SIZE);
        clampedWidth = clampedHeight * aspectRatio;
      }

      setClampedDimensions({
        width: Math.round(clampedWidth),
        height: Math.round(clampedHeight),
      });
    };

    img.onerror = () => {
      console.error(
        `Failed to load image: ${imageSrc}. Falling back to unknown.png`
      );
      setImageSrc("src/assets/unknown.png");
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageSrc, width, height]);

  return (
    <div
      className={`${className} ${highlighted ? "highlighted-icon" : ""}`}
      style={{
        width: clampedDimensions.width,
        height: clampedDimensions.height,
        backgroundImage: `url(${imageSrc})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
};
