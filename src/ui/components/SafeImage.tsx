import React, { useEffect, useState } from "react";
import "../styles/SafeImage.css";
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
  imagePath: string,
  profile?: string,
  id?: string,
  timestamp?: number
) => {
  if (imagePath === " " || imagePath.toLowerCase() === "none") {
    return ""; // Return empty string for special cases
  }

  // If path already matches valid protocols return it.
  if (
    imagePath.startsWith("appdata-file://") ||
    imagePath.startsWith("src/assets/")
  ) {
    // Add cache-busting timestamp if provided
    if (timestamp && !imagePath.includes("?t=")) {
      return `${imagePath}?t=${timestamp}`;
    }
    return imagePath;
  }

  // If id provided
  if (typeof id === "string") {
    // If imagePath is a local path, append the directory setup
    if (!/^[a-zA-Z]:[\\/]/.test(imagePath)) {
      const folderPath = `/profiles/${profile}/icons/${id}`;
      const encodedImagePath = encodeURIComponent(imagePath).replace(
        /[()]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
      );
      let safeFilePath = `appdata-file://${folderPath}/${encodedImagePath}`;
      if (timestamp) {
        safeFilePath += `?t=${timestamp}`;
      }
      // Check extension
      const isImageExtension =
        /\.(png|jpg|jpeg|gif|bmp|svg|webp|lnk|ico)$/i.test(imagePath);
      if (!isImageExtension) {
        return getUnknownAssetPath(timestamp);
      }
      return safeFilePath;
    }
  }

  // Otherwise, treat as absolute path (Windows or otherwise)
  if (/^[a-zA-Z]:[\\/]/.test(imagePath)) {
    // For Windows absolute paths, don't encode the drive letter and colon
    // but DO encode the rest of the path
    const driveLetter = imagePath.substring(0, 2); // e.g., "C:"
    const remainingPath = imagePath.substring(2).replace(/\\/g, "/");

    // Create a properly formatted URL without double-encoding
    let safeFilePath = `appdata-file://${driveLetter}${remainingPath}`;

    // Add cache-busting timestamp if provided
    if (timestamp) {
      safeFilePath += `?t=${timestamp}`;
    }
    return safeFilePath;
  }

  // Fallback: just encode and use as protocol path
  let safeFilePath = imagePath;
  if (timestamp) {
    safeFilePath += `?t=${timestamp}`;
  }

  // Check if the path ends with a typical image extension
  const isImageExtension = /\.(png|jpg|jpeg|gif|bmp|svg|webp|lnk|ico)$/i.test(
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
  imagePath: string;
  profile?: string;
  id?: string;
  row?: number;
  col?: number;
  width?: number;
  height?: number;
  className?: string;
  highlighted?: boolean;
  forceReload?: number;
}> = ({
  imagePath,
  profile,
  id,
  row,
  col,
  width,
  height,
  className = "desktop-icon-image",
  highlighted = false,
  forceReload = 0,
}) => {
  // Fallback if width and height are not provided
  const defaultIconSize = width || height || 64;

  const [imageSrc, setImageSrc] = useState<string>(() => "");
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: width || defaultIconSize,
    height: height || defaultIconSize,
  });
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);

    if (isSpecialCase(imagePath)) {
      logger.info(
        `Icon${id != undefined && row !== undefined && col !== undefined ? ` ${id} at: ${row},${col}` : ""} is a special case, user wants empty image`
      );
      setImageSrc(""); // discard cached image
      return;
    }

    const newImageSrc = getImagePath(
      imagePath,
      profile,
      id,
      forceReload || undefined
    );

    if (newImageSrc !== imageSrc) {
      setImageSrc(newImageSrc);
    }

    const img = new Image();

    img.onload = () => {
      setImageError(false);

      if (width && height) {
        setImageDimensions({ width, height });
        return;
      }

      const aspectRatio = img.width / img.height;

      if (width) {
        // Only width is defined, calculate height based on aspect ratio
        setImageDimensions({
          width,
          height: Math.min(Math.round(width / aspectRatio), defaultIconSize),
        });
      } else if (height) {
        // Only height is defined, calculate width based on aspect ratio
        setImageDimensions({
          width: Math.min(Math.round(height * aspectRatio), defaultIconSize),
          height,
        });
      } else {
        // Neither width nor height is defined, use default size
        const imageWidth =
          aspectRatio > 1 ? defaultIconSize : defaultIconSize * aspectRatio;
        const imageHeight =
          aspectRatio > 1 ? defaultIconSize / aspectRatio : defaultIconSize;

        setImageDimensions({
          width: Math.round(imageWidth),
          height: Math.round(imageHeight),
        });
      }
    };

    img.onerror = (e) => {
      if (newImageSrc !== "") {
        logger.error(`Failed to load image: [${newImageSrc}]`, e);
        setImageError(true);

        // Try loading the unknown image
        const unknownSrc = getUnknownAssetPath(Date.now());
        if (newImageSrc !== unknownSrc) {
          logger.info(`Falling back to unknown image: ${unknownSrc}`);
          setImageSrc(unknownSrc);
        }
      }
    };

    img.src = newImageSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imagePath, row, col, forceReload, width, height, defaultIconSize]);

  return (
    <div
      className={`${className} ${highlighted ? "highlighted-icon" : ""} safe-image-container`}
      style={{
        width: width || defaultIconSize,
        height: height || defaultIconSize,
      }}
    >
      {imageSrc ? (
        <div
          className="safe-image-inner"
          style={{
            width: imageDimensions.width,
            height: imageDimensions.height,
          }}
        >
          <img
            src={imageSrc}
            alt=""
            className="safe-image-img"
            onError={(e) => {
              logger.error(`Error loading image in img tag: ${imageSrc}`);
              if (!imageError) {
                const timestamp = Date.now();
                const retryUrl = imageSrc.includes("?")
                  ? `${imageSrc}&retry=${timestamp}`
                  : `${imageSrc}?retry=${timestamp}`;
                (e.target as HTMLImageElement).src = retryUrl;
              }
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: imageDimensions.width,
            height: imageDimensions.height,
          }}
        />
      )}
    </div>
  );
};

// Wrap the component with React.memo
export const SafeImage = React.memo(SafeImageComponent);

function isSpecialCase(imagePath: string) {
  return imagePath === " " || imagePath.toLowerCase() === "none";
}
