import React, { useState } from "react";
import { DesktopIcon } from "../models/DesktopIcon";

const DesktopGrid: React.FC = () => {
  // Testing with just a pre-defined icon.
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
  ]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {icons.map((icon) => (
        <div
          key={icon.id}
          style={{
            position: "absolute",
            left: icon.x,
            top: icon.y,
            width: icon.width,
            height: icon.height + 30,
            textAlign: "center",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: icon.width,
              height: icon.height,
              backgroundImage: `url(${icon.image})`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              marginBottom: "10px",
            }}
          ></div>

          {/* Icon Name */}

          <p
            style={{
              margin: 0,
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
