import React, { useEffect, useState } from "react";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";

const ICON_SIZE = 100;
const GRID_PADDING = 20;

interface ContextMenu {
  x: number;
  y: number;
  type: "desktop" | "icon";
  icon?: DesktopIcon | null;
}

const DesktopGrid: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [icons, setIcons] = useState<DesktopIcon[]>([]);
  const [iconsMap, setIconsMap] = useState<Map<string, DesktopIcon>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  useEffect(() => {
    const fetchIcons = async () => {
      try {
        const data = await window.electron.getDesktopIconData();
        console.log("Fetched icons:", data.icons);

        setIcons(data.icons); // Keep array version
        const newMap = new Map<string, DesktopIcon>();
        data.icons.forEach((icon: DesktopIcon) => {
          newMap.set(`${icon.row},${icon.col}`, icon);
        });
        setIconsMap(newMap);
        console.log(newMap);
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
    setIconsMap((prevMap) => {
      const newMap = new Map(prevMap);
      const key = `${row},${col}`;
      const icon = newMap.get(key);
      if (icon) {
        newMap.set(key, {
          ...icon,
          fontColor: icon.fontColor === "yellow" ? "white" : "yellow",
        });
      }
      return newMap;
    });

    // Sync state with `icons` array
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

  const handleIconDoubleClick = (row: number, col: number) => {
    setIconsMap((prevMap) => {
      const newMap = new Map(prevMap);
      const key = `${row},${col}`;
      const icon = newMap.get(key);
      if (icon) {
        newMap.set(key, { ...icon, image: "src/assets/altTemplate@2x.png" });
      }
      return newMap;
    });

    setIcons((prevIcons) =>
      prevIcons.map((icon) =>
        icon.row === row && icon.col === col
          ? { ...icon, image: "src/assets/altTemplate@2x.png" }
          : icon
      )
    );
  };

  const handleRightClick = (
    e: React.MouseEvent,
    type: "icon" | "desktop",
    row?: number,
    col?: number
  ) => {
    e.preventDefault();
    const { clientX: x, clientY: y } = e;

    setContextMenu({
      x,
      y,
      type,
      icon: type === "icon" ? iconsMap.get(`${row},${col}`) || null : null,
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
    e.stopPropagation();
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
        onContextMenu={handleDesktopRightClick}
      >
        {Array.from(iconsMap.values()).map(
          (
            icon // Convert Map.values() to array
          ) => (
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
              onContextMenu={(e) => handleIconRightClick(e, icon.row, icon.col)}
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
          )
        )}
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
