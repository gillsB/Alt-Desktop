import React, { useState } from "react";
import "../App.css";
import { DesktopIcon } from "../models/DesktopIcon";

const DesktopGrid: React.FC = () => {
  // Testing with just a pre-defined icons.
  const [icons, setIcons] = useState<DesktopIcon[]>([
    {
      id: "1",
      name: "Desktop Icon",
      width: 64,
      height: 64,
      image: "alt.png",
      x: 50,
      y: 50,
    },
    {
      id: "2",
      name: "Special Icon",
      width: 64,
      height: 64,
      image: "alt.png",
      x: 150,
      y: 50,
      fontColor: "red",
    },
  ]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {icons.map((icon) => (
        <div
          key={icon.id}
          className="desktop-icon"
          style={{
            left: icon.x,
            top: icon.y,
            width: icon.width,
            height: icon.height + 30,
          }}
        >
          {/* Icon */}
          <div
            className="desktop-icon-image"
            style={{
              width: icon.width,
              height: icon.height,
              backgroundImage: `url(${icon.image})`,
            }}
          ></div>

          {/* Icon Name */}
          <p
            className="desktop-icon-name"
            style={{
              color: icon.fontColor || "white", // Override if icon has custom fontColor
            }}
          >
            {icon.name}
          </p>
        </div>
      ))}
    </div>
  );
};

export default DesktopGrid;
