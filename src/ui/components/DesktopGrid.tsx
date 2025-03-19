import React, { useEffect, useState } from "react";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";

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
          // Use the appdata-file protocol for the alternate image
          const newImage = (icon.image = "src/assets/altTemplate@2x.png");

          return {
            ...icon,
            image: newImage,
          };
        }
        return icon;
      })
    );
  };

  const getImagePath = (imagePath: string) => {
    // If it's already using our protocol or is a remote URL, use it as is
    if (
      imagePath.startsWith("appdata-file://") ||
      imagePath.startsWith("http")
    ) {
      return imagePath;
    }

    // If it's a built-in asset, use it as is
    if (imagePath.startsWith("src/assets/")) {
      return imagePath;
    }

    // Otherwise, assume it's a local file that should use our protocol
    return `appdata-file://icons/${imagePath}`;
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
                backgroundImage: `url(${getImagePath(icon.image)})`,
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
