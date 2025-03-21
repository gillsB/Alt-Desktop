import React, { useEffect, useState } from "react";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";

const ICON_SIZE = 100;
const GRID_PADDING = 20; //padding top and left of DesktopGrid

const DesktopGrid: React.FC = () => {
  const [icons, setIcons] = useState<DesktopIcon[]>([]);
  const [contextMenu, setContextMenu] = useState<any | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const contextMenuElement = document.querySelector(".context-menu");

      // Only proceed if the context menu exists and is not being clicked
      if (
        contextMenu &&
        contextMenuElement &&
        !e.composedPath().includes(contextMenuElement)
      ) {
        setContextMenu(null); // Hide the context menu when clicking outside
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu]);

  const handleIconClick = (row: number, col: number) => {
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

  const handleIconDoubleClick = (row: number, col: number) => {
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

  const handleRightClick = (
    e: React.MouseEvent,
    type: "icon" | "desktop",
    row?: number,
    col?: number
  ) => {
    e.preventDefault(); // Prevent default context menu
    const { clientX: x, clientY: y } = e;

    setContextMenu({
      x,
      y,
      type,
      icon:
        type === "icon"
          ? icons.find((icon) => icon.row === row && icon.col === col)
          : null,
    });
  };

  const handleDesktopRightClick = (e: React.MouseEvent) => {
    handleRightClick(e, "desktop");
  };

  const handleIconRightClick = (
    e: React.MouseEvent,
    row: number,
    col: number
  ) => {
    e.stopPropagation(); // Prevent event from bubbling up to the desktop level
    handleRightClick(e, "icon", row, col);
  };

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

  return (
    <>
    <div
      style={{ position: "relative", width: "100vw", height: "100vh" }}
      onContextMenu={handleDesktopRightClick} // Handle right-click on the desktop grid
    >
      {icons.map((icon) => (
        <div
          key={`${icon.row}-${icon.col}`}
          className="desktop-icon"
          style={{
            left: icon.col * ICON_SIZE + GRID_PADDING,
            top: icon.row * ICON_SIZE + GRID_PADDING,
            width: icon.width || 64,
            height: (icon.height || 64) + 30,
          }}
          onClick={() => handleIconClick(icon.row, icon.col)}
          onDoubleClick={() => handleIconDoubleClick(icon.row, icon.col)}
          onContextMenu={(e) => handleIconRightClick(e, icon.row, icon.col)} // Handle right-click on an icon
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

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {contextMenu.type === "desktop" ? (
            <>
              <p>Refresh Desktop</p>
              <p>Settings</p>
              <p>New Icon</p>
            </>
          ) : (
            <>
              <p>Open {contextMenu.icon?.name}</p>
              <p>Rename</p>
              <p>Delete</p>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default DesktopGrid;
