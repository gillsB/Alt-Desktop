import React, { useEffect, useState } from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("VideoBackground.tsx");

interface VideoBackgroundProps {
  opacity?: number;
  fallbackColor?: string; // Optional prop for the fallback background color
}

/**
 * A React component that renders a video background.
 * - In normal mode, it displays a single looping background video. (background.mp4 in root folder)
 * - In test mode, it provides a toggle button to enable/disable the video and cycle through different the different backgrounds:
 *  "background.mp4" and "background2.mp4" -> "background5.mp4"
 * - If the video fails to load, it falls back to a solid color background.
 *
 * @component
 * @param {number} [opacity=1] - The opacity of the video background.
 * @param {string} [fallbackColor="#000"] - The fallback background color if the video fails to load.
 * @returns {JSX.Element} The VideoBackground component.
 */
const VideoBackground: React.FC<VideoBackgroundProps> = ({
  opacity = 1, // Default fully visible
  fallbackColor = "#87BEC5", // Default fallback color
}) => {
  // State for test mode functionality
  const [videoError, setVideoError] = useState(false); // State to track video load errors
  const [videoSrc, setVideoSrc] = useState<string | null>("");

  useEffect(() => {
    const fetchBackgroundSetting = async () => {
      try {
        const background = await window.electron.getSetting("background");
        logger.info("Background setting:", background);
        setVideoSrc(background || null); // Fallback if not found.
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

  // In normal mode, just return the video or fallback background
  return videoSrc && !videoError ? (
    <video
      id="video-bg"
      autoPlay
      loop
      muted
      style={videoStyle}
      onError={() => setVideoError(true)} // Handle video load error
    >
      <source src={videoSrc} type="video/mp4" />
      Browser does not support the video tag.
    </video>
  ) : (
    <div style={fallbackStyle}></div> // Render fallback background
  );
};

export default VideoBackground;
