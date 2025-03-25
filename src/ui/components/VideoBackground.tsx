import React, { useState } from "react";

interface VideoBackgroundProps {
  testMode?: boolean;
}

/** JSDoc
 * A React component that renders a video background.
 * - In normal mode, it displays a single looping background video. (background.mp4 in root folder)
 * - In test mode, it provides a toggle button to enable/disable the video and cycle through different the different backgrounds:
 *  "background.mp4" and "background2.mp4" -> "background5.mp4"
 *
 * @component
 * @param {boolean} [testMode=false] - If `true`, enables test mode with a toggle button and multiple video backgrounds.
 * @returns {JSX.Element} The VideoBackground component.
 */
const VideoBackground: React.FC<VideoBackgroundProps> = ({
  testMode = false,
}) => {
  // State for test mode functionality
  const [isVideoEnabled, setIsVideoEnabled] = useState(!testMode); // Enabled by default if not in test mode
  const [videoIndex, setVideoIndex] = useState(1);

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

        {isVideoEnabled && (
          <video id="video-bg" autoPlay loop muted key={currentVideoSource}>
            <source src={currentVideoSource} type="video/mp4" />
            Browser does not support the video tag.
          </video>
        )}
      </div>
    );
  }

  // In normal mode, just return the video without any container or button
  return (
    <video id="video-bg" autoPlay loop muted>
      <source src="background.mp4" type="video/mp4" />
      Browser does not support the video tag.
    </video>
  );
};

export default VideoBackground;
