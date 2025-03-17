import React, { useState } from "react";
import "../App.css";
import { DesktopIcon } from "../models/DesktopIcon";

const ICON_SIZE = 100;

const DesktopGrid: React.FC = () => {
  const [icons, setIcons] = useState<DesktopIcon[]>([
    { row: 0, col: 0, name: "Icon 1", width: 64, height: 64, image: "alt.png" },
    {
      row: 0,
      col: 1,
      name: "Special Icon",
      width: 64,
      height: 64,
      image: "alt.png",
    },
    {
      row: 1,
      col: 0,
      name: "Icon 3",
      width: 64,
      height: 64,
      image: "alt.png",
      fontColor: "red",
    },
    {
      row: 1,
      col: 1,
      name: "Icon 3",
      width: 64,
      height: 64,
      image: "alt.png",
      fontColor: "green",
    },
  ]);

  const handleClick = (row: number, col: number) => {
    setIcons((prevIcons) =>
      prevIcons.map((icon) =>
        icon.row === row && icon.col === col
          ? {
              ...icon,
              fontColor: icon.fontColor === "yellow" ? "white" : "yellow",
            }
          : icon
      )
    );
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {icons.map((icon) => (
        <div
          key={`${icon.row}-${icon.col}`}
          className="desktop-icon"
          style={{
            left: icon.col * ICON_SIZE, // Column-based positioning
            top: icon.row * ICON_SIZE, // Row-based positioning
            width: icon.width,
            height: icon.height + 30,
          }}
          onClick={() => handleClick(icon.row, icon.col)}
        >
          <div
            className="desktop-icon-image"
            style={{
              width: icon.width,
              height: icon.height,
              backgroundImage: `url(${icon.image})`,
            }}
          ></div>

          <p
            className="desktop-icon-name"
            style={{ color: icon.fontColor || "white" }}
          >
            {icon.name}
          </p>
        </div>
      ))}
    </div>
  );
};

export default DesktopGrid;
