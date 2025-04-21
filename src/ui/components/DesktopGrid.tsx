import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SafeImage } from "./SafeImage";

const logger = createLogger("DesktopGrid.tsx");

interface ContextMenu {
  x: number;
  y: number;
  type: "desktop" | "icon";
  icon?: DesktopIcon | null;
}

interface HighlightPosition {
  row: number;
  col: number;
  visible: boolean;
}

interface IconReloadTimestamps {
  [key: string]: number;
}

const DesktopGrid: React.FC = () => {
  const [iconsMap, setIconsMap] = useState<Map<string, DesktopIcon>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showGrid, setShowGrid] = useState(false); // State to toggle grid visibility
  const [showLaunchSubmenu, setShowLaunchSubmenu] = useState(false); // State for submenu visibility
  const [showOpenSubmenu, setShowOpenSubmenu] = useState(false); // State for submenu visibility
  const [highlightBox, setHighlightBox] = useState<HighlightPosition>({
    row: 0,
    col: 0,
    visible: false,
  });
  const [reloadTimestamps, setReloadTimestamps] =
    useState<IconReloadTimestamps>({});

  // Refers to a square size of the icon box, not the icon's size in pixels.
  const ICON_SIZE = 100;

  // These padding values affect essentially only the root position of the icons
  // This is not padding between icons
  const ICON_ROOT_OFFSET_TOP = 40;
  const ICON_ROOT_OFFSET_LEFT = 40;

  // Padding between icons
  const ICON_VERTICAL_PADDING = 30;
  const ICON_HORIZONTAL_PADDING = 0;

  const numRows = 20;
  const numCols = 50;

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Function to toggle grid visibility
  const toggleGrid = () => {
    setShowGrid((prev) => !prev);
    setContextMenu(null); // Close the context menu after toggling
  };

  /**
   * Shows a highlight box at the specified row and column position.
   *
   * @param {number} row - The row position for the highlight box.
   * @param {number} col - The column position for the highlight box.
   */
  const showHighlightAt = (row: number, col: number) => {
    setHighlightBox({
      row,
      col,
      visible: true,
    });
  };

  /**
   * Hides the currently visible highlight box.
   */
  const hideHighlightBox = () => {
    setHighlightBox((prev) => ({
      ...prev,
      visible: false,
    }));
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
    const iconKey = `${row},${col}`;

    // Force image reload with new timestamp
    setReloadTimestamps((prev) => ({
      ...prev,
      [iconKey]: Date.now(),
    }));

    // If an updated icon was provided, update the state
    if (updatedIcon) {
      setIconsMap((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(iconKey, updatedIcon);
        return newMap;
      });
    }

    logger.info(`Updated icon UI at [${row}, ${col}]`);
  };

  useEffect(() => {
    const fetchIcons = async () => {
      try {
        const data = await window.electron.getDesktopIconData();
        logger.info("Fetched icons:", data.icons);

        // Create an array of promises for ensuring folders
        const folderPromises = data.icons.map(async (icon: DesktopIcon) => {
          // Ensure data folder exists for each icon
          const success = await window.electron.ensureDataFolder(
            icon.row,
            icon.col
          );
          if (!success) {
            logger.warn(
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
        logger.error("Error loading icons:", error);
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
        hideHighlightBox();
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
    hideHighlightBox();
  };

  const handleIconDoubleClick = async (row: number, col: number) => {
    logger.info("double clicked icon", row, col);
    await window.electron.launchProgram(row, col);
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
      y: headerAdjustY(y),
      type,
      icon:
        type === "icon" && row !== undefined && col !== undefined
          ? getIcon(row, col) || null
          : null,
    });
  };

  const handleDesktopRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    // React.MouseEvent returns global coordinates, so we need to adjust them to local coordinates
    const adjustedY = headerAdjustY(y);

    // Calculate the nearest grid slot
    const [validRow, validCol] = getRowColFromXY(x, adjustedY);
    showHighlightAt(validRow, validCol);

    // Check if an icon exists at the calculated row and column
    const existingIcon = getIcon(validRow, validCol);

    if (existingIcon) {
      // If an icon exists, set the context menu to "icon" type
      setContextMenu({
        x,
        y: headerAdjustY(y),
        type: "icon",
        icon: existingIcon,
      });
      logger.info(
        `Desktop right click nearest icon exists at row: ${validRow}, col: ${validCol}`
      );
    } else {
      // Otherwise, set the context menu to "desktop" type
      setContextMenu({
        x,
        y: headerAdjustY(y),
        type: "desktop",
        icon: null,
      });
      logger.info(
        `Desktop right click empty icon slot at row: ${validRow}, col: ${validCol}`
      );
    }
  };

  const handleIconRightClick = (
    e: React.MouseEvent,
    row: number,
    col: number
  ) => {
    e.stopPropagation();
    handleRightClick(e, "icon", row, col);
    showHighlightAt(row, col);

    logger.info(
      `Icon right click at row: ${row}, col: ${col} with icon name: ${iconsMap.get(`${row},${col}`)?.name}`
    );
  };

  const handleEditIcon = (row?: number, col?: number) => {
    if (row !== undefined && col !== undefined) {
      // If row and col are provided, directly call editIcon
      window.electron.ensureDataFolder(row, col);
      window.electron.editIcon(row, col);
      setContextMenu(null);
      return;
    }

    // Fallback to contextMenu logic if row and col are not provided
    if (contextMenu) {
      const { x, y } = contextMenu;
      // contextMenu returns local coordinates. Which getRowColFromXY expects.
      const [validRow, validCol] = getRowColFromXY(x, y);

      window.electron.ensureDataFolder(validRow, validCol);
      window.electron.editIcon(validRow, validCol);
      setContextMenu(null);
    } else {
      logger.error("Tried to edit an icon, but contextMenu was null.");
      setContextMenu(null);
    }
  };

  const handleReloadIcon = async () => {
    if (contextMenu?.icon) {
      const { row, col } = contextMenu.icon;

      try {
        // Call the Electron API to reload the icon
        const ret = await window.electron.reloadIcon(row, col);
        if (!ret) {
          logger.info(
            `Icon not found at [${row}, ${col}], removing it from map`
          );
          setIconsMap((prevMap) => {
            const newMap = new Map(prevMap);
            newMap.delete(`${row},${col}`);
            return newMap;
          });
        }
      } catch (error) {
        logger.error(`Failed to reload icon at [${row}, ${col}]:`, error);
      }

      setContextMenu(null);
      hideHighlightBox();
    }
  };

  const handleDeleteIcon = async () => {
    if (contextMenu?.icon) {
      const { row, col } = contextMenu.icon;

      try {
        // Call the Electron API to delete the icon
        await window.electron.deleteIcon(row, col);
        logger.info(`Deleted icon at [${row}, ${col}]`);
      } catch (error) {
        logger.error(`Failed to delete icon at [${row}, ${col}]:`, error);
      }

      setContextMenu(null);
      hideHighlightBox();
      handleReloadIcon();
    }
  };

  const handleReloadDesktop = async () => {
    try {
      // Call the Electron API to reload the icon
      await window.electron.reloadWindow();
    } catch (error) {
      logger.error(`Failed to reload window`, error);
    }

    setContextMenu(null); // Close the context menu
  };

  const handleLaunchSubmenuClick = async (option: string) => {
    if (contextMenu && contextMenu?.icon) {
      const { name } = contextMenu.icon;
      const { row, col } = contextMenu.icon;
      switch (option) {
        case "Program":
          logger.info(`Running program for icon: ${name}`);
          await window.electron.launchProgram(row, col);
          break;
        case "Website":
          logger.info(`Opening website for icon: ${name}`);
          await window.electron.launchWebsite(row, col);
          break;
        default:
          logger.warn(`Unknown submenu option: ${option}`);
      }
    }
    setShowLaunchSubmenu(false);
  };

  const handleOpenSubmenuClick = async (option: string) => {
    if (contextMenu?.icon) {
      const { row, col, name, image, programLink } = contextMenu.icon;

      switch (option) {
        case "Image folder":
          if (image) {
            const filePath = `data/[${row},${col}]/${image}`;
            logger.info(
              `Opening image folder for icon: ${name}, path: ${filePath}`
            );
            const success = await window.electron.openInExplorer(
              "image",
              filePath
            );
            if (!success) {
              logger.error(`Failed to open image folder for icon: ${name}`);
            }
          } else {
            logger.warn(`No image path available for icon: ${name}`);
          }
          break;
        case "Program folder":
          if (programLink) {
            const success = await window.electron.openInExplorer(
              "programLink",
              programLink
            );
            if (!success) {
              logger.error(`Failed to open program folder for icon: ${name}`);
            }
          } else {
            logger.warn(`No program path available for icon: ${name}`);
          }
          logger.info(`Opening program folder for icon: ${name}`);

          break;
        default:
          logger.warn(`Unknown submenu option: ${option}`);
      }
    }
    setShowOpenSubmenu(false);
  };

  const isIconHighlighted = (row: number, col: number): boolean => {
    return (
      highlightBox.visible &&
      highlightBox.row === row &&
      highlightBox.col === col
    );
  };

  const adjustContextMenuPosition = () => {
    // Only run if context menu exists
    if (!contextMenuRef.current) return;

    const menuElement = contextMenuRef.current;
    const menuRect = menuElement.getBoundingClientRect();
    const headerHeight = document.querySelector("header")?.offsetHeight || 0;
    const viewportHeight = window.innerHeight - headerHeight;
    const viewportWidth = window.innerWidth;

    // Get current position from style
    const currentX = parseFloat(menuElement.style.left);
    const currentY = parseFloat(menuElement.style.top);

    // Adjust if needed to prevent overflow
    if (currentX + menuRect.width > viewportWidth) {
      menuElement.style.left = `${currentX - menuRect.width}px`;
    }

    if (currentY + menuRect.height > viewportHeight) {
      menuElement.style.top = `${currentY - menuRect.height}px`;
    }

    const submenuWidth = 120; // Approximate width submenu
    const shouldShowSubmenuLeft =
      currentX + menuRect.width + submenuWidth > viewportWidth;
    menuElement.setAttribute(
      "data-submenu-direction",
      shouldShowSubmenuLeft ? "left" : "right"
    );
  };

  useLayoutEffect(() => {
    if (contextMenu) {
      // Use requestAnimationFrame to ensure the menu is rendered
      requestAnimationFrame(adjustContextMenuPosition);
    }
  }, [contextMenu]);

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
                top:
                  rowIndex * (ICON_SIZE + ICON_VERTICAL_PADDING) +
                  ICON_ROOT_OFFSET_TOP,
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
                left:
                  colIndex * (ICON_SIZE + ICON_HORIZONTAL_PADDING) +
                  ICON_ROOT_OFFSET_LEFT,
                width: "1px",
                height: "100%",
                backgroundColor: "red",
              }}
            />
          ))}

        {/* Render highlight box if visible */}
        {highlightBox.visible && (
          <div
            className="highlight-box"
            style={{
              position: "absolute",
              left:
                highlightBox.col * (ICON_SIZE + ICON_HORIZONTAL_PADDING) +
                ICON_ROOT_OFFSET_LEFT,
              top:
                highlightBox.row * (ICON_SIZE + ICON_VERTICAL_PADDING) +
                ICON_ROOT_OFFSET_TOP,
              width: ICON_SIZE,
              height: ICON_SIZE + ICON_VERTICAL_PADDING,
            }}
          />
        )}

        {/* Render desktop icons */}
        {Array.from(iconsMap.values()).map((icon) => {
          const iconKey = `${icon.row},${icon.col}`;
          const reloadTimestamp = reloadTimestamps[iconKey] || 0;

          return (
            <div
              key={`${icon.row}-${icon.col}`}
              className="desktop-icon"
              style={{
                left:
                  icon.col * (ICON_SIZE + ICON_HORIZONTAL_PADDING) +
                  (icon.offsetX || 0) +
                  ICON_ROOT_OFFSET_LEFT,
                top:
                  icon.row * (ICON_SIZE + ICON_VERTICAL_PADDING) +
                  (icon.offsetY || 0) +
                  ICON_ROOT_OFFSET_TOP,
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
                width={icon.width}
                height={icon.height}
                highlighted={isIconHighlighted(icon.row, icon.col)}
                forceReload={reloadTimestamp} // Pass the reload timestamp
              />
              <div
                className="desktop-icon-name"
                style={{ color: icon.fontColor || "white" }}
              >
                {icon.name}
              </div>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            position: "absolute",
          }}
        >
          {contextMenu.type === "desktop" ? (
            <>
              <div className="menu-item" onClick={() => handleEditIcon()}>
                New Icon
              </div>
              <div className="menu-item">Settings</div>
              <div className="menu-item" onClick={handleReloadDesktop}>
                Reload Desktop
              </div>
              <div className="menu-item" onClick={toggleGrid}>
                {showGrid ? "✔ " : ""}Show Grid
              </div>
            </>
          ) : (
            <>
              <div
                className="menu-item"
                onClick={() =>
                  handleEditIcon(contextMenu.icon?.row, contextMenu.icon?.col)
                }
              >
                Edit {contextMenu.icon?.name}
              </div>
              <div
                className="menu-item has-submenu"
                onMouseEnter={() => setShowLaunchSubmenu(true)}
                onMouseLeave={() => setShowLaunchSubmenu(false)}
              >
                Launch
                <span className="submenu-arrow">▶</span>
                {showLaunchSubmenu && (
                  <div className="submenu">
                    <div
                      className="menu-item"
                      onClick={() => handleLaunchSubmenuClick("Program")}
                    >
                      Program
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => handleLaunchSubmenuClick("Website")}
                    >
                      Website
                    </div>
                  </div>
                )}
              </div>
              <div
                className="menu-item has-submenu"
                onMouseEnter={() => setShowOpenSubmenu(true)}
                onMouseLeave={() => setShowOpenSubmenu(false)}
              >
                Open
                <span className="submenu-arrow">▶</span>
                {showOpenSubmenu && (
                  <div className="submenu">
                    <div
                      className="menu-item"
                      onClick={() => handleOpenSubmenuClick("Image folder")}
                    >
                      Image folder
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => handleOpenSubmenuClick("Program folder")}
                    >
                      Program folder
                    </div>
                  </div>
                )}
              </div>
              <div className="menu-item" onClick={handleReloadIcon}>
                Reload Icon
              </div>
              <div className="menu-item" onClick={handleDeleteIcon}>
                Delete
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  // Visually, clicking the grid lines returns:
  // Vertical: Left ICON
  // Horizontal: Top ICON
  /**
   * Gets the row and column positions from the LOCAL to DesktopGrid (X, Y) coordinates.
   *
   * @param {x: number} x - The LOCAL to DesktopGrid X coordinate.
   * @param {y: number} y - The LOCAL to DesktopGrid Y coordinate.
   * @returns {[number, number]} - A tuple representing the valid row and column positions.
   */
  function getRowColFromXY(x: number, y: number): [number, number] {
    // Calculate the row and column based on the X,Y coordinates
    const calculatedRow = Math.floor(
      (y - ICON_ROOT_OFFSET_TOP - 1) / (ICON_SIZE + ICON_VERTICAL_PADDING)
    );
    const calculatedCol = Math.floor(
      (x - ICON_ROOT_OFFSET_LEFT - 1) / (ICON_SIZE + ICON_HORIZONTAL_PADDING)
    );

    const validRow = Math.max(0, Math.min(calculatedRow, numRows - 1));
    const validCol = Math.max(0, Math.min(calculatedCol, numCols - 1));
    return [validRow, validCol];
  }

  /**
   * Adjusts the Y coordinate based on the header height only.
   * Use this for global coordinate conversion to to desktop coordinates.
   *
   * @param {number} Y - The original Y coordinate.
   * @returns {number} - The adjusted Y coordinate adjusted for header height.
   */
  function headerAdjustY(Y: number): number {
    const headerHeight = document.querySelector("header")?.offsetHeight || 0;
    return Y - headerHeight;
  }
};

export default DesktopGrid;
