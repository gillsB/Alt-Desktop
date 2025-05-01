import React, { useEffect, useState } from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("VideoBackground.tsx");

interface VideoBackgroundProps {
  opacity?: number;
  fallbackColor?: string; // Optional prop for the fallback background color
}

/**
 * A React component that renders a video background.
 * - It uses a custom video protocol to securely load videos from any location
 * - If the video fails to load, it falls back to a solid color background.
 *
 * @component
 * @param {number} [opacity=1] - The opacity of the video background.
 * @param {string} [fallbackColor="#87BEC5"] - The fallback background color if the video fails to load.
 * @returns {JSX.Element} The VideoBackground component.
 */
const VideoBackground: React.FC<VideoBackgroundProps> = ({
  opacity = 1, // Default fully visible
  fallbackColor = "#87BEC5", // Default fallback color
}) => {
  // State for video functionality
  const [videoError, setVideoError] = useState(false); // State to track video load errors
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  useEffect(() => {
    const fetchBackgroundSetting = async () => {
      try {
        const background = await window.electron.getSetting("background");
        logger.info("Background setting:", background);
        if (background) {
          const videoFilePath =
            await window.electron.convertToVideoFileUrl(background);
          logger.info("Converted video file path:", videoFilePath);
          setVideoSrc(videoFilePath);
        }
      } catch (error) {
        logger.error("Error fetching background setting:", error);
        setVideoSrc(null); // Fallback on error.
      }
    };

    fetchBackgroundSetting();
  }, []);

  const videoStyle: React.CSSProperties = {
    opacity,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none", // Prevent interaction with the video
    background: "transparent",
  };

  const fallbackStyle: React.CSSProperties = {
    backgroundColor: fallbackColor,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity,
  };

  return videoSrc && !videoError ? (
    <video
      id="video-bg"
      autoPlay
      loop
      muted
      style={videoStyle}
      src={videoSrc ?? undefined}
      onError={(e) => {
        const videoElement = e.target as HTMLVideoElement;
        logger.error("Video load error occurred", {
          currentSrc: videoElement.currentSrc,
          networkState: videoElement.networkState,
          errorCode: videoElement.error?.code,
          errorMessage: videoElement.error?.message,
        });
        setVideoError(true);
        setVideoSrc(null);
      }}
    >
      Browser does not support the video tag.
    </video>
  ) : (
    <div style={fallbackStyle}></div> // Render fallback background
  );
};

export default VideoBackground;
