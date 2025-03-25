import React from "react";

const HoverOpacityItem: React.FC = () => {
  const handleHover = () => {
    console.log("Hovered");
  };

  return <div className="hover-opacity-item" onMouseEnter={handleHover}></div>;
};

export default HoverOpacityItem;
