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
  const [iconsMap, setIconsMap] = useState<Map<string, DesktopIcon>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  /** JSDoc
   * Retrieves a `DesktopIcon` from the `iconsMap` at the specified position.
   *
   * @param {number} row - The row position of the icon in the grid.
   * @param {number} col - The column position of the icon in the grid.
   * @returns {DesktopIcon | undefined} The `DesktopIcon` object at the specified position, or `undefined` if the icon doesn't exist.
   */
  const getIcon = (row: number, col: number): DesktopIcon | undefined => {
    return iconsMap.get(`${row},${col}`);
  };

  /** JSDoc
   * Updates a specific field of a `DesktopIcon` at the given position.
   *
   * @param { [number, number] } position - A tuple representing the [row, col] position of the icon.
   * @param { keyof DesktopIcon } field - The field of the `DesktopIcon` to update.
   * @param { DesktopIcon[keyof DesktopIcon] } value - The new value to set for the specified field.
   */
  const updateIconField = <K extends keyof DesktopIcon>(
    position: [number, number],
    field: K,
    value: DesktopIcon[K]
  ) => {
    setIconsMap((prevMap) => {
      const key = `${position[0]},${position[1]}`; // Convert tuple to key
      const icon = prevMap.get(key);
      if (!icon) return prevMap; // No update if icon doesn't exist

      const newMap = new Map(prevMap);
      newMap.set(key, { ...icon, [field]: value });

      return newMap;
    });
  };

  useEffect(() => {
    const fetchIcons = async () => {
      try {
        const data = await window.electron.getDesktopIconData();
        console.log("Fetched icons:", data.icons);

        // Create an array of promises for ensuring folders
        const folderPromises = data.icons.map(async (icon: DesktopIcon) => {
          // Ensure data folder exists for each icon
          const success = await window.electron.ensureDataFolder(
            icon.row,
            icon.col
          );
          if (!success) {
            console.warn(
              `Failed to create data folder for icon at [${icon.row}, ${icon.col}]`
            );
          }
          return icon;
        });

        // Wait for all folder creation promises to resolve
        const processedIcons = await Promise.all(folderPromises);

        const newMap = new Map<string, DesktopIcon>();
        processedIcons.forEach((icon: DesktopIcon) => {
          newMap.set(`${icon.row},${icon.col}`, icon);
        });

        setIconsMap(newMap);
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
    const icon = getIcon(row, col);
    if (!icon) return iconsMap; // No update if icon doesn't exist
    const newColor = icon.fontColor === "yellow" ? "white" : "yellow";
    updateIconField([row, col], "fontColor", newColor);
  };

  const handleIconDoubleClick = (row: number, col: number) => {
    updateIconField([row, col], "image", "src/assets/altTemplate@2x.png");
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
      icon:
        type === "icon" && row !== undefined && col !== undefined
          ? getIcon(row, col) || null
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
    e.stopPropagation();
    handleRightClick(e, "icon", row, col);
  };

  const getImagePath = (row: number, col: number, imagePath: string) => {
    // If path already matches valid protocols return it.
    if (
      imagePath.startsWith("appdata-file://") ||
      imagePath.startsWith("src/assets/")
    ) {
      return imagePath;
    }

    const folderPath = `/data/[${row},${col}]`;
    const safeFilePath = `appdata-file://${folderPath}/${imagePath}`;

    // Check if the path ends with a typical image extension
    const isImageExtension = /\.(png|jpg|jpeg|gif|bmp|svg|webp|lnk)$/i.test(
      imagePath
    );

    // If no image extension or we want to always use fallback
    if (!isImageExtension) {
      return "src/assets/unknown.png";
    }

    return safeFilePath;
  };

  const SafeImage: React.FC<{
    row: number;
    col: number;
    originalImage: string;
    width?: number;
    height?: number;
  }> = ({ row, col, originalImage, width = 64, height = 64 }) => {
    const [imageSrc, setImageSrc] = useState<string>(() =>
      getImagePath(row, col, originalImage)
    );

    useEffect(() => {
      const img = new Image();
      img.src = imageSrc;

      img.onerror = () => {
        console.error(
          `Failed to load image: ${imageSrc}. Falling back to unknown.png`
        );
        setImageSrc("src/assets/unknown.png");
      };

      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }, [imageSrc, row, col]);

    return (
      <div
        className="desktop-icon-image"
        style={{
          width,
          height,
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  };

  return (
    <>
      <div
        style={{ position: "relative", width: "100vw", height: "100vh" }}
        onContextMenu={handleDesktopRightClick}
      >
        {Array.from(iconsMap.values()).map((icon) => (
          <div
            key={`${icon.row}-${icon.col}`}
            className="desktop-icon"
            style={{
              left: icon.col * ICON_SIZE + GRID_PADDING,
              top: icon.row * ICON_SIZE,
              width: icon.width || 64,
              height: (icon.height || 64) + 30,
            }}
            onClick={() => handleIconClick(icon.row, icon.col)}
            onDoubleClick={() => handleIconDoubleClick(icon.row, icon.col)}
            onContextMenu={(e) => handleIconRightClick(e, icon.row, icon.col)}
          >
            <SafeImage
              row={icon.row}
              col={icon.col}
              originalImage={icon.image}
              width={icon.width || 64}
              height={icon.height || 64}
            />
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
