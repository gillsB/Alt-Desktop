import React, { useRef, useState } from "react";

interface HoverOpacityItemProps {
  setVideoOpacity: (opacity: number) => void;
}

const HoverOpacityItem: React.FC<HoverOpacityItemProps> = ({
  setVideoOpacity,
}) => {
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null); // Track the timeout
  const [, setIsHovered] = useState(false); // Track hover state

  const handleHover = () => {
    setIsHovered(true);
    hoverTimeout.current = setTimeout(() => {
      setVideoOpacity(0); // Update opacity
    }, 150); // short delay to avoid dragging mouse across it accidentally triggering it.
  };

  const handleMouseMove = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current); // Reset the timer on mouse move
      hoverTimeout.current = setTimeout(() => {
        setVideoOpacity(0); // Update opacity
      }, 150); // short delay to avoid dragging mouse across it accidentally triggering it.
    }
  };

  const handleDoubleClick = () => {
    window.electron.sendHeaderAction("MINIMIZE");
  };

  const handleLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current); // Cancel opacity change if hover ends early
      hoverTimeout.current = null;
    }
    setIsHovered(false); // Mark as no longer hovered
    setVideoOpacity(1); // Restore opacity
  };

  return (
    <div
      className="hover-opacity-item"
      onMouseEnter={handleHover}
      onMouseLeave={handleLeave}
      onMouseMove={handleMouseMove} // Reset timer on mouse move
      onDoubleClick={handleDoubleClick}
    ></div>
  );
};

export default HoverOpacityItem;
