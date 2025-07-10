import {
  FolderIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PUBLIC_TAG_CATEGORIES } from "../../electron/publicTags";
import "../App.css";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import AddTagWindow, { RenameTagModal } from "./AddTag";
import ClearableInput from "./ClearableInput";
import EditCategories from "./EditCategories";
import { SafeImage } from "./SafeImage";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const EditBackground: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawSummary = params.get("summary");
  const initialSummary: BackgroundSummary = rawSummary
    ? JSON.parse(rawSummary)
    : {
        id: "",
        name: "",
        description: "",
        iconPath: "",
        bgFile: "",
        tags: [],
        localTags: [],
      };

  const [summary, setSummary] = useState<BackgroundSummary>(initialSummary);
  const [bgFileType, setBgFileType] = useState<string | null>(null);
  const [saveBgFileAsShortcut, setSaveBgFileAsShortcut] =
    useState<boolean>(true);

  const [showAddTag, setShowAddTag] = useState(false);
  const [showEditCategories, setShowEditCategories] = useState(false);

  const [ids, setIds] = useState<Set<string>>(new Set<string>());
  const [isHoveringBgFile, setIsHoveringBgFile] = useState(false);
  const [isHoveringIconPath, setIsHoveringIconPath] = useState(false);
  const [hasBackgroundFolder, setHasBackgroundFolder] = useState(false);
  const [isHoveringBackgroundGlass, setHoveringBackgroundGlass] =
    useState(false);
  const [isHoveringIconGlass, setHoveringIconGlass] = useState(false);

  const [localTags, setLocalTags] = useState<LocalTag[]>([]);
  const [groupedLocalTags, setGroupedLocalTags] = useState<
    Record<string, LocalTag[]>
  >({});

  const [localTagSearch, setLocalTagSearch] = useState("");

  // Filtered public categories/tags
  const filteredPublicTagCategories = React.useMemo(() => {
    if (!localTagSearch.trim()) return PUBLIC_TAG_CATEGORIES;
    const search = localTagSearch.trim().toLowerCase();
    return PUBLIC_TAG_CATEGORIES.map((cat) => {
      // If category matches, show all tags in it
      if (cat.name.toLowerCase().includes(search)) return cat;
      // Otherwise, only show tags that match
      const filteredTags = cat.tags.filter((tag) =>
        tag.toLowerCase().includes(search)
      );
      if (filteredTags.length > 0) return { ...cat, tags: filteredTags };
      return null;
    }).filter(Boolean);
  }, [localTagSearch]);

  const [draggedTag, setDraggedTag] = useState<{
    tag: LocalTag;
    fromCategory: string;
  } | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  const [externalPaths, setExternalPaths] = useState<string[]>([]);
  const [saveLocation, setSaveLocation] = useState<string>("default");
  const originalSaveLocationRef = useRef<string>("default");

  const [tagContextMenu, setTagContextMenu] = useState<{
    x: number;
    y: number;
    tag: LocalTag;
    category: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.electron.getBackgroundIDs().then((idArray: string[]) => {
      if (!cancelled) {
        setIds(new Set<string>(idArray));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [collapsedPublicCategories, setCollapsedPublicCategories] = useState<
    Set<string>
  >(new Set());
  const [collapsedPublicTags, setCollapsedPublicTags] = useState(false);
  const [collapsedLocalTags, setCollapsedLocalTags] = useState(false);

  // Load categories collapsed/expanded state from settings
  useEffect(() => {
    (async () => {
      const categoriesObj: Record<string, boolean> & { show?: boolean } =
        (await window.electron.getSetting("localCategories")) ?? {};
      if (typeof categoriesObj.show === "boolean") {
        setCollapsedLocalTags(!categoriesObj.show);
      }
      // Categories with value === false should be collapsed
      const collapsed = Object.entries(categoriesObj)
        .filter(([cat, expanded]) => cat !== "show" && !expanded)
        .map(([cat]) => cat);
      setCollapsedCategories(new Set(collapsed));
    })();
  }, []);

  // Handles toggle for section
  const toggleLocalTags = () => {
    setCollapsedLocalTags((prev) => {
      const newVal = !prev;
      // Save the correct value to settings: show = !collapsed
      window.electron
        .getSetting("localCategories")
        .then(
          (
            categoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (categoriesObj && typeof categoriesObj === "object") {
              categoriesObj.show = !newVal;
              window.electron.saveSettingsData({
                localCategories: categoriesObj,
              });
            }
          }
        );
      return newVal;
    });
  };

  // handles toggle for individual categories
  const toggleCategory = async (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      let expanded = true;
      if (newSet.has(category)) {
        newSet.delete(category);
        expanded = true;
      } else {
        newSet.add(category);
        expanded = false;
      }
      // Update settings.json
      window.electron
        .getSetting("localCategories")
        .then((categoriesObj: Record<string, boolean> | undefined) => {
          if (categoriesObj && typeof categoriesObj === "object") {
            categoriesObj[category] = expanded;
            window.electron.saveSettingsData({
              localCategories: categoriesObj,
            });
          }
        });
      return newSet;
    });
  };

  useEffect(() => {
    (async () => {
      const publicCategoriesObj: Record<string, boolean> & { show?: boolean } =
        (await window.electron.getSetting("publicCategories")) ?? {};
      if (typeof publicCategoriesObj.show === "boolean") {
        setCollapsedPublicTags(!publicCategoriesObj.show);
      }
      // Categories with value === false should be collapsed (ignore "show" key)
      const collapsed = Object.entries(publicCategoriesObj)
        .filter(([cat, expanded]) => cat !== "show" && !expanded)
        .map(([cat]) => cat);
      setCollapsedPublicCategories(new Set(collapsed));
    })();
  }, []);

  // Handles toggle for section
  const togglePublicTags = () => {
    setCollapsedPublicTags((prev) => {
      const newVal = !prev;
      // Save the correct value to settings: show = !collapsed
      window.electron
        .getSetting("publicCategories")
        .then(
          (
            publicCategoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (
              publicCategoriesObj &&
              typeof publicCategoriesObj === "object"
            ) {
              publicCategoriesObj.show = !newVal;
              window.electron.saveSettingsData({
                publicCategories: publicCategoriesObj,
              });
            }
          }
        );
      return newVal;
    });
  };

  // handles toggle for individual categories
  const togglePublicCategory = (category: string) => {
    setCollapsedPublicCategories((prev) => {
      const newSet = new Set(prev);
      let expanded = true;
      if (newSet.has(category)) {
        newSet.delete(category);
        expanded = true;
      } else {
        newSet.add(category);
        expanded = false;
      }
      // Update settings.json
      window.electron
        .getSetting("publicCategories")
        .then(
          (
            publicCategoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (
              publicCategoriesObj &&
              typeof publicCategoriesObj === "object"
            ) {
              publicCategoriesObj[category] = expanded;
              window.electron.saveSettingsData({
                publicCategories: publicCategoriesObj,
              });
            }
          }
        );
      return newSet;
    });
  };

  const loadLocalTags = async () => {
    const categories: string[] = await window.electron.getLocalCategories();
    setCategoryOrder(categories);

    const tags = await window.electron.getSetting("localTags");
    if (Array.isArray(tags)) {
      setLocalTags(tags);
      // Group tags by category
      const grouped: Record<string, LocalTag[]> = {};
      for (const tag of tags) {
        if (!grouped[tag.category]) grouped[tag.category] = [];
        grouped[tag.category].push(tag);
      }
      setGroupedLocalTags(grouped);
    }
  };

  // Load the local tags on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadLocalTags();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Preview background update when bgFile changes
  useEffect(() => {
    if (summary.bgFile) {
      window.electron.previewBackgroundUpdate({ background: summary.bgFile });
    }
  }, [summary.bgFile]);

  useEffect(() => {
    let cancelled = false;
    if (summary.id) {
      window.electron.idToBackgroundFolder(summary.id).then((folder) => {
        if (!cancelled) setHasBackgroundFolder(!!folder);
      });
    } else {
      setHasBackgroundFolder(false);
    }
    return () => {
      cancelled = true;
    };
  }, [summary.id]);

  // If set file is a .lnk default to saving as a shortcut.
  useEffect(() => {
    (async () => {
      if (summary.bgFile) {
        const isShortcut =
          summary.bgFile.toLowerCase().endsWith(".lnk") ||
          (await window.electron.getFileType(summary.bgFile)) ===
            "application/x-ms-shortcut";
        setSaveBgFileAsShortcut(isShortcut);
      } else {
        setSaveBgFileAsShortcut(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (summary.bgFile) {
        // Always resolve to get the real file type for actual background file
        const resolvedPath = await window.electron.resolveShortcut(
          summary.bgFile
        );
        const type = await window.electron.getFileType(resolvedPath);

        if (!cancelled) {
          setBgFileType(type);
        }
      } else {
        setBgFileType(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [summary.bgFile]);

  // Tag toggles
  const handleTagToggle = (tag: string) => {
    setSummary((prev) => ({
      ...prev,
      tags: prev.tags?.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...(prev.tags || []), tag],
    }));
  };

  const handlePersonalTagToggle = (tag: string) => {
    setSummary((prev) => ({
      ...prev,
      localTags: prev.localTags?.includes(tag)
        ? prev.localTags.filter((t) => t !== tag)
        : [...(prev.localTags || []), tag],
    }));
  };

  const handleClose = () => {
    logger.info("Closing EditBackground");
    window.electron.reloadBackground();
    //window.electron.openBackgroundSelect(summary.id); disabled until works.
    window.electron.openBackgroundSelect();
  };

  // Save handler
  const handleSave = async (applyBg: boolean) => {
    logger.info("Attempting to save...");

    const updatedSummary = { ...summary };

    // If new background, generate a unique id Do not change ID for existing backgrounds
    if (!updatedSummary.id || updatedSummary.id === "") {
      let base = updatedSummary.name?.trim() || "";
      if (!base) {
        // No name -> fallback to a 6+ digit numerical id
        let num = await window.electron.getSetting("newBackgroundID");
        if (typeof num !== "number" || num < 0) {
          num = 1;
        }
        let numId =
          num < 1000000 ? num.toString().padStart(6, "0") : num.toString();
        while (ids.has(numId)) {
          num++;
          numId =
            num < 1000000 ? num.toString().padStart(6, "0") : num.toString();
        }
        updatedSummary.id = numId;
        await window.electron.saveSettingsData({
          newBackgroundID: num + 1,
        });
      } else {
        // Use name as the base for the ID
        base = base.toLowerCase();
        updatedSummary.id = generateUniqueId(base, ids);
      }
    }

    if (updatedSummary.bgFile) {
      let bgFilePath = updatedSummary.bgFile;
      const bgFileType = await window.electron.getFileType(bgFilePath);

      // If saving as file (not shortcut), resolve shortcut to source file so we can get the raw file
      if (
        (bgFileType === "application/x-ms-shortcut" ||
          bgFilePath.toLowerCase().endsWith(".lnk")) &&
        !saveBgFileAsShortcut
      ) {
        const resolved = await window.electron.resolveShortcut(bgFilePath);
        if (resolved) {
          bgFilePath = resolved;
        }
      }

      if (
        bgFileType.startsWith("image") ||
        bgFileType.startsWith("video") ||
        bgFileType === "application/x-ms-shortcut" // previously saved shortcut
      ) {
        updatedSummary.bgFile = await saveFileToBackground(
          updatedSummary.id,
          bgFilePath,
          bgFileType.startsWith("image") ||
            bgFileType === "application/x-ms-shortcut" // Save images or shortcuts to folder.
            ? true
            : !saveBgFileAsShortcut // User choice for videos.
        );
      } else {
        logger.error("Invalid file type for bgFile:", bgFileType);
        await showSmallWindow(
          "Invalid File Type",
          `Selected Background File Path is not an image or video, it is a [${bgFileType}] type` +
            "\nPlease select a valid image or video file.",
          ["OK"]
        );
        return;
      }
    }

    if (updatedSummary.iconPath) {
      const iconPathType = await window.electron.getFileType(
        updatedSummary.iconPath
      );
      if (iconPathType.startsWith("image")) {
        updatedSummary.iconPath = await saveFileToBackground(
          updatedSummary.id,
          updatedSummary.iconPath,
          true // icons always save file to background folder
        );
      } else {
        await showSmallWindow(
          "Invalid File Type",
          `Selected Icon File Path is not an image, it is a ${iconPathType} type` +
            "\nPlease select a valid image file.",
          ["OK"]
        );
        return;
      }
    }

    const success = await window.electron.saveBgJson(updatedSummary);
    if (success) {
      logger.info("Background saved successfully.");
      // if saved location changed, move background file
      if (saveLocation !== originalSaveLocationRef.current) {
        logger.info(
          `Save location changed from ${originalSaveLocationRef.current} to ${saveLocation}, moving background...`
        );
        const newId = await window.electron.changeBackgroundDirectory(
          updatedSummary.id,
          saveLocation
        );
        if (newId) {
          updatedSummary.id = newId;
        }
      }
      if (applyBg) {
        await window.electron.saveSettingsData({
          background: updatedSummary.id,
        });
      }
      handleClose();
    } else {
      logger.error("Failed to save background.");
    }
  };

  const saveFileToBackground = async (
    id: string,
    pathValue: string | undefined,
    saveFile: boolean
  ): Promise<string | undefined> => {
    if (!pathValue) return pathValue;
    const localPath = await window.electron.saveToBackgroundIDFile(
      id,
      pathValue,
      saveFile
    );
    if (localPath) {
      return localPath;
    } else {
      logger.error("Failed to save image:", pathValue);
      return undefined;
    }
  };

  /**
   * Generate a unique background ID based on a base string and a Set of existing IDs.
   * If the base exists, appends _1, _2, etc. until unique.
   */
  function generateUniqueId(base: string, ids: Set<string>): string {
    if (!ids.has(base)) return base;
    let counter = 1;
    let newId = `${base}_${counter}`;
    while (ids.has(newId)) {
      counter++;
      newId = `${base}_${counter}`;
    }
    return newId;
  }

  const handleFileDrop = async (
    event: React.DragEvent<HTMLInputElement>,
    field: "bgFile" | "iconPath"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      let filePath = await window.electron.getFilePath(files[0]);
      filePath = await window.electron.resolveShortcut(filePath); // Resolve any shortcuts
      if (filePath) {
        setSummary((prev) => ({ ...prev, [field]: filePath }));
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleFileDialog = async (field: "bgFile" | "iconPath") => {
    const type = field === "bgFile" ? "image,video" : "image";
    const filePath = await window.electron.openFileDialog(type);
    if (filePath) {
      setSummary((prev) => ({ ...prev, [field]: filePath }));
    }
  };

  const handleInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "bgFile" | "iconPath"
  ) => {
    let value = e.target.value;
    // If the path ends with .lnk, resolve the shortcut
    if (value.trim().toLowerCase().endsWith(".lnk")) {
      const resolved = await window.electron.resolveShortcut(value);
      if (resolved) value = resolved;
    }
    setSummary((prev) => ({ ...prev, [field]: value }));
  };

  const handleGlassClick = async (type: "bgFile" | "iconPath") => {
    const folder = await window.electron.idToBackgroundFolder(summary.id);
    logger.info(`Opening background folder for ${type}:`, folder);
    if (folder) {
      const fileType = type === "bgFile" ? "image,video" : "image";
      const filePath = await window.electron.openFileDialog(fileType, folder);
      if (filePath) {
        setSummary((prev) => ({ ...prev, [type]: filePath }));
      }
    }
  };

  const handleAddTagClick = () => {
    setShowAddTag(true);
    logger.info("Add tag clicked");
  };
  const handleCloseAddTag = () => {
    setShowAddTag(false);
    loadLocalTags(); // Refresh tags after closing modal
  };
  const handleCategoriesClick = () => {
    logger.info("Categories clicked");
    setShowEditCategories(true);
  };
  const handleCloseEditCategories = () => {
    setShowEditCategories(false);
    loadLocalTags(); // Refresh tags after closing modal
  };

  const handleDragStart = (tag: LocalTag, fromCategory: string) => {
    setDraggedTag({ tag, fromCategory });
  };

  const handleDragEnd = () => {
    setDraggedTag(null);
    setDragOverCategory(null);
  };

  const handleDragOverCategory = (category: string) => {
    setDragOverCategory(category);
  };

  const handleDropOnCategory = async (category: string) => {
    if (draggedTag && draggedTag.fromCategory !== category) {
      logger.info(`${draggedTag.tag.name} dropped into ${category}`);
      await window.electron.updateLocalTag(draggedTag.tag.name, {
        ...draggedTag.tag,
        category,
      });
      await loadLocalTags();
    }
    setDraggedTag(null);
    setDragOverCategory(null);
  };

  const handleDeleteTag = async (tag: LocalTag, category: string) => {
    const response = await showSmallWindow(
      "Delete Tag",
      `Are you sure you want to delete  ${tag.name} in category: ${category}?`,
      ["Delete", "Cancel"]
    );
    if (response === "Delete") {
      logger.info(`Delete tag: ${tag.name} in category: ${category}`);
      await window.electron.deleteLocalTag(tag.name);
      loadLocalTags();
      setTagContextMenu(null);
    }
  };

  const handleToggleFavorite = async (tag: LocalTag) => {
    const updatedTag = { ...tag, favorite: !tag.favorite };
    logger.info(
      `${updatedTag.favorite ? "Favorite" : "Unfavorite"} tag: ${tag.name}`
    );
    await window.electron.updateLocalTag(tag.name, updatedTag);
    await loadLocalTags();
  };

  const [renameModal, setRenameModal] = useState<{
    tag: LocalTag;
    category: string;
  } | null>(null);

  // Handler for starting edit
  const handleRenameTag = (tag: LocalTag, category: string) => {
    setRenameModal({ tag, category });
    setTagContextMenu(null);
  };

  // Handler for finishing edit
  const handleFinishRenameTag = async (newName: string) => {
    if (renameModal?.tag.name === newName) {
      logger.info("No change in tag name, skipping rename.");
      setRenameModal(null);
      return;
    }
    await window.electron.renameLocalTag(renameModal?.tag.name ?? "", newName);
    logger.info(
      `Renamed tag: ${renameModal?.tag.name} -> ${newName} in category: ${renameModal?.category}`
    );
    // Update summary.localTags (unselects old tag name, selects new name)
    setSummary((prev) => ({
      ...prev,
      localTags: prev.localTags?.map((t) =>
        t === renameModal?.tag.name ? newName : t
      ),
    }));
    await loadLocalTags();
    setRenameModal(null);
  };

  const handleCancelRenameTag = () => {
    setRenameModal(null);
  };

  useEffect(() => {
    if (!tagContextMenu) return;
    const closeMenu = () => setTagContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [tagContextMenu]);

  const filteredGroupedLocalTags = React.useMemo(() => {
    if (!localTagSearch.trim()) return groupedLocalTags;
    const search = localTagSearch.trim().toLowerCase();
    const filtered: Record<string, LocalTag[]> = {};
    for (const [category, tags] of Object.entries(groupedLocalTags)) {
      if (category.toLowerCase().includes(search)) {
        // If category matches, show all tags in it
        filtered[category] = tags;
      } else {
        // Otherwise, only show tags that match
        const filteredTags = tags.filter((tag) =>
          tag.name.toLowerCase().includes(search)
        );
        if (filteredTags.length > 0) {
          filtered[category] = filteredTags;
        }
      }
    }
    return filtered;
  }, [groupedLocalTags, localTagSearch]);

  useEffect(() => {
    (async () => {
      const paths = await window.electron.getSetting("externalPaths");
      if (Array.isArray(paths)) setExternalPaths(paths);

      if (summary.id && summary.id.startsWith("ext::")) {
        const match = summary.id.match(/^ext::(\d+)::/);
        if (match) {
          const extIdx = match[1];
          setSaveLocation(`external:${extIdx}`);
          originalSaveLocationRef.current = `external:${extIdx}`;
        }
      } else {
        setSaveLocation("default");
        originalSaveLocationRef.current = "default";
      }
    })();
  }, []);

  return (
    <div className="edit-background-root">
      <SubWindowHeader title="Edit Background" onClose={handleClose} />
      <div className="edit-background-main-content">
        {/* Left: Editable details panel */}
        <div className="edit-background-panel">
          <div className="details-row">
            <SafeImage
              imagePath={summary.iconPath ?? ""}
              width={128}
              height={128}
              className="panel-icon"
            />
          </div>
          <div className="edit-bg-field">
            <label>Name</label>
            <ClearableInput
              value={summary.name ?? ""}
              onChange={(e) =>
                setSummary((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter background name"
            />
          </div>
          <div className="edit-bg-field">
            <label>Description</label>
            <textarea
              value={summary.description ?? ""}
              onChange={(e) =>
                setSummary((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Enter background description"
            />
          </div>
          {bgFileType?.startsWith("video") && (
            <div className="edit-bg-field">
              <label>Save Background as:</label>
              <div className="edit-bg-field dropdown-container">
                <select
                  id="save-bg-method"
                  value={saveBgFileAsShortcut ? "shortcut" : "file"}
                  onChange={(e) =>
                    setSaveBgFileAsShortcut(e.target.value === "shortcut")
                  }
                >
                  <option value="file">Copy File</option>
                  <option value="shortcut">Shortcut</option>
                </select>
              </div>
            </div>
          )}
          <div className="edit-bg-field">
            <label>Background File Path</label>
            <div className="input-row">
              <input
                type="text"
                value={summary.bgFile ?? ""}
                placeholder="Drop an image or video on this field to set"
                onChange={(e) => handleInputChange(e, "bgFile")}
                onDragOver={handleDragOver}
                onDrop={(e) => handleFileDrop(e, "bgFile")}
              />
              <button
                type="button"
                className="file-select-button flex items-center gap-2"
                onClick={() => handleFileDialog("bgFile")}
                onMouseEnter={() => setIsHoveringBgFile(true)}
                onMouseLeave={() => setIsHoveringBgFile(false)}
                tabIndex={-1}
                title="Browse for background file"
              >
                {isHoveringBgFile ? (
                  <FolderOpenIcon className="custom-folder-icon" />
                ) : (
                  <FolderIcon className="custom-folder-icon" />
                )}
              </button>
              {hasBackgroundFolder && (
                <button
                  className="magnifying-glass-button flex items-center gap-2"
                  onClick={() => handleGlassClick("bgFile")}
                  onMouseEnter={() => setHoveringBackgroundGlass(true)}
                  onMouseLeave={() => setHoveringBackgroundGlass(false)}
                  title="Select from previously set background files"
                >
                  <MagnifyingGlassIcon
                    className={`custom-magnifying-glass-icon ${
                      isHoveringBackgroundGlass ? "hovered" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
          <div className="edit-bg-field">
            <label>Icon Preview Image</label>
            <div className="input-row">
              <input
                type="text"
                value={summary.iconPath ?? ""}
                placeholder="Drop an image on this field to set"
                onChange={(e) => handleInputChange(e, "iconPath")}
                onDragOver={handleDragOver}
                onDrop={(e) => handleFileDrop(e, "iconPath")}
              />
              <button
                type="button"
                className="file-select-button flex items-center gap-2"
                onClick={() => handleFileDialog("iconPath")}
                onMouseEnter={() => setIsHoveringIconPath(true)}
                onMouseLeave={() => setIsHoveringIconPath(false)}
                tabIndex={-1}
                title="Browse for icon image"
              >
                {isHoveringIconPath ? (
                  <FolderOpenIcon className="custom-folder-icon" />
                ) : (
                  <FolderIcon className="custom-folder-icon" />
                )}
              </button>
              {hasBackgroundFolder && (
                <button
                  className="magnifying-glass-button flex items-center gap-2"
                  onClick={() => handleGlassClick("iconPath")}
                  onMouseEnter={() => setHoveringIconGlass(true)}
                  onMouseLeave={() => setHoveringIconGlass(false)}
                  title="Select from previously set background files"
                >
                  <MagnifyingGlassIcon
                    className={`custom-magnifying-glass-icon ${
                      isHoveringIconGlass ? "hovered" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
          {externalPaths.length > 0 && (
            <div className="edit-bg-field">
              <label>Save to</label>
              <div className="edit-bg-field dropdown-container">
                <select
                  id="save-to-location"
                  value={saveLocation}
                  onChange={(e) => setSaveLocation(e.target.value)}
                >
                  <option value="default">Default save location</option>
                  {externalPaths.map((path, idx) => (
                    <option key={path} value={`external:${idx}`}>
                      {path}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        {/* Right: Tag management */}
        <div className="edit-background-tags-panel">
          <div className="search-header">
            <ClearableInput
              placeholder="Search tags..."
              value={localTagSearch}
              onChange={(e) => setLocalTagSearch(e.target.value)}
              flex={true}
            />
            <button
              type="button"
              className="button"
              onClick={handleAddTagClick}
            >
              Add Tag
            </button>
            <button
              type="button"
              className="button"
              onClick={handleCategoriesClick}
            >
              Categories
            </button>
          </div>
          {/* --- Public Tags --- */}
          <div className="edit-bg-field">
            <div
              className={
                "section-header  tag-category-header" +
                (collapsedPublicTags ? "" : " expanded")
              }
              style={{ cursor: "pointer" }}
              onClick={togglePublicTags}
            >
              <label className="edit-bg-label" style={{ marginBottom: 0 }}>
                Public Tags:
              </label>
              <button
                className="tag-toggle-button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePublicTags();
                }}
              >
                {collapsedPublicTags ? "▸" : "▾"}
              </button>
            </div>
            {!collapsedPublicTags && (
              <div className="tags-container">
                {filteredPublicTagCategories.map((catObj) => (
                  <div key={catObj!.name} className="public-tag-category-block">
                    <div
                      className="tag-category-header"
                      onClick={() => togglePublicCategory(catObj!.name)}
                      style={{ cursor: "pointer" }}
                    >
                      <button
                        className="tag-toggle-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePublicCategory(catObj!.name);
                        }}
                      >
                        {collapsedPublicCategories.has(catObj!.name)
                          ? "▸"
                          : "▾"}
                      </button>
                      <span>{catObj!.name}</span>
                    </div>
                    {!collapsedPublicCategories.has(catObj!.name) && (
                      <div className="tag-row">
                        {catObj!.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={
                              summary.tags?.includes(tag)
                                ? "tag-selected"
                                : "tag"
                            }
                            onClick={() => handleTagToggle(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* --- Local Tags --- */}
          <div className="edit-bg-field">
            <div
              className={
                "section-header tag-category-header" +
                (collapsedLocalTags ? "" : " expanded")
              }
              style={{ cursor: "pointer" }}
              onClick={toggleLocalTags}
            >
              <label className="edit-bg-label" style={{ marginBottom: 0 }}>
                Local Tags:
              </label>
              <button
                className="tag-toggle-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLocalTags();
                }}
              >
                {collapsedLocalTags ? "▸" : "▾"}
              </button>
            </div>
            {!collapsedLocalTags && (
              <div className="tags-container">
                <div
                  className={`tag-category-block${
                    dragOverCategory === "" ? " drag-over-category" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOverCategory("");
                  }}
                  onDrop={() => handleDropOnCategory("")}
                  onDragLeave={() => setDragOverCategory(null)}
                >
                  <div
                    className="tag-category-header"
                    onClick={() => toggleCategory("")}
                  >
                    <button
                      className="tag-toggle-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory("");
                      }}
                    >
                      {collapsedCategories.has("") ? "▸" : "▾"}
                    </button>
                    <span></span>
                  </div>
                  {!collapsedCategories.has("") && (
                    <div className="tag-grid">
                      {(filteredGroupedLocalTags[""] || []).map((tagObj) => (
                        <div
                          key={tagObj.name}
                          className={
                            "tag-checkbox-row draggable-tag" +
                            (summary.localTags?.includes(tagObj.name)
                              ? " selected"
                              : "") +
                            (draggedTag?.tag.name === tagObj.name
                              ? " dragging"
                              : "")
                          }
                          draggable
                          onDragStart={() => handleDragStart(tagObj, "")}
                          onDragEnd={handleDragEnd}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setTagContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              tag: tagObj,
                              category: "",
                            });
                          }}
                          onClick={() => handlePersonalTagToggle(tagObj.name)}
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            className="tag-checkbox"
                            checked={summary.localTags?.includes(tagObj.name)}
                            readOnly
                            tabIndex={-1}
                            id={`tag-checkbox--${tagObj.name}`}
                            style={{ pointerEvents: "none" }}
                          />
                          <label
                            className="tag-name"
                            htmlFor={`tag-checkbox--${tagObj.name}`}
                            title={tagObj.name}
                          >
                            {tagObj.name}
                          </label>
                          <span
                            className={
                              "tag-fav-star" +
                              (tagObj.favorite ? "" : " not-fav")
                            }
                            title={
                              tagObj.favorite ? "Favorite" : "Not favorite"
                            }
                            style={{ cursor: "pointer", marginLeft: "auto" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(tagObj);
                            }}
                          >
                            ★
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Render all other categories in order, even if empty */}
                {categoryOrder
                  .filter(
                    (category) =>
                      category !== "" &&
                      category !== "show" &&
                      (localTagSearch.trim()
                        ? filteredGroupedLocalTags[category] &&
                          filteredGroupedLocalTags[category].length > 0
                        : true)
                  )
                  .map((category) => {
                    const isCollapsed = collapsedCategories.has(category);
                    const isDragOver = dragOverCategory === category;
                    const tags = filteredGroupedLocalTags[category] || [];
                    return (
                      <div
                        key={category}
                        className={`tag-category-block${
                          isDragOver ? " drag-over-category" : ""
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          handleDragOverCategory(category);
                        }}
                        onDrop={() => handleDropOnCategory(category)}
                        onDragLeave={() => setDragOverCategory(null)}
                      >
                        <div
                          className="tag-category-header"
                          onClick={() => toggleCategory(category)}
                        >
                          <button
                            className="tag-toggle-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(category);
                            }}
                          >
                            {isCollapsed ? "▸" : "▾"}
                          </button>
                          <span>{category}</span>
                        </div>
                        {!isCollapsed && (
                          <div className="tag-grid">
                            {tags.map((tagObj) => (
                              <div
                                key={tagObj.name}
                                className={
                                  "tag-checkbox-row draggable-tag" +
                                  (summary.localTags?.includes(tagObj.name)
                                    ? " selected"
                                    : "") +
                                  (draggedTag?.tag.name === tagObj.name
                                    ? " dragging"
                                    : "")
                                }
                                draggable
                                onDragStart={() =>
                                  handleDragStart(tagObj, category)
                                }
                                onDragEnd={handleDragEnd}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setTagContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    tag: tagObj,
                                    category,
                                  });
                                }}
                                onClick={() =>
                                  handlePersonalTagToggle(tagObj.name)
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <input
                                  type="checkbox"
                                  className="tag-checkbox"
                                  checked={summary.localTags?.includes(
                                    tagObj.name
                                  )}
                                  readOnly
                                  tabIndex={-1}
                                  id={`tag-checkbox-${category}-${tagObj.name}`}
                                  style={{ pointerEvents: "none" }} // Prevent input from blocking row click
                                />
                                <label
                                  className="tag-name"
                                  htmlFor={`tag-checkbox-${category}-${tagObj.name}`}
                                  title={tagObj.name}
                                >
                                  {tagObj.name}
                                </label>
                                <span
                                  className={
                                    "tag-fav-star" +
                                    (tagObj.favorite ? "" : " not-fav")
                                  }
                                  title={
                                    tagObj.favorite
                                      ? "Favorite"
                                      : "Not favorite"
                                  }
                                  style={{
                                    cursor: "pointer",
                                    marginLeft: "auto",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent row click
                                    handleToggleFavorite(tagObj);
                                  }}
                                >
                                  ★
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="subwindow-footer">
        <button
          title="Save and set the background to this background"
          className="save-button"
          onClick={() => handleSave(true)}
        >
          Save & Apply
        </button>
        <button
          title="Save and do not set the background"
          className="save-button"
          onClick={() => handleSave(false)}
        >
          Save
        </button>
      </div>
      {showAddTag && (
        <div className="add-tag-modal-overlay" onClick={handleCloseAddTag}>
          <div
            className="add-tag-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <AddTagWindow onClose={handleCloseAddTag} />
          </div>
        </div>
      )}
      {showEditCategories && (
        <div
          className="edit-categories-modal-overlay"
          onClick={handleCloseEditCategories}
        >
          <div
            className="edit-categories-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <EditCategories onClose={handleCloseEditCategories} />
          </div>
        </div>
      )}
      {tagContextMenu && (
        <div
          className="context-menu"
          style={{
            position: "fixed",
            left: tagContextMenu.x,
            top: tagContextMenu.y,
            zIndex: 3000,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            className="menu-item"
            onClick={() =>
              handleRenameTag(tagContextMenu.tag, tagContextMenu.category)
            }
          >
            Rename
          </div>
          <div
            className="menu-item"
            onClick={() =>
              handleDeleteTag(tagContextMenu.tag, tagContextMenu.category)
            }
          >
            Delete
          </div>
        </div>
      )}
      {renameModal && (
        <div className="add-tag-modal-overlay" onClick={handleCancelRenameTag}>
          <div
            className="add-tag-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <RenameTagModal
              initialName={renameModal.tag.name}
              onRename={handleFinishRenameTag}
              onCancel={handleCancelRenameTag}
              existingNames={localTags.map((t) => t.name)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditBackground;
