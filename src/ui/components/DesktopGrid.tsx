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
            width: icon.width,
            height: icon.height,
            position: "absolute",
            left: icon.x,
            top: icon.y,
            backgroundImage: `url(${icon.image})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <p>{icon.name}</p>
        </div>
      ))}
    </div>
  );
};

export default DesktopGrid;
