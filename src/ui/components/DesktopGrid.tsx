import React, { useEffect, useState } from "react";
import "../App.css";
import { DesktopIcon } from "../models/DesktopIcon";

const ICON_SIZE = 100;

const DesktopGrid: React.FC = () => {
  const [icons, setIcons] = useState<DesktopIcon[]>([]);

  useEffect(() => {
    const fetchIcons = async () => {
      try {
        const data = await window.electron.getDesktopIconData();
        console.log("Fetched icons:", data.icons);
        setIcons(data.icons);
      } catch (error) {
        console.error("Error loading icons:", error);
      }
    };

    fetchIcons();
  }, []);

  const handleClick = (row: number, col: number) => {
    setIcons((prevIcons) =>
      prevIcons.map((icon) => {
        if (icon.row === row && icon.col === col) {
          return {
            ...icon,
            fontColor: icon.fontColor === "yellow" ? "white" : "yellow",
          };
        }
        return icon;
      })
    );
  };

  const handleDoubleClick = (row: number, col: number) => {
    setIcons((prevIcons) =>
      prevIcons.map((icon) => {
        if (icon.row === row && icon.col === col) {
          return {
            ...icon,
            image:
              icon.image === "src/assets/altTemplate@2x.png"
                ? "alt.png"
                : "src/assets/altTemplate@2x.png",
          };
        }
        return icon;
      })
    );
  };

  return (
    <>
      <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
        {icons.map((icon) => (
          <div
            key={`${icon.row}-${icon.col}`}
            className="desktop-icon"
            style={{
              left: icon.col * ICON_SIZE,
              top: icon.row * ICON_SIZE,
              width: icon.width || 64,
              height: (icon.height || 64) + 30,
            }}
            onClick={() => handleClick(icon.row, icon.col)}
            onDoubleClick={() => handleDoubleClick(icon.row, icon.col)}
          >
            <div
              className="desktop-icon-image"
              style={{
                width: icon.width || 64,
                height: icon.height || 64,
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
    </>
  );
};

export default DesktopGrid;
