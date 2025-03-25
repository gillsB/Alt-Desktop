import React from "react";

const HoverOpacityItem: React.FC = () => {
  const handleHover = () => {
    window.electron.sendHoverAction("OPACITY");
  };

  return <div className="hover-opacity-item" onMouseEnter={handleHover}></div>;
};

export default HoverOpacityItem;
