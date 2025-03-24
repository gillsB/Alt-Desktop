import React, { useState } from "react";

// Defines an interface for passing parameters to the VideoBackground
interface VideoBackgroundProps {
  className?: string;
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({
  className = "",
}) => {
  // State to track if video is enabled (starts disabled)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);

  // State to track which video file to use (1-5)
  const [videoIndex, setVideoIndex] = useState(1);

  // Array of video sources
  const videoSources = [
    "background.mp4",
    "background2.mp4",
    "background3.mp4",
    "background4.mp4",
    "background5.mp4",
  ];

  // Toggle video state and cycle through sources when enabling
  const toggleVideo = () => {
    // If video is currently enabled, just disable it
    if (isVideoEnabled) {
      setIsVideoEnabled(false);
    }
    // If video is currently disabled, enable it and use current index
    else {
      setIsVideoEnabled(true);
      // Prepare the next video index for the next toggle cycle
      setVideoIndex((prevIndex) => (prevIndex % videoSources.length) + 1);
    }
  };

  // Current video source based on videoIndex (subtract 1 for zero-based array)
  const currentVideoSource = videoSources[videoIndex - 1];

  return (
    <div className={`video-background-container ${className}`}>
      {/* Toggle button showing current background number when enabled */}
      <button className="video-toggle" onClick={toggleVideo}>
        {isVideoEnabled
          ? `Disable Video (${videoIndex}/5)`
          : `Enable Video (${videoIndex}/5)`}
      </button>

      {/* Video element only rendered when enabled */}
      {isVideoEnabled && (
        <video id="video-bg" autoPlay loop muted key={currentVideoSource}>
          <source src={currentVideoSource} type="video/mp4" />
          Browser does not support the video tag.
        </video>
      )}
    </div>
  );
};

export default VideoBackground;
