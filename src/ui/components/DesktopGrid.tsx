import React, { useEffect, useRef, useState } from "react";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";

const ICON_SIZE = 100;
const GRID_PADDING = 20; //padding top and left of DesktopGrid

const DesktopGrid: React.FC = () => {
  const [icons, setIcons] = useState<DesktopIcon[]>([]);
  const [contextMenu, setContextMenu] = useState<null | {
    x: number;
    y: number;
    type: "icon" | "desktop";
    icon: DesktopIcon | null;
  }>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load icons on initial render
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

  const getImagePath = (imagePath: string) => {
    if (
      imagePath.startsWith("appdata-file://") ||
      imagePath.startsWith("http")
    ) {
      return imagePath;
    }

    if (imagePath.startsWith("src/assets/")) {
      return imagePath;
    }

    return `appdata-file://${imagePath}`;
  };

  // Handle right-click for context menu
  const handleContextMenu = (e: React.MouseEvent, icon: DesktopIcon | null) => {
    e.preventDefault();
    const { clientX, clientY } = e;

    setContextMenu({
      x: clientX,
      y: clientY,
      type: icon ? "icon" : "desktop",
      icon,
    });
  };

  // Close the context menu when clicking anywhere else
  const handleClick = () => {
    setContextMenu(null);
  };

  return (
    <div
      ref={gridRef}
      style={{ position: "relative", width: "100vw", height: "100vh" }}
      onClick={handleClick} // Close context menu when clicking elsewhere
    >
      {icons.map((icon) => (
        <div
          key={`${icon.row}-${icon.col}`}
          className="desktop-icon"
          style={{
            position: "absolute",
            left: icon.col * ICON_SIZE + GRID_PADDING,
            top: icon.row * ICON_SIZE + GRID_PADDING,
            width: icon.width || 64,
            height: (icon.height || 64) + 30,
          }}
          onContextMenu={(e) => handleContextMenu(e, icon)} // Right-click on an icon
        >
          <div
            className="desktop-icon-image"
            style={{
              width: icon.width || 64,
              height: icon.height || 64,
              backgroundImage: `url(${getImagePath(icon.image)})`,
            }}
          />
          <p
            className="desktop-icon-name"
            style={{ color: icon.fontColor || "white" }}
          >
            {icon.name}
          </p>
        </div>
      ))}

      {/* Render Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {contextMenu.type === "desktop" ? (
            <p>Right-clicked on Desktop</p>
          ) : (
            <p>Right-clicked on {contextMenu.icon?.name}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DesktopGrid;
