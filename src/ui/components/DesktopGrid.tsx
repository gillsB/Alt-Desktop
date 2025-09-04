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
  [key: string]: number; // now keyed by icon id
}

const DesktopGrid: React.FC = () => {
  // Primary map: keyed by icon id
  const [iconsById, setIconsById] = useState<Map<string, DesktopIcon>>(
    new Map()
  );
  // Secondary index: keyed by "row,col" -> icon id (placement map)
  const [posIndex, setPosIndex] = useState<Map<string, string>>(new Map());

  const [profile, setProfile] = useState<string>("default");
  const profileRef = useRef(profile);

  const posKey = (row: number, col: number) => `${row},${col}`;

  const posIndexRef = useRef(posIndex);
  useEffect(() => {
    posIndexRef.current = posIndex;
  }, [posIndex]);

  const iconsByIdRef = useRef(iconsById);
  useEffect(() => {
    iconsByIdRef.current = iconsById;
  }, [iconsById]);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showGrid, setShowGrid] = useState(false); // State to toggle grid visibility
  const [hideIcons, setHideIcons] = useState(false); // State to toggle icons visibility
  const [hideIconNames, setHideIconNames] = useState(false); // State to toggle icon names visibility
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

  const lastHoverKeyRef = useRef<string>("");

  const [draggedIcon, setDraggedIcon] = useState<{
    icon: DesktopIcon;
    startRow: number;
    startCol: number;
  } | null>(null);

  const [swapPreview, setSwapPreview] = useState<{
    icon: DesktopIcon;
    row: number;
    col: number;
  } | null>(null);

  useEffect(() => {
    const fetchRendererStates = async () => {
      const rendererStates = await window.electron.getRendererStates();
      setHideIcons(rendererStates.hideIcons || false);
      setHideIconNames(rendererStates.hideIconNames || false);
      setShowVideoControls(rendererStates.showVideoControls || false);
      setProfile(rendererStates.profile || "");
    };
    fetchRendererStates();
  }, []);

  useEffect(() => {
    const updateStates = (...args: unknown[]) => {
      const state = args[1] as Partial<RendererStates>;
      if ("showVideoControls" in state) {
        setShowVideoControls(!!state.showVideoControls);
      }
      if ("hideIcons" in state) {
        setHideIcons(!!state.hideIcons);
      }
      if ("hideIconNames" in state) {
        setHideIconNames(!!state.hideIconNames);
      }
      if ("profile" in state) {
        setProfile(state.profile || "default");
        profileRef.current = state.profile || "default";
      }
    };
    window.electron.on("renderer-state-updated", updateStates);
    return () => {
      window.electron.off("renderer-state-updated", updateStates);
    };
  }, []);

  const toggleIcons = () => {
    // Always show icon names when toggled (only shows when icons show). So restoring icons shows names.
    window.electron.setRendererStates({
      hideIcons: !hideIcons,
      hideIconNames: false,
    });
    setContextMenu(null);
    hideHighlightBox();
  };

  const toggleIconNames = () => {
    window.electron.setRendererStates({
      hideIconNames: !hideIconNames,
    });
    setContextMenu(null);
    hideHighlightBox();
  };

  const handleShowVideoControls = async () => {
    await window.electron.setRendererStates({
      showVideoControls: !showVideoControls,
    });
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

  const getIcon = (row: number, col: number): DesktopIcon | undefined => {
    const id = posIndex.get(posKey(row, col));
    return id ? iconsById.get(id) : undefined;
  };

  // Helper to set/update an icon and its placement while keeping both maps in sync
  const setIconAndPlacement = (icon: DesktopIcon) => {
    const id = icon.id;
    const key = posKey(icon.row, icon.col);

    // Update iconsById and posIndex together
    setIconsById((prevIcons) => {
      const newIcons = new Map(prevIcons);
      // Ensure icon stored has the authoritative row/col
      newIcons.set(id, { ...icon });

      // Update posIndex inside the same update cycle to keep them in sync
      setPosIndex((prevPos) => {
        const newPos = new Map(prevPos);
        // remove any previous mapping for this id
        for (const [k, v] of prevPos) {
          if (v === id && k !== key) {
            newPos.delete(k);
          }
        }
        // Set the new position -> id mapping
        newPos.set(key, id);
        return newPos;
      });

      return newIcons;
    });
  };

  // Helper to fully remove an icon (used when user chooses Delete)
  const removeIconCompletely = (id: string) => {
    setIconsById((prev) => {
      const newIcons = new Map(prev);
      newIcons.delete(id);
      // remove pos entries pointing to this id
      setPosIndex((prevPos) => {
        const newPos = new Map(prevPos);
        for (const [k, v] of prevPos) {
          if (v === id) newPos.delete(k);
        }
        return newPos;
      });
      return newIcons;
    });
  };

  const handleIpcReloadIcon = (id: string, updatedIcon: DesktopIcon | null) => {
    // Force image reload with new timestamp (keyed by id if available)
    if (updatedIcon && updatedIcon.id) {
      // ensure the id matches
      const iconId = updatedIcon.id;
      setIconAndPlacement(updatedIcon);

      // force image reload for this id
      setReloadTimestamps((prev) => ({ ...prev, [iconId]: Date.now() }));

      logger.info(
        `IPC reload: updated icon id=${iconId} placed at [${updatedIcon.row}, ${updatedIcon.col}]`
      );
      return;
    }
    // No updated icon -> remove placement at that position but keep icon data
    if (id) {
      setPosIndex((prev) => {
        const newPos = new Map(prev);
        for (const [k, v] of prev) {
          if (v === id) newPos.delete(k);
        }
        return newPos;
      });

      logger.warn(
        `IPC reload: no icon data for id=${id}. Cleared placement entries referencing this id.`
      );
    } else {
      logger.warn("IPC reload: received null id or no id in payload.");
    }
  };

  // Render the desktop grid on launch
  useEffect(() => {
    fetchIconSize();
    fetchFontSize();
    fetchIcons(true);
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
  const fetchIcons = async (ensureProfile: boolean = false) => {
    logger.info("fetchIcons called with profile = " + profileRef.current);
    try {
      // Only ensure the profile folder on mount/reload
      if (ensureProfile) {
        const success = await window.electron.ensureProfileFolder(
          profileRef.current
        );
        if (!success) {
          logger.error(
            `Failed to create profile folder for ${profileRef.current}`
          );
          return;
        }
      }
      const data = await window.electron.getDesktopIconData();
      logger.info("profile fetched = " + JSON.stringify(data));

      // Create an array of promises for ensuring folders
      const folderPromises = data.icons.map(async (icon: DesktopIcon) => {
        // Ensure data folder exists for each icon
        const success = await window.electron.ensureDataFolder(icon.id);
        if (!success) {
          logger.warn(`Failed to create data folder for icon id=${icon.id}`);
        }
        return icon;
      });

      // Wait for all folder creation promises to resolve
      const processedIcons = await Promise.all(folderPromises);

      const idMap = new Map<string, DesktopIcon>();
      const posMap = new Map<string, string>();

      processedIcons.forEach((icon: DesktopIcon) => {
        idMap.set(icon.id, icon);
        posMap.set(posKey(icon.row, icon.col), icon.id);
      });

      setIconsById(idMap);
      setPosIndex(posMap);
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
      payload: { id: string; icon: DesktopIcon | null }
    ) => {
      const { id, icon } = payload;
      // Delegate to shared helper that updates React state
      handleIpcReloadIcon(id, icon);
    };

    const handleHideHighlightBox = () => {
      hideHighlightBox();
    };

    // Listen for the 'reload-icon' event
    window.electron.on(
      "reload-icon",
      handleReloadIcon as (...a: unknown[]) => void
    );

    // Listen for the 'hide-highlight' event
    window.electron.on("hide-highlight", handleHideHighlightBox);

    window.electron.on(
      "update-icon-preview",
      handlePreviewUpdate as (...a: unknown[]) => void
    );

    // Cleanup the event listeners on unmount
    return () => {
      window.electron.off(
        "reload-icon",
        handleReloadIcon as (...a: unknown[]) => void
      );
      window.electron.off("hide-highlight", handleHideHighlightBox);
      window.electron.off(
        "update-icon-preview",
        handlePreviewUpdate as (...a: unknown[]) => void
      );
    };
  }, []);

  const handleIconDoubleClick = async (icon: DesktopIcon) => {
    if (icon.launchDefault === "program") {
      await window.electron.launchProgram(icon.id);
    } else {
      await window.electron.launchWebsite(icon.id);
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
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    // React.MouseEvent returns global coordinates, so we need to adjust them to local coordinates

    // Calculate the nearest grid slot
    const [validRow, validCol] = getRowColFromXY(x, y);
    showHighlightAt(validRow, validCol);

    // Check if an icon exists at the calculated row and column
    const existingIcon = getIcon(validRow, validCol);

    if (existingIcon && !hideIcons) {
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
        type: hideIcons ? "hideIcons" : "desktop",
        icon: null,
      });
      logger.info(
        `Desktop right click at icon: ${existingIcon?.name} slot at row: ` +
          `${validRow}, col:${validCol}, type: ${hideIcons ? "hideIcons" : "desktop"}`
      );
    }
  };

  const handleIconRightClick = async (
    e: React.MouseEvent,
    row: number,
    col: number
  ) => {
    // If a subwindow is active, do not show the context menu
    e.stopPropagation();
    handleRightClick(e, "icon", row, col);
    showHighlightAt(row, col, true);

    logger.info(
      `Icon right click: ${getIcon(row, col)?.id} at row: ${row}, col: ${col} with icon name: ${getIcon(row, col)?.name}`
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
      const icon = getIcon(row, col);
      if (icon) {
        window.electron.ensureDataFolder(icon.id);
        window.electron.editIcon(icon.id, row, col);
        await window.electron.setRendererStates({ hideIconNames: false });
        setContextMenu(null);
      } else {
        showSmallWindow(
          "Error getting icon",
          `Error getting icon for [${row},${col}]`,
          ["Okay"]
        );
      }

      return;
    }

    // Fallback to contextMenu logic if row and col are not provided
    if (contextMenu) {
      const { x, y } = contextMenu;
      // contextMenu returns local coordinates. Which getRowColFromXY expects.
      const [validRow, validCol] = getRowColFromXY(x, y);

      const icon = getIcon(validRow, validCol);
      if (icon) {
        window.electron.ensureDataFolder(icon.id);
        window.electron.editIcon(icon.id, validRow, validCol);
        setContextMenu(null);
      } else {
        const temp_id = await window.electron.ensureUniqueIconId("temp");
        if (temp_id) {
          window.electron.ensureDataFolder(temp_id);
          window.electron.editIcon(temp_id, validRow, validCol);
          setContextMenu(null);
        } else {
          showSmallWindow(
            "Error getting temp_id",
            `Error after fallback temp id from contextMenu for [${validRow},${validCol}]`,
            ["Okay"]
          );
        }
      }
    } else {
      logger.error("Tried to edit an icon, but contextMenu was null.");
      setContextMenu(null);
    }
  };

  const handleReloadIcon = async () => {
    if (!contextMenu?.icon) return;

    const { id, row, col } = contextMenu.icon;

    try {
      // Call the Electron API to reload the icon by id
      const ret: boolean = await window.electron.reloadIcon(id);

      if (!ret) {
        logger.info(
          `Icon reload returned false for id=${id} (previously at [${row}, ${col}]). ` +
            `Removing any placement mappings that reference this id.`
        );

        // Remove any posIndex entries that reference this id (keep icon data)
        setPosIndex((prevMap) => {
          const newMap = new Map(prevMap);
          for (const [k, v] of prevMap) {
            if (v === id) newMap.delete(k);
          }
          return newMap;
        });
      } else {
        // Successful reload — update reload timestamp for UI image refresh
        setReloadTimestamps((prev) => ({ ...prev, [id]: Date.now() }));
      }
    } catch (error) {
      logger.error(
        `Failed to reload icon id=${id} at [${row}, ${col}]:`,
        error
      );
    }

    setContextMenu(null);
    hideHighlightBox();
  };

  const handleDeleteIcon = async () => {
    if (contextMenu?.icon) {
      const { name, row, col, id } = contextMenu.icon;

      try {
        const ret = await showSmallWindow(
          "Delete Icon",
          `Are you sure you want to delete the icon: ${name} \nat [${row}, ${col}]?`,
          ["Yes", "No"]
        );
        // Call the Electron API to delete the icon
        if (ret === "Yes") {
          await window.electron.deleteIcon(id);
          // remove fully from both maps
          removeIconCompletely(id);
          logger.info(`Deleted icon id=${id} at [${row}, ${col}]`);
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
      fetchIcons(true);
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
    const title = await window.electron.getSubWindowTitle();
    if (title) {
      logger.info(`Not opening settings as subWindow: ${title} already open.`);
      return;
    }
    try {
      await window.electron.openSettings();
    } catch (error) {
      logger.error(`Failed to open settings`, error);
    }
    setContextMenu(null);
    hideHighlightBox();
  };
  const handleOpenBackgroundSelect = async () => {
    const title = await window.electron.getSubWindowTitle();
    if (title) {
      logger.info(`Not opening settings as subWindow: ${title} already open.`);
      return;
    }
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
      const icon = getIcon(row, col);
      if (!icon) {
        logger.error(`LaunchSubmenuClick: No icon at [${row},${col}]`);
        return;
      }
      switch (option) {
        case "Program": {
          logger.info(`Running program for icon: ${name}`);
          await window.electron.launchProgram(icon.id);
          break;
        }
        case "Website": {
          logger.info(`Opening website for icon: ${name}`);
          await window.electron.launchWebsite(icon.id);
          break;
        }
        default:
          logger.warn(`Unknown submenu option: ${option}`);
      }
    }
    setShowLaunchSubmenu(false);
  };

  const handleOpenSubmenuClick = async (option: string) => {
    if (contextMenu?.icon) {
      const { row, col, name, programLink } = contextMenu.icon;
      const icon = getIcon(row, col);
      let { image } = contextMenu.icon;
      if (!icon) {
        logger.error(`OpenSubMenuClick failed to get icon from: ${row},${col}`);
        return;
      }

      switch (option) {
        case "Image folder": {
          // Set image to default so it opens data/id folder instead of just the data folder.
          if (image === "") {
            image = "default.png";
          }
          const filePath = `data/${icon.id}/${image}`;
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
    _: Electron.IpcRendererEvent | null,
    {
      id,
      row,
      col,
      updates,
    }: { id: string; row: number; col: number; updates: Partial<DesktopIcon> }
  ) => {
    // Font color changes can be extremely frequent, so ignore them for logging.
    if (!updates["fontColor"]) {
      logger.info(
        `Received preview update for icon ${id}: [${row}, ${col}], updates: ${JSON.stringify(
          updates
        )}`
      );
    }

    setIconsById((prevMap) => {
      const newMap = new Map(prevMap);
      const currentIcon = prevMap.get(id);

      if (currentIcon) {
        const updatedIcon = { ...currentIcon, ...updates } as DesktopIcon;
        // Ensure row/col on the icon match the placement provided by the update
        if (typeof row === "number" && typeof col === "number") {
          updatedIcon.row = row;
          updatedIcon.col = col;
        }
        newMap.set(id, updatedIcon);

        // Keep placement mapping in sync
        setPosIndex((prevPos) => {
          const newPos = new Map(prevPos);
          // remove old placements for this id
          for (const [k, v] of prevPos) {
            if (v === id && k !== posKey(updatedIcon.row, updatedIcon.col)) {
              newPos.delete(k);
            }
          }
          // set new placement
          newPos.set(posKey(updatedIcon.row, updatedIcon.col), id);
          return newPos;
        });

        if (updates.image) {
          setReloadTimestamps((prev) => ({ ...prev, [id]: Date.now() }));
        }
      } else {
        // Create a new temporary icon for preview
        const tempIcon: DesktopIcon = {
          id,
          row,
          col,
          name: (updates.name as string) || "",
          image: (updates.image as string) || "",
          fontColor: (updates.fontColor as string) || defaultFontColor,
          fontSize: (updates.fontSize as number) || 16,
          width: (updates.width as number) || defaultIconSize,
          height: (updates.height as number) || defaultIconSize,
          launchDefault: updates.launchDefault ?? "program",
          ...updates,
        };

        newMap.set(id, tempIcon);

        // Sync placement mapping
        setPosIndex((prevPos) => {
          const newPos = new Map(prevPos);
          // clear any previous mapping for this id (very unlikely)
          for (const [k, v] of prevPos) {
            if (v === id) newPos.delete(k);
          }
          newPos.set(posKey(row, col), id);
          return newPos;
        });

        if (updates.image) {
          setReloadTimestamps((prev) => ({ ...prev, [id]: Date.now() }));
        }

        logger.info("tempID = ", tempIcon.id);
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
    logger.info("profile changed to: " + profile);
    profileRef.current = profile;
    fetchIcons();
  }, [profile]);

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

  const handleDragStart = (
    e: React.DragEvent,
    icon: DesktopIcon,
    row: number,
    col: number
  ) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedIcon({ icon, startRow: row, startCol: col });

    // Create an empty div element to completely hide the drag image
    const emptyDiv = document.createElement("div");
    emptyDiv.style.width = "1px";
    emptyDiv.style.height = "1px";
    emptyDiv.style.backgroundColor = "transparent";
    document.body.appendChild(emptyDiv);

    e.dataTransfer.setDragImage(emptyDiv, 0, 0);

    // Remove the element after a short delay
    setTimeout(() => document.body.removeChild(emptyDiv), 0);

    logger.info(`Started dragging icon: ${icon.name} from [${row}, ${col}]`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!draggedIcon) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const { clientX: x, clientY: y } = e;
    const [hoverRow, hoverCol] = getRowColFromXY(x, y);

    const currentHoverKey = `${hoverRow},${hoverCol}`;
    if (currentHoverKey === lastHoverKeyRef.current) {
      return; // No change in position, skip all updates
    }

    // Update the last hover position to this position
    lastHoverKeyRef.current = currentHoverKey;

    showHighlightAt(hoverRow, hoverCol);

    // Check if there's an icon at the hover position
    const existingIcon = getIcon(hoverRow, hoverCol);

    // Always reload old preview to reset it
    if (swapPreview) {
      window.electron.reloadIcon(swapPreview.icon.id);
    }

    // setSwapPreview if drag is hovering over a different icon (ignore home position)
    if (
      existingIcon &&
      (hoverRow !== draggedIcon.startRow || hoverCol !== draggedIcon.startCol)
    ) {
      // Show swap preview - existing icon moves to dragged icon's original position
      const existingIconData = {
        id: existingIcon.id,
        row: draggedIcon.startRow,
        col: draggedIcon.startCol,
        updates: { ...existingIcon },
      };
      handlePreviewUpdate(null, existingIconData);

      setSwapPreview({
        icon: existingIcon,
        row: draggedIcon.startRow,
        col: draggedIcon.startCol,
      });
    } else {
      // Clear swap preview if not hovering over another icon (or hovering over home icon)
      setSwapPreview(null);
    }

    // Set drag preview for the dragged icon to appear in hovered
    const updateData = {
      id: draggedIcon.icon.id,
      row: hoverRow,
      col: hoverCol,
      updates: { row: hoverRow, col: hoverCol }, // Only pass the position changes
    };
    handlePreviewUpdate(null, updateData);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedIcon) return;

    const { clientX: x, clientY: y } = e;
    const [dropRow, dropCol] = getRowColFromXY(x, y);

    // Check if dropping on existing icon
    const existingIcon = swapPreview?.icon;
    logger.info(
      `existingIcon = ${existingIcon?.id}, draggedIcon = ${draggedIcon.icon.id}`
    );
    if (existingIcon && existingIcon.id !== draggedIcon.icon.id) {
      logger.info(
        `Dropping on existing icon: ${existingIcon.name} at [${dropRow}, ${dropCol}]`
      );
      window.electron.swapDesktopIcons(draggedIcon.icon.id, existingIcon.id);
      window.electron.reloadIcon(draggedIcon.icon.id);
      window.electron.reloadIcon(existingIcon.id);
    } else {
      // Only move if position actually changed
      if (
        dropRow !== draggedIcon.startRow ||
        dropCol !== draggedIcon.startCol
      ) {
        logger.info(
          `Dropping icon: ${draggedIcon.icon.name} at [${dropRow}, ${dropCol}]`
        );

        window.electron.moveDesktopIcon(
          draggedIcon.icon.id,
          dropRow,
          dropCol,
          true
        );
        window.electron.reloadIcon(draggedIcon.icon.id);
      }
    }

    resetDragStates();
  };
  const handleDragEnd = () => {
    resetDragStates();
  };

  const resetDragStates = () => {
    setDraggedIcon(null);
    setSwapPreview(null);
    hideHighlightBox();
    lastHoverKeyRef.current = "";
  };

  // TODO add drag ctrl modifier which allows freely moving icons, syncs it to nearest icon home,
  // and when dropping saves it with the offsetX/Y values.

  return (
    <>
      <div
        className="desktop-grid"
        onContextMenu={handleDesktopRightClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
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
          Array.from(iconsById.values()).map((icon) => {
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
              <React.Fragment
                key={`multi-highlight-${icon.id}-${icon.row}-${icon.col}`}
              >
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

        {/* Render icons by reading the placement map (posIndex) */}
        {!hideIcons &&
          Array.from(posIndex.entries()).map(([pos, id]) => {
            const parts = pos.split(",");
            const row = Number(parts[0]);
            const col = Number(parts[1]);
            const icon = iconsById.get(id);
            if (!icon) return null;

            const reloadTimestamp = reloadTimestamps[icon.id] || 0;

            return (
              <div
                key={`icon-${icon.id}-${row}-${col}`}
                className="desktop-icon"
                style={{
                  left:
                    col * (iconBox + ICON_HORIZONTAL_PADDING) +
                    (icon.offsetX || 0) +
                    ICON_ROOT_OFFSET_LEFT,
                  top:
                    row * (iconBox + ICON_VERTICAL_PADDING) +
                    (icon.offsetY || 0) +
                    ICON_ROOT_OFFSET_TOP,
                  width: icon.width || defaultIconSize,
                  height: icon.height || defaultIconSize,
                }}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, icon, row, col)}
                onDragEnd={handleDragEnd}
                onDoubleClick={() => handleIconDoubleClick(icon)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  handleIconRightClick(e, row, col);
                }}
              >
                <SafeImage
                  id={icon.id}
                  row={row}
                  col={col}
                  imagePath={icon.image}
                  width={icon.width || defaultIconSize}
                  height={icon.height || defaultIconSize}
                  highlighted={isIconHighlighted(row, col)}
                  forceReload={reloadTimestamp}
                />
                {icon.fontSize !== 0 &&
                  !hideIconNames &&
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
                Hide Icons
                <input
                  type="checkbox"
                  checked={hideIcons}
                  onChange={toggleIcons}
                />
              </label>
              <label className="menu-checkbox">
                Hide Icon Names
                <input
                  type="checkbox"
                  checked={hideIconNames}
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
                Hide Icons
                <input
                  type="checkbox"
                  checked={hideIcons}
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
