import React, { useState } from "react";

interface VideoBackgroundProps {
  testMode?: boolean;
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
 * @param {boolean} [testMode=false] - If `true`, enables test mode with a toggle button and multiple video backgrounds.
 * @param {number} [opacity=1] - The opacity of the video background.
 * @param {string} [fallbackColor="#000"] - The fallback background color if the video fails to load.
 * @returns {JSX.Element} The VideoBackground component.
 */
const VideoBackground: React.FC<VideoBackgroundProps> = ({
  testMode = false,
  opacity = 1, // Default fully visible
  fallbackColor = "#87BEC5", // Default fallback color
}) => {
  // State for test mode functionality
  const [isVideoEnabled, setIsVideoEnabled] = useState(!testMode); // Enabled by default if not in test mode
  const [videoIndex, setVideoIndex] = useState(1);
  const [videoError, setVideoError] = useState(false); // State to track video load errors

  // Array of video sources for test mode
  const videoSources = [
    "background.mp4",
    "background2.mp4",
    "background3.mp4",
    "background4.mp4",
    "background5.mp4",
  ];

  const toggleVideo = () => {
    if (isVideoEnabled) {
      setIsVideoEnabled(false);
    } else {
      setIsVideoEnabled(true);
      setVideoIndex((prevIndex) => (prevIndex % videoSources.length) + 1);
    }
  };

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

  // Get current video source based on mode
  const currentVideoSource = testMode
    ? videoSources[videoIndex - 1]
    : "background.mp4";

  // In test mode, return the container with button and conditional video
  if (testMode) {
    return (
      <div className="video-background-container">
        <button className="video-toggle" onClick={toggleVideo}>
          {isVideoEnabled
            ? `Disable Video (${videoIndex}/5)`
            : `Enable Video (${videoIndex}/5)`}
        </button>

        {isVideoEnabled && !videoError ? (
          <video
            id="video-bg"
            autoPlay
            loop
            muted
            key={currentVideoSource}
            style={videoStyle}
            onError={() => setVideoError(true)} // Handle video load error
          >
            <source src={currentVideoSource} type="video/mp4" />
            Browser does not support the video tag.
          </video>
        ) : (
          <div style={fallbackStyle}></div> // Render fallback background
        )}
      </div>
    );
  }

  // In normal mode, just return the video or fallback background
  return !videoError ? (
    <video
      id="video-bg"
      autoPlay
      loop
      muted
      style={videoStyle}
      onError={() => setVideoError(true)} // Handle video load error
    >
      <source src="background.mp4" type="video/mp4" />
      Browser does not support the video tag.
    </video>
  ) : (
    <div style={fallbackStyle}></div> // Render fallback background
  );
};

export default VideoBackground;
