import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../App.css";
import "../styles/DesktopGrid.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SafeImage } from "./SafeImage";

const logger = createLogger("DesktopGrid.tsx");

interface ContextMenu {
  x: number;
  y: number;
  type: "desktop" | "icon" | "hideIcons";
  icon?: DesktopIcon | null;
}

interface HighlightPosition {
  row: number;
  col: number;
  visible: boolean;
  pulse: boolean;
}

interface IconReloadTimestamps {
  [key: string]: number;
}

const DesktopGrid: React.FC = () => {
  const [iconsMap, setIconsMap] = useState<Map<string, DesktopIcon>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showGrid, setShowGrid] = useState(false); // State to toggle grid visibility
  const [showIcons, setShowIcons] = useState(true); // State to toggle icons visibility
  const [showIconNames, setShowIconNames] = useState(true); // State to toggle icon names visibility
  const [showLaunchSubmenu, setShowLaunchSubmenu] = useState(false); // State for submenu visibility
  const [showOpenSubmenu, setShowOpenSubmenu] = useState(false); // State for submenu visibility
  const [highlightBox, setHighlightBox] = useState<HighlightPosition>({
    row: 0,
    col: 0,
    visible: false,
    pulse: false,
  });
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [reloadTimestamps, setReloadTimestamps] =
    useState<IconReloadTimestamps>({});
  const [defaultFontSize, setDefaultFontSize] = useState<number>(16);
  const [defaultIconSize, setDefaultIconSize] = useState<number>(64);
  const [defaultFontColor, setDefaultFontColor] = useState<string>("white");

  const [dimmerValue, setDimmerValue] = useState(50);
  const [allHighlightsDefault, setAllHighlightsDefault] = useState(true);
  const [allHighlightsOffset, setAllHighlightsOffset] = useState(true);
  const [allHighlightsOversized, setAllHighlightsOversized] = useState(true);
  const [allHighlightsBoth, setAllHighlightsBoth] = useState(true);

  const [backgroundType, setBackgroundType] = useState<string>("image");
  const [showVideoControls, setShowVideoControls] = useState<boolean>(false);

  // iconBox refers to the rectangular size (width) of the icon box, not the icon's size in pixels.
  const iconBox = defaultIconSize * 1.5625;

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

  const toggleIcons = () => {
    setShowIcons((prev) => !prev);
    setContextMenu(null);
    hideHighlightBox();
  };

  const toggleIconNames = () => {
    setShowIconNames((prev) => !prev);
    setContextMenu(null);
    hideHighlightBox();
  };

  const toggleGrid = () => {
    setShowGrid((prev) => !prev);
    setContextMenu(null);
    hideHighlightBox();
  };

  const toggleHighlightAllIcons = () => {
    setShowAllHighlights(!showAllHighlights);
    setContextMenu(null);
    hideHighlightBox();
  };

  /**
   * Shows a highlight box at the specified row and column position.
   *
   * @param {number} row - The row position for the highlight box.
   * @param {number} col - The column position for the highlight box.
   */
  const showHighlightAt = (row: number, col: number, pulse?: boolean) => {
    setHighlightBox({
      row,
      col,
      visible: true,
      pulse: pulse || false,
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
    } else {
      // remove icon from map
      setIconsMap((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.delete(iconKey);
        return newMap;
      });
    }

    logger.info(`Updated icon UI at [${row}, ${col}]`);
  };

  // Render the desktop grid on launch
  useEffect(() => {
    fetchIconSize();
    fetchFontSize();
    fetchIcons();
    fetchFontColor();
  }, []);

  const fetchFontSize = async (override?: number) => {
    try {
      const fontSize = await window.electron.getSetting("defaultFontSize");
      if (override) {
        setDefaultFontSize(override);
      } else if (fontSize === undefined) {
        setDefaultFontSize(16); // Fallback to 16 if no value is returned
      } else {
        setDefaultFontSize(fontSize);
      }
    } catch (error) {
      logger.error("Error fetching default font size:", error);
    }
  };
  const fetchIconSize = async (override?: number) => {
    try {
      let iconSize: number | undefined;
      if (override) {
        iconSize = override;
      } else {
        iconSize = await window.electron.getSetting("defaultIconSize");
      }
      setDefaultIconSize(iconSize ?? 64);
    } catch (error) {
      logger.error("Error fetching default icon size:", error);
    }
  };
  const fetchFontColor = async (override?: string) => {
    try {
      let color: string | undefined;
      if (override) {
        color = override;
      } else {
        color = await window.electron.getSetting("defaultFontColor");
      }
      setDefaultFontColor(color ?? "#FFFFFF");
    } catch (error) {
      logger.error("Error fetching default font color:", error);
    }
  };
  const fetchIcons = async () => {
    try {
      const data = await window.electron.getDesktopIconData();
      logger.info("Fetched icons");

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
    const handleReloadIcon = (
      _: Electron.IpcRendererEvent,
      { row, col, icon }: { row: number; col: number; icon: DesktopIcon }
    ) => {
      handleIpcReloadIcon(row, col, icon);
    };

    const handleHideHighlightBox = () => {
      console.log("Received 'hide-highlight' event from main process.");
      hideHighlightBox();
    };

    // Listen for the 'reload-icon' event
    window.electron.on(
      "reload-icon",
      handleReloadIcon as (...args: unknown[]) => void
    );

    // Listen for the 'hide-highlight' event
    window.electron.on("hide-highlight", handleHideHighlightBox);

    window.electron.on(
      "update-icon-preview",
      handlePreviewUpdate as (...args: unknown[]) => void
    );

    // Cleanup the event listeners on unmount
    return () => {
      window.electron.off(
        "reload-icon",
        handleReloadIcon as (...args: unknown[]) => void
      );
      window.electron.off("hide-highlight", handleHideHighlightBox);
      window.electron.off(
        "update-icon-preview",
        handlePreviewUpdate as (...args: unknown[]) => void
      );
    };
  }, []);

  useEffect(() => {
    const handleDesktopSetShowIcon = (
      _: Electron.IpcRendererEvent,
      showIcon: boolean
    ) => {
      logger.info("Received set-show-icons event:", showIcon);
      setShowIcons(showIcon);
      setShowIconNames(showIcon);
    };

    window.electron.on(
      "set-show-icons",
      handleDesktopSetShowIcon as (...args: unknown[]) => void
    );

    return () => {
      window.electron.off(
        "set-show-icons",
        handleDesktopSetShowIcon as (...args: unknown[]) => void
      );
    };
  }, []);

  const handleIconClick = (row: number, col: number) => {
    const icon = getIcon(row, col);
    if (!icon) {
      logger.info("Somehow clicked on an icon but also not on an icon...");
    }
  };

  const handleIconDoubleClick = async (row: number, col: number) => {
    if (iconsMap.get(`${row},${col}`)?.launchDefault === "website") {
      await window.electron.launchWebsite(row, col);
    } else {
      await window.electron.launchProgram(row, col);
    }
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

  const handleDesktopRightClick = async (e: React.MouseEvent) => {
    // If a subwindow is active, do not show the context menu
    if (await window.electron.getSubWindowTitle()) {
      logger.info(
        "Subwindow is open, nulled request for contextMenu (desktop click)."
      );
      return;
    }
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    // React.MouseEvent returns global coordinates, so we need to adjust them to local coordinates

    // Calculate the nearest grid slot
    const [validRow, validCol] = getRowColFromXY(x, y);
    showHighlightAt(validRow, validCol);

    // Check if an icon exists at the calculated row and column
    const existingIcon = getIcon(validRow, validCol);

    if (existingIcon && showIcons) {
      // If an icon exists, set the context menu to "icon" type
      setContextMenu({
        x,
        y,
        type: "icon",
        icon: existingIcon,
      });
      logger.info(
        `Desktop right click nearest icon exists at row: ${validRow}, col: ${validCol}`
      );
    } else {
      setContextMenu({
        x,
        y,
        type: showIcons ? "desktop" : "hideIcons",
        icon: null,
      });
      logger.info(
        "Desktop right click at icon slot at row: " +
          `${validRow}, col:${validCol}, type: ${showIcons ? "desktop" : "hideIcons"}`
      );
    }
  };

  const handleIconRightClick = async (
    e: React.MouseEvent,
    row: number,
    col: number
  ) => {
    // If a subwindow is active, do not show the context menu
    if (await window.electron.getSubWindowTitle()) {
      logger.info(
        "Subwindow is open, nulled request for contextMenu(Icon click)."
      );
      return;
    }
    e.stopPropagation();
    handleRightClick(e, "icon", row, col);
    showHighlightAt(row, col, true);

    logger.info(
      `Icon right click at row: ${row}, col: ${col} with icon name: ${iconsMap.get(`${row},${col}`)?.name}`
    );
  };

  const handleEditIcon = async (row?: number, col?: number) => {
    // If a subwindow is active, do not open a new one
    if (await window.electron.getSubWindowTitle()) {
      logger.info("Subwindow is already open, not opening a new one.");
      return;
    }
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
      const { name, row, col } = contextMenu.icon;

      try {
        const ret = await showSmallWindow(
          "Delete Icon",
          `Are you sure you want to delete the icon: ${name} \nat [${row}, ${col}]?`,
          ["Yes", "No"]
        );
        // Call the Electron API to delete the icon
        if (ret === "Yes") {
          await window.electron.deleteIcon(row, col);
          logger.info(`Deleted icon at [${row}, ${col}]`);
        } else {
          logger.info(
            `Icon deletion cancelled at [${row}, ${col}] ret = ${ret}`
          );
        }
      } catch (error) {
        logger.error(`Failed to delete icon at [${row}, ${col}]:`, error);
      }

      setContextMenu(null);
      hideHighlightBox();
      handleReloadIcon();
    }
  };

  useEffect(() => {
    const handlePreview = (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>; // Extract the second argument as updates
      if (updates["defaultFontColor"]) {
        fetchFontColor(updates["defaultFontColor"]);
      } else {
        logger.info("Received grid preview updates:", updates);
      }

      // Updates should be passed back one field at a time.
      if (updates["defaultIconSize"]) {
        fetchIconSize(updates["defaultIconSize"]);
      } else if (updates["defaultFontSize"]) {
        fetchFontSize(updates["defaultFontSize"]);
      }
    };

    window.electron.on("update-grid-preview", handlePreview);

    return () => {
      window.electron.off("update-grid-preview", handlePreview);
    };
  }, []);

  useEffect(() => {
    const handleReloadGrid = () => {
      // Re-fetch settings and icon data
      fetchFontSize();
      fetchIconSize();
      fetchIcons();
      fetchFontColor();
    };

    window.electron.on("reload-grid", handleReloadGrid);

    return () => {
      window.electron.off("reload-grid", handleReloadGrid);
    };
  }, []);
  const handleReloadDesktop = async () => {
    try {
      // Call the Electron API to reload the icon
      await window.electron.reloadWindow();
    } catch (error) {
      logger.error(`Failed to reload window`, error);
    }

    setContextMenu(null); // Close the context menu
  };

  const handleOpenSettings = async () => {
    try {
      setShowIcons(true);
      setShowIconNames(true);
      await window.electron.openSettings();
    } catch (error) {
      logger.error(`Failed to open settings`, error);
    }
    setContextMenu(null);
    hideHighlightBox();
  };
  const handleOpenBackgroundSelect = async () => {
    logger.info("clicked background context menu item");
    try {
      await window.electron.openBackgroundSelect();
    } catch (error) {
      logger.error(`Failed to open background select`, error);
    }
    setContextMenu(null);
    hideHighlightBox();
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
      const { row, col, name, programLink } = contextMenu.icon;
      let { image } = contextMenu.icon;

      switch (option) {
        case "Image folder": {
          // Set image to default so it opens [row,col] folder instead of the data folder.
          if (image === "") {
            image = "default.png";
          }
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
            await showSmallWindow(
              "Cannot resolve icon image path",
              `No image path available for icon: ${name} \nLocalPath: ${filePath}`,
              ["Okay"]
            );
          }
          break;
        }
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
    const viewportHeight = window.innerHeight;
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

  const handlePreviewUpdate = (
    _: Electron.IpcRendererEvent,
    {
      row,
      col,
      updates,
    }: { row: number; col: number; updates: Partial<DesktopIcon> }
  ) => {
    // Font color changes can be extremely frequent, so ignore them for logging.
    if (!updates["fontColor"]) {
      logger.info(
        `Received preview update for icon [${row}, ${col}], updates: ${JSON.stringify(updates)}`
      );
    }

    setIconsMap((prevMap) => {
      const newMap = new Map(prevMap);
      const key = `${row},${col}`;
      const currentIcon = prevMap.get(key);

      if (currentIcon) {
        // Merge updates into existing icon
        const updatedIcon = { ...currentIcon, ...updates };
        newMap.set(key, updatedIcon);

        if (updates.image) {
          setReloadTimestamps((prev) => ({
            ...prev,
            [key]: Date.now(),
          }));
        }
      } else {
        // Create a new temporary icon for preview
        const tempIcon: DesktopIcon = {
          row,
          col,
          name: updates.name || "",
          image: updates.image || "",
          fontColor: updates.fontColor || defaultFontColor,
          fontSize: updates.fontSize || 16,
          width: updates.width || defaultIconSize,
          height: updates.height || defaultIconSize,
          launchDefault: updates.launchDefault ?? "program",
          ...updates,
        };
        newMap.set(key, tempIcon);

        if (updates.image) {
          setReloadTimestamps((prev) => ({
            ...prev,
            [key]: Date.now(),
          }));
        }
      }

      return newMap;
    });
  };

  useLayoutEffect(() => {
    if (contextMenu) {
      // Use requestAnimationFrame to ensure the menu is rendered
      requestAnimationFrame(adjustContextMenuPosition);
    }
  }, [contextMenu]);

  useEffect(() => {
    const fetchBackgroundType = async () => {
      const type = await window.electron.getInfoFromID("", "fileType");
      if (type) {
        setBackgroundType(type);
      } else {
        setBackgroundType("image");
      }
    };
    fetchBackgroundType();

    window.electron.on("reload-background", fetchBackgroundType);
    return () => {
      window.electron.off("reload-background", fetchBackgroundType);
    };
  }, []);

  const handleShowVideoControls = async () => {
    await window.electron.showVideoControls(!showVideoControls);
    setShowVideoControls(!showVideoControls);
  };

  return (
    <>
      <div className="desktop-grid" onContextMenu={handleDesktopRightClick}>
        {/* Conditionally render horizontal grid lines */}
        {showGrid &&
          Array.from({ length: numRows + 1 }).map((_, rowIndex) => (
            <div
              key={`h-line-${rowIndex}`}
              style={{
                position: "absolute",
                top:
                  rowIndex * (iconBox + ICON_VERTICAL_PADDING) +
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
                  colIndex * (iconBox + ICON_HORIZONTAL_PADDING) +
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
            className={`highlight-box ${highlightBox.pulse ? "pulsing" : ""}`}
            style={{
              position: "absolute",
              left:
                highlightBox.col * (iconBox + ICON_HORIZONTAL_PADDING) +
                ICON_ROOT_OFFSET_LEFT,
              top:
                highlightBox.row * (iconBox + ICON_VERTICAL_PADDING) +
                ICON_ROOT_OFFSET_TOP,
              width: iconBox,
              height: iconBox + ICON_VERTICAL_PADDING,
            }}
          />
        )}

        {/* Render all icons as highlighted if enabled */}
        {showAllHighlights &&
          Array.from(iconsMap.values()).map((icon) => {
            // Calculate Icon home position
            const homeLeft =
              icon.col * (iconBox + ICON_HORIZONTAL_PADDING) +
              ICON_ROOT_OFFSET_LEFT;
            const homeTop =
              icon.row * (iconBox + ICON_VERTICAL_PADDING) +
              ICON_ROOT_OFFSET_TOP;

            // Actual position of icon
            const actualLeft =
              icon.col * (iconBox + ICON_HORIZONTAL_PADDING) +
              (icon.offsetX || 0) +
              ICON_ROOT_OFFSET_LEFT;
            const actualTop =
              icon.row * (iconBox + ICON_VERTICAL_PADDING) +
              (icon.offsetY || 0) +
              ICON_ROOT_OFFSET_TOP;

            const hasOffset =
              (icon.offsetX ?? 0) !== 0 || (icon.offsetY ?? 0) !== 0;
            const isOversized =
              (icon.width || defaultIconSize) > iconBox ||
              (icon.height || defaultIconSize) > iconBox;

            // Determine which highlight to show
            let showHighlight = false;
            if (hasOffset && isOversized) {
              showHighlight = allHighlightsBoth;
            } else if (hasOffset) {
              showHighlight = allHighlightsOffset;
            } else if (isOversized) {
              showHighlight = allHighlightsOversized;
            } else {
              showHighlight = allHighlightsDefault;
            }

            // Color logic
            let borderColor = "#2196f3";
            let backgroundColor = "rgba(33,150,243,0.1)";

            if (hasOffset && isOversized) {
              borderColor = "#9e170dff";
              backgroundColor = "rgba(158,23,13,0.25)";
            } else if (hasOffset) {
              borderColor = "#ff5722";
              backgroundColor = "rgba(255,87,34,0.25)";
            } else if (isOversized) {
              borderColor = "#be8900ff";
              backgroundColor = "rgba(190,137,0,0.25)";
            }

            const iconWidth = icon.width || defaultIconSize;
            const iconHeight = icon.height || defaultIconSize;

            return (
              <React.Fragment key={`multi-highlight-${icon.row}-${icon.col}`}>
                {showHighlight && (
                  <>
                    {/* Home box */}
                    <div
                      className={
                        hasOffset && isOversized
                          ? "multi-highlight-home-box offset-oversized"
                          : hasOffset
                            ? "multi-highlight-home-box offset"
                            : isOversized
                              ? "multi-highlight-home-box oversized"
                              : "multi-highlight-home-box default"
                      }
                      style={{
                        left: homeLeft,
                        top: homeTop,
                        width: iconBox,
                        height: iconBox + ICON_VERTICAL_PADDING,
                        border: `2px dashed ${borderColor}`,
                        background: backgroundColor,
                      }}
                      title={
                        hasOffset && isOversized
                          ? "Icon home: offset and oversized"
                          : hasOffset
                            ? "Icon home: offset"
                            : isOversized
                              ? "Icon home: oversized"
                              : "Icon home: default position/size"
                      }
                    />
                    {/* Label */}
                    <div
                      className="multi-highlight-home-label"
                      style={{
                        left: homeLeft + 10,
                        top: homeTop + 10,
                        backgroundColor: borderColor,
                        border: `2px solid ${borderColor}`,
                        maxWidth: iconBox - 20,
                        maxHeight: iconBox - 20,
                      }}
                    >
                      {icon.name}
                    </div>
                    {/* Highlight the actual icon position */}
                    <div
                      className="multi-highlight-box"
                      style={{
                        left: actualLeft,
                        top: actualTop,
                        width: iconWidth,
                        height: iconHeight,
                        border: `2px solid ${borderColor}`,
                        background: backgroundColor,
                      }}
                      title={
                        hasOffset && isOversized
                          ? "Icon is offset and oversized"
                          : hasOffset
                            ? "Icon is offset"
                            : isOversized
                              ? "Icon is oversized"
                              : "Icon in default position/size"
                      }
                    />
                  </>
                )}
              </React.Fragment>
            );
          })}

        {/* Render desktop icons */}
        {showIcons &&
          Array.from(iconsMap.values()).map((icon) => {
            const iconKey = `${icon.row},${icon.col}`;
            const reloadTimestamp = reloadTimestamps[iconKey] || 0;

            return (
              <div
                key={`${icon.row}-${icon.col}`}
                className="desktop-icon"
                style={{
                  left:
                    icon.col * (iconBox + ICON_HORIZONTAL_PADDING) +
                    (icon.offsetX || 0) +
                    ICON_ROOT_OFFSET_LEFT,
                  top:
                    icon.row * (iconBox + ICON_VERTICAL_PADDING) +
                    (icon.offsetY || 0) +
                    ICON_ROOT_OFFSET_TOP,
                  width: icon.width || defaultIconSize,
                  height: icon.height || defaultIconSize,
                }}
                onClick={() => handleIconClick(icon.row, icon.col)}
                onDoubleClick={() => handleIconDoubleClick(icon.row, icon.col)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  handleIconRightClick(e, icon.row, icon.col);
                }}
              >
                <SafeImage
                  row={icon.row}
                  col={icon.col}
                  imagePath={icon.image}
                  width={icon.width || defaultIconSize}
                  height={icon.height || defaultIconSize}
                  highlighted={isIconHighlighted(icon.row, icon.col)}
                  forceReload={reloadTimestamp}
                />
                {icon.fontSize !== 0 &&
                  showIconNames &&
                  (icon.fontSize || defaultFontSize) !== 0 && (
                    <div
                      className="desktop-icon-name"
                      title={icon.name}
                      style={
                        {
                          color: icon.fontColor || defaultFontColor,
                          fontSize: icon.fontSize || defaultFontSize,
                          "--line-clamp": Math.max(
                            1,
                            Math.floor(48 / (icon.fontSize || defaultFontSize))
                          ),
                        } as React.CSSProperties
                      }
                    >
                      {icon.name}
                    </div>
                  )}
              </div>
            );
          })}

        {showAllHighlights && (
          <div className="show-all-highlights-legend">
            <span className="show-all-highlights-legend-item">
              <input
                type="checkbox"
                checked={allHighlightsDefault}
                onChange={() => setAllHighlightsDefault(!allHighlightsDefault)}
                style={{ display: "none" }}
                id="legend-default"
              />
              <label htmlFor="legend-default" style={{ cursor: "pointer" }}>
                {allHighlightsDefault ? (
                  <span className="show-all-highlights-legend-circle default" />
                ) : (
                  <span className="show-all-highlights-legend-circle legend-x" />
                )}
                Default
              </label>
            </span>
            <span className="show-all-highlights-legend-item">
              <input
                type="checkbox"
                checked={allHighlightsOffset}
                onChange={() => setAllHighlightsOffset(!allHighlightsOffset)}
                style={{ display: "none" }}
                id="legend-offset"
              />
              <label htmlFor="legend-offset" style={{ cursor: "pointer" }}>
                {allHighlightsOffset ? (
                  <span className="show-all-highlights-legend-circle offset" />
                ) : (
                  <span className="show-all-highlights-legend-circle legend-x" />
                )}
                Offset
              </label>
            </span>
            <span className="show-all-highlights-legend-item">
              <input
                type="checkbox"
                checked={allHighlightsOversized}
                onChange={() =>
                  setAllHighlightsOversized(!allHighlightsOversized)
                }
                style={{ display: "none" }}
                id="legend-oversized"
              />
              <label htmlFor="legend-oversized" style={{ cursor: "pointer" }}>
                {allHighlightsOversized ? (
                  <span className="show-all-highlights-legend-circle oversized" />
                ) : (
                  <span className="show-all-highlights-legend-circle legend-x" />
                )}
                Oversized
              </label>
            </span>
            <span className="show-all-highlights-legend-item">
              <input
                type="checkbox"
                checked={allHighlightsBoth}
                onChange={() => setAllHighlightsBoth(!allHighlightsBoth)}
                style={{ display: "none" }}
                id="legend-both"
              />
              <label htmlFor="legend-both" style={{ cursor: "pointer" }}>
                {allHighlightsBoth ? (
                  <span className="show-all-highlights-legend-circle offset-oversized" />
                ) : (
                  <span className="show-all-highlights-legend-circle legend-x" />
                )}
                Offset & Oversized
              </label>
            </span>
            <span className={`show-all-highlights-legend-item`}>
              <label htmlFor="dimmer-slider">Dim Background</label>
              <input
                id="dimmer-slider"
                type="range"
                min={0}
                max={100}
                value={dimmerValue}
                onChange={(e) => setDimmerValue(Number(e.target.value))}
                style={{ verticalAlign: "middle" }}
              />
            </span>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          {contextMenu.type === "desktop" && (
            <>
              <div className="menu-item" onClick={() => handleEditIcon()}>
                New Icon
              </div>
              <div className="menu-separator" />
              <div className="menu-item" onClick={handleOpenBackgroundSelect}>
                Change Background
              </div>
              <div className="menu-item" onClick={handleOpenSettings}>
                Settings
              </div>
              <div className="menu-separator" />
              <label className="menu-checkbox">
                Show Icons
                <input
                  type="checkbox"
                  checked={showIcons}
                  onChange={toggleIcons}
                />
              </label>
              <label className="menu-checkbox">
                Show Icon Names
                <input
                  type="checkbox"
                  checked={showIconNames}
                  onChange={toggleIconNames}
                />
              </label>
              <div
                className="menu-item has-submenu"
                onMouseEnter={() => setShowOpenSubmenu(true)}
                onMouseLeave={() => setShowOpenSubmenu(false)}
              >
                Display
                <span className="submenu-arrow">▶</span>
                {showOpenSubmenu && (
                  <div className="submenu">
                    <label className="menu-checkbox">
                      Grid
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={toggleGrid}
                      />
                    </label>
                    <label className="menu-checkbox">
                      All icon boxes
                      <input
                        type="checkbox"
                        checked={showAllHighlights}
                        onChange={toggleHighlightAllIcons}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="menu-separator" />
              {backgroundType.startsWith("video") && (
                <label className="menu-checkbox">
                  Show Video Controls
                  <input
                    type="checkbox"
                    checked={showVideoControls}
                    onChange={handleShowVideoControls}
                  />
                </label>
              )}
              <div className="menu-item" onClick={handleReloadDesktop}>
                Reload Desktop
              </div>
            </>
          )}
          {contextMenu.type === "hideIcons" && (
            <>
              <label className="menu-checkbox">
                Show Icons
                <input
                  type="checkbox"
                  checked={showIcons}
                  onChange={toggleIcons}
                />
              </label>
              <div className="menu-separator" />
              <div className="menu-item" onClick={handleOpenBackgroundSelect}>
                Change Background
              </div>
              <div className="menu-item" onClick={handleOpenSettings}>
                Settings
              </div>
              <div className="menu-separator" />
              <div
                className="menu-item has-submenu"
                onMouseEnter={() => setShowOpenSubmenu(true)}
                onMouseLeave={() => setShowOpenSubmenu(false)}
              >
                Display
                <span className="submenu-arrow">▶</span>
                {showOpenSubmenu && (
                  <div className="submenu">
                    <label className="menu-checkbox">
                      Grid
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={toggleGrid}
                      />
                    </label>
                    <label className="menu-checkbox">
                      All icon boxes
                      <input
                        type="checkbox"
                        checked={showAllHighlights}
                        onChange={toggleHighlightAllIcons}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="menu-separator" />
              <div className="menu-item" onClick={handleReloadDesktop}>
                Reload Desktop
              </div>
            </>
          )}
          {contextMenu.type === "icon" && (
            <>
              <div
                className="menu-item"
                onClick={() =>
                  handleEditIcon(contextMenu.icon?.row, contextMenu.icon?.col)
                }
              >
                Edit {contextMenu.icon?.name}
              </div>
              <div className="menu-separator" />
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
              <div className="menu-separator" />
              <div className="menu-item" onClick={handleDeleteIcon}>
                Delete
              </div>
            </>
          )}
        </div>
      )}

      {showAllHighlights && (
        <div
          className="background-dimmer"
          style={{ background: `rgba(0,0,0,${dimmerValue / 100})` }}
        />
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
      (y - ICON_ROOT_OFFSET_TOP - 1) / (iconBox + ICON_VERTICAL_PADDING)
    );
    const calculatedCol = Math.floor(
      (x - ICON_ROOT_OFFSET_LEFT - 1) / (iconBox + ICON_HORIZONTAL_PADDING)
    );

    const validRow = Math.max(0, Math.min(calculatedRow, numRows - 1));
    const validCol = Math.max(0, Math.min(calculatedCol, numCols - 1));
    return [validRow, validCol];
  }
};
export default DesktopGrid;
