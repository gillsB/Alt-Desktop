import React, { useEffect, useRef, useState } from "react";
import "../styles/Background.css";
import { createLogger, createVideoLogger } from "../util/uiLogger";

const logger = createLogger("Background.tsx");
const videoLogger = createVideoLogger("Background.tsx");

interface BackgroundProps {
  opacity?: number;
  fallbackColor?: string;
  logLevel?: "verbose" | "normal";
}

/**
 * A React component that renders a background with fallback options.
 * - First attempts to use a video background
 * - If video fails, falls back to an image background
 * - If both fail, uses a solid color background
 *
 * @component
 * @param {number} [opacity=1] - The opacity of the background.
 * @param {string} [fallbackColor="#87BEC5"] - The fallback background color if both video and image fail.
 * @param {string} [logLevel="normal"] - Controls verbosity of video events logging.
 * @returns {JSX.Element} The Background component.
 */
const Background: React.FC<BackgroundProps> = ({
  opacity = 1,
  fallbackColor = "#87BEC5",
  logLevel = "normal",
}) => {
  const [backgroundPath, setBackgroundPath] = useState<string>("");
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const fetchFromSettings = async () => {
      const bgPath = await window.electron.getSetting("background");
      setBackgroundPath(bgPath || "");
      logger.info("Fetched background path from settings:", bgPath);
    };
    fetchFromSettings();

    window.electron.on("reload-background", fetchFromSettings);

    return () => {
      window.electron.off("reload-background", fetchFromSettings);
    };
  }, []);

  useEffect(() => {
    const handlePreview = (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>;
      logger.info("Received background preview updates:", updates);
      videoLogger.info("Received background preview updates:", updates);
      if (
        typeof updates.background === "string" &&
        updates.background !== backgroundPath
      ) {
        logger.info("Updating background path to:", updates.background);
        videoLogger.info("Updating background path to:", updates.background);
        setBackgroundPath(updates.background);
      }
    };
    window.electron.on("update-background-preview", handlePreview);

    return () => {
      window.electron.off("update-background-preview", handlePreview);
    };
  }, []);

  useEffect(() => {
    const detectAndSet = async () => {
      setVideoError(false);
      setImageError(false);
      setIsLoading(true);
      setVideoSrc(null);
      setImageSrc(null);

      if (!backgroundPath) return;

      const fileType = await window.electron.getFileType(backgroundPath);
      logger.info("Background file type:", fileType);

      if (fileType.startsWith("video")) {
        setIsVideo(true);
        const videoFilePath =
          await window.electron.convertToVideoFileUrl(backgroundPath);
        const cacheBuster = Date.now();
        setVideoSrc(`${videoFilePath}?nocache=${cacheBuster}`);
      } else if (fileType.startsWith("image")) {
        setIsVideo(false);
        const imageFilePath =
          await window.electron.getBackgroundImagePath(backgroundPath);
        const cacheBuster = Date.now();
        setImageSrc(`${imageFilePath}?nocache=${cacheBuster}`);
      } else {
        // File type is invalid or file does not exist
        setIsVideo(false);
        setImageSrc(null);
        setVideoSrc(null);
        setIsLoading(false);
        logger.warn(
          "Background path is invalid or file does not exist.",
          backgroundPath
        );
      }
    };
    detectAndSet();
  }, [backgroundPath]);

  //Todo expand on this to include more error handling
  const handleVideoError = async (context = "load") => {
    setVideoError(true);
    setIsLoading(false);
    logger.warn(
      `Video error occurred during ${context}, falling back to image or color.`
    );
  };

  // Handle image error
  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
    logger.error("Image failed to load, using fallback color");
  };

  const videoStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity,
  };

  const imageStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity,
  };

  const fallbackStyle: React.CSSProperties = {
    backgroundColor: fallbackColor,
  };

  if (isVideo && videoSrc && !videoError) {
    return (
      <div className="video-background">
        <video
          id="video-bg"
          ref={videoRef}
          autoPlay
          muted
          playsInline
          loop
          style={videoStyle}
          src={videoSrc}
          onError={() => handleVideoError("initial")}
          crossOrigin="anonymous"
          onCanPlayThrough={() => setIsLoading(false)}
        ></video>
      </div>
    );
  }

  if (!isVideo && imageSrc && !imageError) {
    return (
      <div className="image-background">
        <img
          id="image-bg"
          ref={imageRef}
          src={imageSrc}
          style={imageStyle}
          onLoad={() => setIsLoading(false)}
          onError={handleImageError}
          alt="Background"
        />
      </div>
    );
  }

  return <div className="fallback" style={fallbackStyle}></div>;
};

export default Background;
