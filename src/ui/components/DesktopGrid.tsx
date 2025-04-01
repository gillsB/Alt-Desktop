import React, { useEffect, useState } from "react";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import { SafeImage } from "./SafeImage";

interface ContextMenu {
  x: number;
  y: number;
  type: "desktop" | "icon";
  icon?: DesktopIcon | null;
}

const DesktopGrid: React.FC = () => {
  const [iconsMap, setIconsMap] = useState<Map<string, DesktopIcon>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showGrid, setShowGrid] = useState(false); // State to toggle grid visibility

  const ICON_SIZE = 100;
  const GRID_PADDING = 20;

  const numRows = 20;
  const numCols = 50;

  // Function to toggle grid visibility
  const toggleGrid = () => {
    setShowGrid((prev) => !prev);
    setContextMenu(null); // Close the context menu after toggling
  };

  /**
   * Retrieves a `DesktopIcon` from the `iconsMap` at the specified position.
   *
   * @param {number} row - The row position of the icon in the grid.
   * @param {number} col - The column position of the icon in the grid.
   * @returns {DesktopIcon | undefined} The `DesktopIcon` object at the specified position, or `undefined` if the icon doesn't exist.
   */
  const getIcon = (row: number, col: number): DesktopIcon | undefined => {
    return iconsMap.get(`${row},${col}`);
  };

  /**
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

  /**
   * Handles the "reload-icon" IPC event from the Electron main process.
   * This function updates the `iconsMap` state with the new icon data received via IPC.
   *
   * **Note:** This function is intended to be used exclusively as a callback for the
   * "reloadIcon" IPC event and should not be called directly.
   *
   * @param {number} row - The row position of the icon in the grid.
   * @param {number} col - The column position of the icon in the grid.
   * @param {DesktopIcon} updatedIcon - The updated `DesktopIcon` object received from the IPC event.
   */
  const handleIpcReloadIcon = (
    row: number,
    col: number,
    updatedIcon: DesktopIcon
  ) => {
    setIconsMap((prevMap) => {
      const key = `${row},${col}`;
      const newMap = new Map(prevMap);
      newMap.set(key, updatedIcon); // Update the specific icon
      return newMap;
    });
    console.log(`Reloaded icon at [${row}, ${col}]`);
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

  useEffect(() => {
    // Listen for the reload-icon event from the main process
    const handleReloadIcon = (
      _: Electron.IpcRendererEvent,
      { row, col, icon }: { row: number; col: number; icon: DesktopIcon }
    ) => {
      handleIpcReloadIcon(row, col, icon);
    };

    window.electron.on(
      "reload-icon",
      handleReloadIcon as (...args: unknown[]) => void
    );

    return () => {
      window.electron.off(
        "reload-icon",
        handleReloadIcon as (...args: unknown[]) => void
      );
    };
  }, []);

  const handleIconClick = (row: number, col: number) => {
    const icon = getIcon(row, col);
    if (!icon) return iconsMap; // No update if icon doesn't exist
    const newColor = icon.fontColor === "red" ? "white" : "red";
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

    // Subtract the header height
    const headerHeight = document.querySelector("header")?.offsetHeight || 0;

    setContextMenu({
      x,
      y: y - headerHeight,
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

  const handleOpenIcon = () => {
    if (contextMenu?.icon) {
      // Send the action to the main process via Electron's IPC
      window.electron.sendSubWindowAction("EDIT_ICON", contextMenu.icon);
      setContextMenu(null); // Close the context menu
    }
  };

  const handleReloadIcon = async () => {
    if (contextMenu?.icon) {
      const { row, col } = contextMenu.icon;

      try {
        // Call the Electron API to reload the icon
        await window.electron.reloadIcon(row, col);
        console.log(`Reloaded icon at [${row}, ${col}] via Electron API`);
      } catch (error) {
        console.error(`Failed to reload icon at [${row}, ${col}]:`, error);
      }

      setContextMenu(null); // Close the context menu
    }
  };
  const handleReloadDesktop = async () => {
    try {
      // Call the Electron API to reload the icon
      await window.electron.reloadWindow();
    } catch (error) {
      console.error(`Failed to reload window`, error);
    }

    setContextMenu(null); // Close the context menu
  };
  return (
    <>
      <div
        style={{ position: "relative", width: "100vw", height: "100vh" }}
        onContextMenu={handleDesktopRightClick}
      >
        {/* Conditionally render horizontal grid lines */}
        {showGrid &&
          Array.from({ length: numRows + 1 }).map((_, rowIndex) => (
            <div
              key={`h-line-${rowIndex}`}
              style={{
                position: "absolute",
                top: rowIndex * (ICON_SIZE + 30) + GRID_PADDING, // Match icon row spacing
                left: 0,
                width: "100%",
                height: "1px",
                backgroundColor: "red",
              }}
            />
          ))}

        {/* Conditionally render vertical grid lines */}
        {showGrid &&
          Array.from({ length: numCols + 1 }).map((_, colIndex) => (
            <div
              key={`v-line-${colIndex}`}
              style={{
                position: "absolute",
                top: 0,
                left: GRID_PADDING + colIndex * ICON_SIZE, // Match icon column spacing
                width: "1px",
                height: "100%",
                backgroundColor: "red",
              }}
            />
          ))}

        {/* Render desktop icons */}
        {Array.from(iconsMap.values()).map((icon) => (
          <div
            key={`${icon.row}-${icon.col}`}
            className="desktop-icon"
            style={{
              left: icon.col * ICON_SIZE + GRID_PADDING + (icon.offsetX || 0), // Default to 0 if offsetX is undefined
              top:
                icon.row * (ICON_SIZE + 30) +
                GRID_PADDING +
                (icon.offsetY || 0), // Default to 0 if offsetY is undefined
              width: icon.width || 64,
              height: icon.height || 64,
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
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "desktop" ? (
            <>
              <p onClick={handleReloadDesktop}>Reload Desktop</p>
              <p>Settings</p>
              <p>New Icon</p>
              <p onClick={toggleGrid}>{showGrid ? "✔ " : ""}Show Grid</p>
            </>
          ) : (
            <>
              <p onClick={handleOpenIcon}>Open {contextMenu.icon?.name}</p>
              <p onClick={handleReloadIcon}>Reload Icon</p>
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
