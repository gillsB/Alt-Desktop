import React, { useEffect, useState } from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("safeImage.tsx");

/**
 * Converts a relative path to a safe file URL or fallback image
 *
 * @param row - The row position of the icon
 * @param col - The column position of the icon
 * @param imagePath - The original image path
 * @param timestamp - Optional timestamp for cache busting
 * @returns A safe file URL or fallback image path
 */
const getImagePath = (
  row: number,
  col: number,
  imagePath: string,
  timestamp?: number
) => {
  // If path already matches valid protocols return it.
  if (
    imagePath.startsWith("appdata-file://") ||
    imagePath.startsWith("src/assets/") ||
    imagePath === " " || // This is special case for no icon image.
    imagePath.toLowerCase() === "none"
  ) {
    // Add cache-busting timestamp if provided
    if (timestamp && !imagePath.includes("?t=")) {
      return `${imagePath}?t=${timestamp}`;
    }
    return imagePath;
  }

  const folderPath = `/data/[${row},${col}]`;

  // Encode the image path to handle spaces and special characters
  const encodedImagePath = encodeURIComponent(imagePath);

  let safeFilePath = `appdata-file://${folderPath}/${encodedImagePath}`;

  // Add cache-busting timestamp if provided
  if (timestamp) {
    safeFilePath += `?t=${timestamp}`;
  }

  // Check if the path ends with a typical image extension
  const isImageExtension = /\.(png|jpg|jpeg|gif|bmp|svg|webp|lnk)$/i.test(
    imagePath
  );

  // Icon file is not an image, return unknown image path.
  // Do not even attempt to load files that are not images.
  if (!isImageExtension) {
    return getUnknownAssetPath(timestamp);
  }

  return safeFilePath;
};

const getUnknownAssetPath = (timestamp?: number) => {
  let path = `appdata-file:///unknown`;
  if (timestamp) {
    path += `?t=${timestamp}`;
  }
  return path;
};

/**
 * SafeImage component that handles image loading with fallback
 */
const SafeImageComponent: React.FC<{
  row: number;
  col: number;
  originalImage: string;
  width?: number;
  height?: number;
  className?: string;
  highlighted?: boolean;
  forceReload?: number; // New prop to force reload - timestamp value
}> = ({
  row,
  col,
  originalImage,
  width,
  height,
  className = "desktop-icon-image",
  highlighted = false,
  forceReload = 0,
}) => {
  const DEFAULT_MAX_SIZE = 64; // Default maximum width/height for the image
  const [imageSrc, setImageSrc] = useState<string>(() =>
    getImagePath(row, col, originalImage, forceReload || undefined)
  );
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: width || DEFAULT_MAX_SIZE,
    height: height || DEFAULT_MAX_SIZE,
  });

  useEffect(() => {
    logger.info("useEffect triggered");
    if (originalImage === " " || originalImage.toLowerCase() === "none") {
      logger.info("Image path is a special case, user wants an empty image.");
      return;
    }

    const newImageSrc = getImagePath(
      row,
      col,
      originalImage,
      forceReload || undefined
    );

    if (newImageSrc !== imageSrc) {
      logger.info(`Updating imageSrc to: ${newImageSrc}`);
      setImageSrc(newImageSrc);
    }

    const img = new Image();
    img.src = newImageSrc;

    img.onload = () => {
      logger.info(`Image loaded successfully: ${newImageSrc}`);
      if (width && height) {
        setImageDimensions({ width, height });
        return;
      }

      const aspectRatio = img.width / img.height;
      const imageWidth =
        aspectRatio > 1 ? DEFAULT_MAX_SIZE : DEFAULT_MAX_SIZE * aspectRatio;
      const imageHeight =
        aspectRatio > 1 ? DEFAULT_MAX_SIZE / aspectRatio : DEFAULT_MAX_SIZE;

      setImageDimensions({
        width: Math.round(imageWidth),
        height: Math.round(imageHeight),
      });
    };

    img.onerror = () => {
      logger.error(`Failed to load image: ${newImageSrc}`);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [row, col, originalImage, forceReload, width, height]);

  return (
    <div
      className={`${className} ${highlighted ? "highlighted-icon" : ""}`}
      style={{
        // Container is always fixed size when no width/height provided
        width: width || DEFAULT_MAX_SIZE,
        height: height || DEFAULT_MAX_SIZE,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: imageDimensions.width,
          height: imageDimensions.height,
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: width && height ? "100% 100%" : "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
    </div>
  );
};

// Wrap the component with React.memo
export const SafeImage = React.memo(SafeImageComponent);
