import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getDefaultDesktopIcon } from "../../electron/DesktopIcon";
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
  const [showOffscreen, setShowOffscreen] = useState(true);
  const showAllHighlightsRef = useRef(showAllHighlights);
  const [reloadTimestamps, setReloadTimestamps] =
    useState<IconReloadTimestamps>({});
  const [defaultFontSize, setDefaultFontSize] = useState<number>(16);
  const [defaultIconSize, setDefaultIconSize] = useState<number>(64);
  const [iconBox, setIconBox] = useState(100);
  const [defaultFontColor, setDefaultFontColor] = useState<string>("white");

  const [dimmerValue, setDimmerValue] = useState(50);
  const [allHighlightsDefault, setAllHighlightsDefault] = useState(true);
  const [allHighlightsOffset, setAllHighlightsOffset] = useState(true);
  const [allHighlightsOversized, setAllHighlightsOversized] = useState(true);
  const [allHighlightsBoth, setAllHighlightsBoth] = useState(true);

  const [backgroundType, setBackgroundType] = useState<string>("image");
  const [showVideoControls, setShowVideoControls] = useState<boolean>(false);

  const [editIconActive, setEditIconActive] = useState(false);
  const [editingIconId, setEditingIconId] = useState<string | null>(null);
  const [originalEditIconOffset, setOriginalEditIconOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const editIconDropOccurred = useRef(false);

  const SNAP_RADIUS = 10;

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

  type DraggedDesktopIcon = DesktopIcon & {
    initialMouseX: number;
    initialMouseY: number;
    initialOffsetX: number;
    initialOffsetY: number;
  };
  type DraggedIconState = {
    icon: DraggedDesktopIcon;
    startRow: number;
    startCol: number;
  };
  const [draggedIcon, setDraggedIcon] = useState<{
    icon: DraggedDesktopIcon;
    startRow: number;
    startCol: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    icon: DesktopIcon;
    row: number;
    col: number;
  } | null>(null);

  const [swapPreview, setSwapPreview] = useState<{
    icon: DesktopIcon;
    row: number;
    col: number;
  } | null>(null);

  const [editIconHighlight, setEditIconHighlight] = useState<{
    row: number;
    col: number;
    visible: boolean;
  } | null>(null);

  const [offscreenIconsPanel, setOffscreenIconsPanel] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    icons: Array<{
      name: string;
      id: string;
      reason: string;
      icon: DesktopIcon;
    }>;
  }>({
    visible: false,
    position: { x: 50, y: 50 },
    icons: [],
  });

  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [panelDragStart, setPanelDragStart] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [draggedOffscreenIcon, setDraggedOffscreenIcon] =
    useState<DesktopIcon | null>(null);

  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

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

  useEffect(() => {
    showAllHighlightsRef.current = showAllHighlights;
  }, [showAllHighlights]);

  const toggleIcons = () => {
    // Always show icon names when toggled (only shows when icons show). So restoring icons shows names.
    window.electron.setRendererStates({
      hideIcons: !hideIcons,
      hideIconNames: false,
    });
    hideContextMenu();
  };

  const toggleIconNames = () => {
    window.electron.setRendererStates({
      hideIconNames: !hideIconNames,
    });
    hideContextMenu();
  };

  const handleShowVideoControls = async () => {
    await window.electron.setRendererStates({
      showVideoControls: !showVideoControls,
    });
  };

  const toggleGrid = () => {
    const newGrid = !showGrid;
    setShowGrid((prev) => !prev);
    if (newGrid) {
      setContextMenu(null); // Keeps the Display > open on clicking for next context menu that opens.
      hideHighlightBox();
    } else {
      hideContextMenu();
    }
  };

  useEffect(() => {
    let resizeTimeout: number | undefined;

    const handleResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 200); // Wait till user stops moving for 200ms before updating
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  useEffect(() => {
    const detectOffscreenIcons = () => {
      // If showAllHighlights is false, return early
      if (!showAllHighlights && !showOffscreen) {
        return;
      }

      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Calculate max rows and columns that fit within the viewport
      const maxCols = Math.floor(
        viewport.width / (iconBox + ICON_HORIZONTAL_PADDING)
      );
      const maxRows = Math.floor(
        viewport.height / (iconBox + ICON_VERTICAL_PADDING)
      );

      const offscreenIcons: Array<{
        name: string;
        id: string;
        reason: string;
        icon: DesktopIcon;
      }> = [];

      Array.from(iconsById.values()).forEach((icon) => {
        const reasons: string[] = [];

        if (icon.offsetX || icon.offsetY) {
          const left =
            icon.col * (iconBox + ICON_HORIZONTAL_PADDING) +
            (icon.offsetX || 0) +
            ICON_ROOT_OFFSET_LEFT;
          const top =
            icon.row * (iconBox + ICON_VERTICAL_PADDING) +
            (icon.offsetY || 0) +
            ICON_ROOT_OFFSET_TOP;
          const width = icon.width || defaultIconSize;
          const height = icon.height || defaultIconSize;

          if (left + width > viewport.width) reasons.push("right");
          if (top + height > viewport.height) reasons.push("bottom");
          if (left < 0) reasons.push("left");
          if (top < 0) reasons.push("top");
        } else {
          // Icons without offsets (or = 0)
          if (icon.row >= maxRows) reasons.push("bottom");
          if (icon.col >= maxCols) reasons.push("right");
          if (icon.row < 0) reasons.push("top");
          if (icon.col < 0) reasons.push("left");
        }

        if (reasons.length > 0) {
          offscreenIcons.push({
            name: icon.name,
            id: icon.id,
            reason: `off-screen (${reasons.join(", ")})`,
            icon,
          });
        }
      });

      // Update offscreen icons state
      setOffscreenIconsPanel((prev) => {
        // Clamp logic: ensure panel is within viewport, else reset to default (50,50)
        const panelWidth = 250;
        const panelHeight = 300;
        const minX = 0;
        const minY = 40;
        const maxX = window.innerWidth - panelWidth;
        const maxY = window.innerHeight - panelHeight;

        const { x, y } = prev.position;
        const outOfBounds = x < minX || y < minY || x > maxX || y > maxY;

        return {
          ...prev,
          icons: offscreenIcons,
          visible: offscreenIcons.length > 0,
          position: outOfBounds ? { x: 50, y: 50 } : { x, y },
        };
      });
    };

    // Call detectOffscreenIcons whenever showAllHighlights is true
    if (iconsById && (showAllHighlights || showOffscreen)) {
      detectOffscreenIcons();
    } else {
      setOffscreenIconsPanel((prev) => ({
        ...prev,
        visible: false,
        icons: [],
      }));
    }
  }, [iconsById, showAllHighlights, iconBox, showOffscreen, viewportSize]);

  const toggleHighlightAllIcons = async () => {
    const newShowAllHighlights = !showAllHighlights;
    if (newShowAllHighlights) {
      setOffscreenIconsPanel((prev) => ({
        ...prev,
        position: { x: 50, y: 50 },
      }));
    }
    setShowAllHighlights(newShowAllHighlights);

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
    logger.info("called removeIconCompletely for id=", id);
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
      removeIconCompletely(id);
      logger.warn(
        `IPC reload: no icon data for id=${id}. Cleared Map entries referencing this id.`
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

  useEffect(() => {
    setIconBox(defaultIconSize * 1.5625);
    logger.info("setting iconBox to: " + defaultIconSize * 1.5625);
  }, [defaultIconSize]);

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
        hideContextMenu();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu]);

  useEffect(() => {
    const ipcReload = (
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
    window.electron.on("reload-icon", ipcReload as (...a: unknown[]) => void);

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
        ipcReload as (...a: unknown[]) => void
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
    e.stopPropagation();
    handleRightClick(e, "icon", row, col);
    showHighlightAt(row, col);

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
        setEditIconHighlight({
          row: row,
          col: col,
          visible: true,
        });
        setEditingIconId(icon.id); // Lock dragging
        setOriginalEditIconOffset({
          x: icon.offsetX || 0,
          y: icon.offsetY || 0,
        });
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
      setEditIconHighlight({
        row: validRow,
        col: validCol,
        visible: true,
      });
      if (icon) {
        window.electron.ensureDataFolder(icon.id);
        window.electron.editIcon(icon.id, validRow, validCol);
        setContextMenu(null);
        setEditingIconId(icon.id); // Lock dragging
      } else {
        // Send preview of default DesktopIcon for new icon
        const temp_id = await window.electron.ensureUniqueIconId("temp");
        if (temp_id) {
          window.electron.ensureDataFolder(temp_id);
          const defaultIcon = getDefaultDesktopIcon(
            temp_id,
            validRow,
            validCol
          );
          await window.electron.previewIconUpdate(temp_id, defaultIcon);
          window.electron.editIcon(temp_id, validRow, validCol);
          setContextMenu(null);
          setEditIconActive(true); // Lock icon dragging
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

  useEffect(() => {
    const handleEditIconClosed = (...args: unknown[]) => {
      const closedWindow = args[1] as string;
      logger.info("closedWindow = ", closedWindow);
      setEditIconHighlight(null);
      setEditIconActive(false);
      setEditingIconId(null); // Unlock icon dragging
    };
    // Listen for when Edit Icon window closes
    window.electron.on("subwindow-closed", handleEditIconClosed);
    return () => {
      window.electron.off("subwindow-closed", handleEditIconClosed);
    };
  }, []);

  const handleReloadIcon = async () => {
    if (!contextMenu?.icon) return;

    const { id, row, col } = contextMenu.icon;

    try {
      // Call the Electron API to reload the icon by id
      const ret: boolean = await window.electron.reloadIcon(id);

      if (!ret) {
        logger.info(
          `Icon reload returned false for id=${id} (previously at [${row}, ${col}]). `
        );
        removeIconCompletely(id);
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

    hideContextMenu();
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

      hideContextMenu();
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

    hideContextMenu();
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
    hideContextMenu();
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
    hideContextMenu();
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
    _: Electron.IpcRendererEvent,
    {
      id,
      row,
      col,
      updates,
    }: { id: string; row: number; col: number; updates: Partial<DesktopIcon> }
  ) => {
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
    setDraggedIcon({
      icon: {
        ...icon,
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialOffsetX: icon.offsetX || 0,
        initialOffsetY: icon.offsetY || 0,
      },
      startRow: row,
      startCol: col,
    });

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
    if (editingIconId && draggedIcon && draggedIcon.icon.id === editingIconId) {
      handleOffsetDragOver(e);
      return;
    }
    // Handle regular icon dragging
    if (draggedIcon) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const { clientX: x, clientY: y } = e;
      const [hoverRow, hoverCol] = getRowColFromXY(x, y);

      showHighlightAt(hoverRow, hoverCol);

      // Check if there's an icon at the hover position
      const existingIcon = getIcon(hoverRow, hoverCol);

      if (existingIcon && existingIcon.id !== draggedIcon.icon.id) {
        // Show swap preview - existing icon moves to dragged icon's original position
        setSwapPreview({
          icon: existingIcon,
          row: draggedIcon.startRow,
          col: draggedIcon.startCol,
        });
      } else {
        // Clear swap preview if not hovering over another icon
        setSwapPreview(null);
      }

      // Set drag preview for the dragged icon
      setDragPreview({
        icon: draggedIcon.icon,
        row: hoverRow,
        col: hoverCol,
      });
      return;
    }

    // Handle offscreen icon dragging
    if (!draggedOffscreenIcon) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const { clientX: x, clientY: y } = e;
    const [hoverRow, hoverCol] = getRowColFromXY(x, y);

    showHighlightAt(hoverRow, hoverCol);

    // Check if there's an icon at the hover position
    const existingIcon = getIcon(hoverRow, hoverCol);

    if (existingIcon && existingIcon.id !== draggedOffscreenIcon.id) {
      // Show swap preview - existing icon moves to offscreen icon's original position
      setSwapPreview({
        icon: existingIcon,
        row: draggedOffscreenIcon.row,
        col: draggedOffscreenIcon.col,
      });
    } else {
      setSwapPreview(null);
    }

    // Set drag preview for the offscreen icon (standardized to 64x64)
    setDragPreview({
      icon: {
        ...draggedOffscreenIcon,
        width: 64,
        height: 64,
        offsetX: 0,
        offsetY: 0,
      },
      row: hoverRow,
      col: hoverCol,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    // Handle regular icon dropping
    if (draggedIcon) {
      const { clientX: x, clientY: y } = e;
      const [dropRow, dropCol] = getRowColFromXY(x, y);

      // Check if dropping on existing icon
      const existingIcon = getIcon(dropRow, dropCol);
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
      return;
    }

    // Handle offscreen icon dropping
    if (!draggedOffscreenIcon) return;

    const { clientX: x, clientY: y } = e;
    const [dropRow, dropCol] = getRowColFromXY(x, y);

    // Check if dropping on existing icon
    const existingIcon = getIcon(dropRow, dropCol);
    if (existingIcon && existingIcon.id !== draggedOffscreenIcon.id) {
      logger.info(
        `Dropping offscreen icon on existing icon: ${existingIcon.name} at [${dropRow}, ${dropCol}]`
      );
      window.electron.swapDesktopIcons(
        draggedOffscreenIcon.id,
        existingIcon.id
      );
      window.electron.reloadIcon(draggedOffscreenIcon.id);
      window.electron.reloadIcon(existingIcon.id);
    } else {
      logger.info(
        `Dropping offscreen icon: ${draggedOffscreenIcon.name} at [${dropRow}, ${dropCol}]`
      );
      window.electron.moveDesktopIcon(
        draggedOffscreenIcon.id,
        dropRow,
        dropCol,
        true
      );
      window.electron.reloadIcon(draggedOffscreenIcon.id);
    }

    resetDragStates();
  };
  const handleDragEnd = () => {
    resetDragStates();
  };

  const resetDragStates = () => {
    setDraggedIcon(null);
    setDraggedOffscreenIcon(null);
    setDragPreview(null);
    setSwapPreview(null);
    hideHighlightBox();
  };
  const hideContextMenu = () => {
    setContextMenu(null);
    hideHighlightBox();
    setShowOpenSubmenu(false);
  };

  const handlePanelMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPanel(true);
    setPanelDragStart({
      x: e.clientX - offscreenIconsPanel.position.x,
      y: e.clientY - offscreenIconsPanel.position.y,
    });
    e.preventDefault();
  };

  const handlePanelMouseMove = (e: MouseEvent) => {
    if (!isDraggingPanel) return;

    // Get panel size
    const panel = document.querySelector(
      ".offscreen-icons-panel"
    ) as HTMLElement;
    const panelWidth = panel?.offsetWidth || 300;
    const panelHeight = panel?.offsetHeight || 300;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // minY due to header bar
    const minY = 40;
    const minX = 0;

    // Clamp X and Y so panel stays in viewport and below header
    let x = e.clientX - panelDragStart.x;
    let y = e.clientY - panelDragStart.y;

    x = Math.max(minX, Math.min(x, viewportWidth - panelWidth));
    y = Math.max(minY, Math.min(y, viewportHeight - panelHeight));

    setOffscreenIconsPanel((prev) => ({
      ...prev,
      position: { x, y },
    }));
  };

  const handlePanelMouseUp = () => {
    setIsDraggingPanel(false);
  };

  const handleOffscreenIconDragStart = (
    e: React.DragEvent,
    icon: DesktopIcon
  ) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedOffscreenIcon(icon);

    // Create an empty div to hide the drag image
    const emptyDiv = document.createElement("div");
    emptyDiv.style.width = "1px";
    emptyDiv.style.height = "1px";
    emptyDiv.style.backgroundColor = "transparent";
    document.body.appendChild(emptyDiv);
    e.dataTransfer.setDragImage(emptyDiv, 0, 0);
    setTimeout(() => document.body.removeChild(emptyDiv), 0);

    logger.info(`Started dragging off-screen icon: ${icon.name}`);
  };

  useEffect(() => {
    if (isDraggingPanel) {
      document.addEventListener("mousemove", handlePanelMouseMove);
      document.addEventListener("mouseup", handlePanelMouseUp);

      return () => {
        document.removeEventListener("mousemove", handlePanelMouseMove);
        document.removeEventListener("mouseup", handlePanelMouseUp);
      };
    }
  }, [isDraggingPanel]);

  const handleOffsetDragStart = (
    e: React.DragEvent,
    icon: DesktopIcon,
    row: number,
    col: number
  ) => {
    e.dataTransfer.effectAllowed = "move";

    // Store initial mouse position and icon offset
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const initialOffsetX = icon.offsetX || 0;
    const initialOffsetY = icon.offsetY || 0;

    const draggedIconWithState: DraggedDesktopIcon = {
      ...icon,
      initialMouseX,
      initialMouseY,
      initialOffsetX,
      initialOffsetY,
    };

    setDraggedIcon({
      icon: draggedIconWithState,
      startRow: row,
      startCol: col,
    });

    // Hide drag image
    const emptyDiv = document.createElement("div");
    emptyDiv.style.width = "1px";
    emptyDiv.style.height = "1px";
    emptyDiv.style.backgroundColor = "transparent";
    document.body.appendChild(emptyDiv);
    e.dataTransfer.setDragImage(emptyDiv, 0, 0);
    setTimeout(() => document.body.removeChild(emptyDiv), 0);
  };

  const handleOffsetDragOver = (e: React.DragEvent) => {
    if (!draggedIcon || !editingIconId) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const deltaX = e.clientX - draggedIcon.icon.initialMouseX;
    const deltaY = e.clientY - draggedIcon.icon.initialMouseY;

    const baseOffsetX = draggedIcon.icon.initialOffsetX + deltaX;
    const baseOffsetY = draggedIcon.icon.initialOffsetY + deltaY;

    const [newOffsetX, newOffsetY] = getSnappedOffsets(
      draggedIcon,
      baseOffsetX,
      baseOffsetY,
      e.shiftKey
    );

    setIconsById((prev) => {
      const newMap = new Map(prev);
      const icon = newMap.get(editingIconId);
      if (icon) {
        newMap.set(editingIconId, {
          ...icon,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
        });
      }
      return newMap;
    });
  };

  const handleOffsetDrop = (e: React.DragEvent) => {
    if (!draggedIcon || !editingIconId) return;

    e.preventDefault();
    editIconDropOccurred.current = true;

    const deltaX = e.clientX - draggedIcon.icon.initialMouseX;
    const deltaY = e.clientY - draggedIcon.icon.initialMouseY;

    const baseOffsetX = draggedIcon.icon.initialOffsetX + deltaX;
    const baseOffsetY = draggedIcon.icon.initialOffsetY + deltaY;

    const [newOffsetX, newOffsetY] = getSnappedOffsets(
      draggedIcon,
      baseOffsetX,
      baseOffsetY,
      e.shiftKey
    );

    window.electron.editIconOffsetUpdate(newOffsetX, newOffsetY);
    logger.info(
      `Dropped icon: [${draggedIcon.icon.name}] with new offsets X: ${newOffsetX}, Y: ${newOffsetY}`
    );

    resetDragStates();
  };

  const handleEditIconDragEnd = async () => {
    if (
      !editIconDropOccurred.current &&
      originalEditIconOffset &&
      editingIconId
    ) {
      logger.info(
        "Drag cancelled, reverting offsets to: " +
          originalEditIconOffset.x +
          ", " +
          originalEditIconOffset.y
      );
      window.electron.editIconOffsetUpdate(
        originalEditIconOffset.x,
        originalEditIconOffset.y
      );
    }
    editIconDropOccurred.current = false; // Reset for next drag
    resetDragStates();
  };

  function getSnappedOffsets(
    draggedIcon: DraggedIconState,
    baseOffsetX: number,
    baseOffsetY: number,
    shiftKey: boolean
  ): [number, number] {
    let newOffsetX = baseOffsetX;
    let newOffsetY = baseOffsetY;

    if (shiftKey) {
      const iconWidth = draggedIcon.icon.width || defaultIconSize;
      const iconHeight = draggedIcon.icon.height || defaultIconSize;

      const baseLeft =
        draggedIcon.startCol * (iconBox + ICON_HORIZONTAL_PADDING) +
        ICON_ROOT_OFFSET_LEFT;
      const baseTop =
        draggedIcon.startRow * (iconBox + ICON_VERTICAL_PADDING) +
        ICON_ROOT_OFFSET_TOP;

      const iconLeft = baseLeft + newOffsetX;
      const iconTop = baseTop + newOffsetY;
      const iconRight = iconLeft + iconWidth;
      const iconBottom = iconTop + iconHeight;

      let snappedOffsetX = newOffsetX;
      let snappedOffsetY = newOffsetY;
      let snappedToX = false;
      let snappedToY = false;

      // Snap to vertical grid lines (left edge)
      for (let col = 0; col <= numCols; col++) {
        const gridX =
          ICON_ROOT_OFFSET_LEFT + col * (iconBox + ICON_HORIZONTAL_PADDING);
        if (Math.abs(iconLeft - gridX) < SNAP_RADIUS) {
          snappedOffsetX = gridX - baseLeft;
          snappedToX = true;
          break;
        }
      }

      // Snap to vertical grid lines (right edge)
      if (!snappedToX) {
        for (let col = 0; col <= numCols; col++) {
          const gridX =
            ICON_ROOT_OFFSET_LEFT + col * (iconBox + ICON_HORIZONTAL_PADDING);
          if (Math.abs(iconRight - gridX) < SNAP_RADIUS) {
            snappedOffsetX = gridX - baseLeft - iconWidth;
            snappedToX = true;
            break;
          }
        }
      }

      // Snap to horizontal grid lines (top edge)
      for (let row = 0; row <= numRows; row++) {
        const gridY =
          ICON_ROOT_OFFSET_TOP + row * (iconBox + ICON_VERTICAL_PADDING);
        if (Math.abs(iconTop - gridY) < SNAP_RADIUS) {
          snappedOffsetY = gridY - baseTop;
          snappedToY = true;
          break;
        }
      }

      // Snap to horizontal grid lines (bottom edge)
      if (!snappedToY) {
        for (let row = 0; row <= numRows; row++) {
          const gridY =
            ICON_ROOT_OFFSET_TOP + row * (iconBox + ICON_VERTICAL_PADDING);
          if (Math.abs(iconBottom - gridY) < SNAP_RADIUS) {
            snappedOffsetY = gridY - baseTop - iconHeight;
            snappedToY = true;
            break;
          }
        }
      }

      newOffsetX = snappedOffsetX;
      newOffsetY = snappedOffsetY;
    }

    return [Math.round(newOffsetX), Math.round(newOffsetY)];
  }

  // TODO add drag ctrl modifier which allows freely moving icons, syncs it to nearest icon home,
  // and when dropping saves it with the offsetX/Y values.

  return (
    <>
      <div
        className="desktop-grid"
        onContextMenu={handleDesktopRightClick}
        onDragOver={editingIconId ? handleOffsetDragOver : handleDragOver}
        onDrop={editingIconId ? handleOffsetDrop : handleDrop}
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

        {/* Render Edit Icon highlight box if visible */}
        {editIconHighlight?.visible && (
          <div
            className={`highlight-box pulsing`}
            style={{
              position: "absolute",
              left:
                editIconHighlight.col * (iconBox + ICON_HORIZONTAL_PADDING) +
                ICON_ROOT_OFFSET_LEFT,
              top:
                editIconHighlight.row * (iconBox + ICON_VERTICAL_PADDING) +
                ICON_ROOT_OFFSET_TOP,
              width: iconBox,
              height: iconBox + ICON_VERTICAL_PADDING,
            }}
          />
        )}

        {swapPreview && (
          <div
            className="highlight-box swap-highlight"
            style={{
              left:
                swapPreview.col * (iconBox + ICON_HORIZONTAL_PADDING) +
                ICON_ROOT_OFFSET_LEFT,
              top:
                swapPreview.row * (iconBox + ICON_VERTICAL_PADDING) +
                ICON_ROOT_OFFSET_TOP,
              width: iconBox,
              height: iconBox + ICON_VERTICAL_PADDING,
            }}
          />
        )}

        {/* Render drag preview icon */}
        {dragPreview && (
          <div
            key={`drag-preview-${dragPreview.icon.id}`}
            className="desktop-icon drag-preview"
            style={{
              left:
                dragPreview.col * (iconBox + ICON_HORIZONTAL_PADDING) +
                ICON_ROOT_OFFSET_LEFT,
              top:
                dragPreview.row * (iconBox + ICON_VERTICAL_PADDING) +
                ICON_ROOT_OFFSET_TOP,
              width: dragPreview.icon.width || defaultIconSize,
              height: dragPreview.icon.height || defaultIconSize,
            }}
          >
            <SafeImage
              id={dragPreview.icon.id}
              row={dragPreview.row}
              col={dragPreview.col}
              imagePath={dragPreview.icon.image}
              width={dragPreview.icon.width || defaultIconSize}
              height={dragPreview.icon.height || defaultIconSize}
              highlighted={false}
              forceReload={reloadTimestamps[dragPreview.icon.id] || 0}
            />
            {dragPreview.icon.fontSize !== 0 &&
              !hideIconNames &&
              (dragPreview.icon.fontSize || defaultFontSize) !== 0 && (
                <div
                  className="desktop-icon-name"
                  title={dragPreview.icon.name}
                  style={
                    {
                      color: dragPreview.icon.fontColor || defaultFontColor,
                      fontSize: dragPreview.icon.fontSize || defaultFontSize,
                      "--line-clamp": Math.max(
                        1,
                        Math.floor(
                          48 / (dragPreview.icon.fontSize || defaultFontSize)
                        )
                      ),
                    } as React.CSSProperties
                  }
                >
                  {dragPreview.icon.name}
                </div>
              )}
          </div>
        )}

        {swapPreview && (
          <div
            key={`swap-preview-${swapPreview.icon.id}`}
            className="desktop-icon swap-preview"
            style={{
              left:
                swapPreview.col * (iconBox + ICON_HORIZONTAL_PADDING) +
                ICON_ROOT_OFFSET_LEFT,
              top:
                swapPreview.row * (iconBox + ICON_VERTICAL_PADDING) +
                ICON_ROOT_OFFSET_TOP,
              width: swapPreview.icon.width || defaultIconSize,
              height: swapPreview.icon.height || defaultIconSize,
            }}
          >
            <SafeImage
              id={swapPreview.icon.id}
              row={swapPreview.row}
              col={swapPreview.col}
              imagePath={swapPreview.icon.image}
              width={swapPreview.icon.width || defaultIconSize}
              height={swapPreview.icon.height || defaultIconSize}
              highlighted={false}
              forceReload={reloadTimestamps[swapPreview.icon.id] || 0}
            />
            {swapPreview.icon.fontSize !== 0 &&
              !hideIconNames &&
              (swapPreview.icon.fontSize || defaultFontSize) !== 0 && (
                <div
                  className="desktop-icon-name"
                  title={swapPreview.icon.name}
                  style={
                    {
                      color: swapPreview.icon.fontColor || defaultFontColor,
                      fontSize: swapPreview.icon.fontSize || defaultFontSize,
                      "--line-clamp": Math.max(
                        1,
                        Math.floor(
                          48 / (swapPreview.icon.fontSize || defaultFontSize)
                        )
                      ),
                    } as React.CSSProperties
                  }
                >
                  {swapPreview.icon.name}
                </div>
              )}
          </div>
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

            // Hide the icon if it's being shown in swap preview
            const isBeingSwapped =
              swapPreview && swapPreview.icon.id === icon.id;
            // Also hide if it's the dragged icon or the icon being dragged over
            const isDraggedIcon = draggedIcon?.icon.id === icon.id;

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
                  cursor: editIconActive
                    ? "not-allowed"
                    : isDraggedIcon
                      ? "grabbing"
                      : "grab",
                  opacity: editingIconId
                    ? 1
                    : isDraggedIcon || isBeingSwapped
                      ? 0
                      : 1,
                }}
                draggable={
                  editingIconId ? icon.id === editingIconId : !editIconActive
                }
                onDragStart={
                  editingIconId
                    ? icon.id === editingIconId
                      ? (e) => handleOffsetDragStart(e, icon, row, col)
                      : undefined // Explicitly disable drag start for non-editing icons
                    : !editIconActive
                      ? (e) => handleDragStart(e, icon, row, col)
                      : undefined
                }
                onDragEnd={
                  editingIconId ? handleEditIconDragEnd : handleDragEnd
                }
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
          <div
            className="background-dimmer"
            style={{ background: `rgba(0,0,0,${dimmerValue / 100})` }}
          />
        )}

        {showAllHighlights && (
          <div className="show-all-highlights-legend">
            <div className="show-all-highlights-legend-row">
              <span className="show-all-highlights-legend-item">
                <input
                  type="checkbox"
                  checked={allHighlightsDefault}
                  onChange={() =>
                    setAllHighlightsDefault(!allHighlightsDefault)
                  }
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
              <span className="show-all-highlights-legend-item">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={toggleGrid}
                  id="legend-showgrid"
                />
                <label htmlFor="legend-showgrid" style={{ cursor: "pointer" }}>
                  Show Grid
                </label>
              </span>
            </div>
            <div className="show-all-highlights-legend-row">
              <span className="show-all-highlights-legend-item">
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
              <div className="menu-item" title="Coming soon">
                Icons Profile
              </div>
              <div className="menu-item" onClick={handleOpenBackgroundSelect}>
                Change Background
              </div>
              <div className="menu-item" onClick={handleOpenSettings}>
                Settings
              </div>
              <div className="menu-separator" />
              <label className="menu-checkbox">
                Icons Overview
                <input
                  type="checkbox"
                  checked={showAllHighlights}
                  onChange={toggleHighlightAllIcons}
                  title="A variety of visual cues and tools to help manage your Desktop icons"
                />
              </label>
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
              <div className="menu-separator" />
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

      {offscreenIconsPanel.visible && (
        <div
          className="offscreen-icons-panel"
          style={{
            left: `${offscreenIconsPanel.position.x}px`,
            top: `${offscreenIconsPanel.position.y}px`,
          }}
        >
          <div
            className={`offscreen-icons-panel-header${isDraggingPanel ? " grabbing" : ""}`}
            onMouseDown={handlePanelMouseDown}
          >
            <span>Off-screen Icons ({offscreenIconsPanel.icons.length})</span>
            {/* Button only shows when showOffscreen is true and showAllHighlights is false */}
            {showOffscreen && !showAllHighlights && (
              <button
                className="show-offscreen-close-button"
                title="Hide Off-screen Icons Panel"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOffscreen(false);
                }}
              >
                ×
              </button>
            )}
          </div>
          <div className="offscreen-icons-panel-list">
            {offscreenIconsPanel.icons.map((iconData) => (
              <div
                key={`offscreen-${iconData.id}`}
                className="offscreen-icon-item"
                draggable
                onDragStart={(e) =>
                  handleOffscreenIconDragStart(e, iconData.icon)
                }
                onDragEnd={resetDragStates}
              >
                <div className="offscreen-icon-image">
                  <SafeImage
                    id={iconData.icon.id}
                    row={iconData.icon.row}
                    col={iconData.icon.col}
                    imagePath={iconData.icon.image}
                    width={32}
                    height={32}
                    highlighted={false}
                    forceReload={reloadTimestamps[iconData.icon.id] || 0}
                  />
                </div>
                <div className="offscreen-icon-details">
                  <div
                    className="offscreen-icon-name"
                    title={iconData.name || iconData.id}
                  >
                    {iconData.name || iconData.id}
                  </div>
                  <div className="offscreen-icon-reason">{iconData.reason}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="offscreen-icons-panel-footer">
            Drag icons to Desktop to place them
          </div>
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
