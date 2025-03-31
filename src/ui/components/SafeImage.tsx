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
  const safeFilePath = `appdata-file://${folderPath}/${imagePath}`;

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
}> = ({
  row,
  col,
  originalImage,
  width = 64,
  height = 64,
  className = "desktop-icon-image",
}) => {
  const [imageSrc, setImageSrc] = useState<string>(() =>
    getImagePath(row, col, originalImage)
  );

  useEffect(() => {
    setImageSrc(getImagePath(row, col, originalImage));
  }, [originalImage, row, col]);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;

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
  }, [imageSrc]);

  return (
    <div
      className={className}
      style={{
        width,
        height,
        backgroundImage: `url(${imageSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
};
