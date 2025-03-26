import React, { useRef } from "react";

interface HoverOpacityItemProps {
  setVideoOpacity: (opacity: number) => void;
}

const HoverOpacityItem: React.FC<HoverOpacityItemProps> = ({
  setVideoOpacity,
}) => {
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null); // Track the timeout

  const handleHover = () => {
    hoverTimeout.current = setTimeout(() => {
      window.electron.sendHoverAction("OPACITY"); // Notify backend
      setVideoOpacity(0); // Update opacity
    }, 150); // short delay to avoid dragging mouse across it accidentally triggering it.
  };

  const handleLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current); // Cancel opacity change if hover ends early
      hoverTimeout.current = null;
    }
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
