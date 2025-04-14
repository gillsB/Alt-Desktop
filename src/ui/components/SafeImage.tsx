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
    imagePath.startsWith("src/assets/") ||
    imagePath === " " || // This is special case for no icon image.
    imagePath.toLowerCase() === "none"
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

  // TODO really not happy with this implementation.
  if (!isImageExtension) {
    return getUnknownAssetPath();
  }

  return safeFilePath;
};

const getUnknownAssetPath = () => {
  const safeFilePath = `appdata-file:///unknown`;
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
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: width || DEFAULT_MAX_SIZE,
    height: height || DEFAULT_MAX_SIZE,
  });

  useEffect(() => {
    setImageSrc(getImagePath(row, col, originalImage));
  }, [originalImage, row, col]);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {
      // Case 1: Both width and height are explicitly provided
      if (width && height) {
        setImageDimensions({ width, height });
        return;
      }

      // Case 2: Calculate aspect ratio dimensions within DEFAULT_MAX_SIZE
      const aspectRatio = img.width / img.height;

      let imageWidth, imageHeight;

      if (aspectRatio > 1) {
        // Landscape image: width is the limiting factor
        imageWidth = DEFAULT_MAX_SIZE;
        imageHeight = imageWidth / aspectRatio;
      } else {
        // Portrait or square image: height is the limiting factor
        imageHeight = DEFAULT_MAX_SIZE;
        imageWidth = imageHeight * aspectRatio;
      }

      setImageDimensions({
        width: Math.round(imageWidth),
        height: Math.round(imageHeight),
      });
    };

    img.onerror = () => {
      if (imageSrc === " " || imageSrc.toLowerCase() === "none") {
        console.log("Image path is a special case, user wants an empty image.");
      } else {
        console.error(
          `File does not exist: ${imageSrc}. Falling back to unknown.png`
        );
        setImageSrc(getUnknownAssetPath());
      }
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
