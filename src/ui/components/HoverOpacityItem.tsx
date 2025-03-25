import React from "react";

interface HoverOpacityItemProps {
  setVideoOpacity: (opacity: number) => void;
}

const HoverOpacityItem: React.FC<HoverOpacityItemProps> = ({
  setVideoOpacity,
}) => {
  const handleHover = () => {
    window.electron.sendHoverAction("OPACITY"); // Notify backend
    setVideoOpacity(0); // Update opacity
  };

  const handleLeave = () => {
    setVideoOpacity(1); // Restore opacity
  };

  return (
    <div
      className="hover-opacity-item"
      onMouseEnter={handleHover}
      onMouseLeave={handleLeave}
    ></div>
  );
};

export default HoverOpacityItem;
