import {
  FolderIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PUBLIC_TAGS } from "../../electron/publicTags";
import "../App.css";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import EditTagsWindow from "./EditTags";
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

  const [showEditTags, setShowEditTags] = useState(false);

  const [ids, setIds] = useState<Set<string>>(new Set<string>());
  const [isHoveringBgFile, setIsHoveringBgFile] = useState(false);
  const [isHoveringIconPath, setIsHoveringIconPath] = useState(false);
  const [hasBackgroundFolder, setHasBackgroundFolder] = useState(false);
  const [isHoveringBackgroundGlass, setHoveringBackgroundGlass] =
    useState(false);
  const [isHoveringIconGlass, setHoveringIconGlass] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localTags, setLocalTags] = useState<LocalTag[]>([]);
  const [groupedLocalTags, setGroupedLocalTags] = useState<
    Record<string, LocalTag[]>
  >({});

  const [localTagSearch, setLocalTagSearch] = useState("");

  const [draggedTag, setDraggedTag] = useState<{
    tag: LocalTag;
    fromCategory: string;
  } | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

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

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) newSet.delete(category);
      else newSet.add(category);
      return newSet;
    });
  };

  // Fetch and group by category
  const fetchLocalTags = async () => {
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
  fetchLocalTags();

  // Fetch categories and tags on mount
  useEffect(() => {
    let cancelled = false;
    const fetchCategoriesAndTags = async () => {
      const categories: string[] = await window.electron.getTagCategories();
      if (!cancelled) setCategoryOrder(categories);

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
    fetchCategoriesAndTags();
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

  useEffect(() => {
    let cancelled = false;
    if (summary.bgFile) {
      window.electron.getFileType(summary.bgFile).then((type: string) => {
        if (!cancelled) {
          setBgFileType(type);
          // Default to shortcut for videos, file for images
          setSaveBgFileAsShortcut(type.startsWith("video"));
        }
      });
    } else {
      setBgFileType(null);
    }
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
      const bgFileType = await window.electron.getFileType(
        updatedSummary.bgFile
      );
      if (
        bgFileType.startsWith("image") ||
        bgFileType.startsWith("video") ||
        bgFileType === "application/x-ms-shortcut" // previously saved shortcut
      ) {
        updatedSummary.bgFile = await saveFileToBackground(
          updatedSummary.id,
          updatedSummary.bgFile,
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
    setShowEditTags(true);
    logger.info("Add tag clicked");
  };
  const handleCategoriesClick = () => {
    logger.info("Categories clicked");
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
      await fetchLocalTags(); // Refresh tags/categories
    }
    setDraggedTag(null);
    setDragOverCategory(null);
  };

  const handleRenameTag = (tag: LocalTag, category: string) => {
    logger.info(`Rename tag: ${tag.name} in category: ${category}`);
    setTagContextMenu(null);
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
      setTagContextMenu(null);
    }
  };

  useEffect(() => {
    if (!tagContextMenu) return;
    const closeMenu = () => setTagContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [tagContextMenu]);

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
            <input
              type="text"
              value={summary.name ?? ""}
              onChange={(e) =>
                setSummary((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className="edit-bg-field">
            <label>Description</label>
            <textarea
              value={summary.description ?? ""}
              onChange={(e) =>
                setSummary((prev) => ({ ...prev, description: e.target.value }))
              }
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
                  <option value="shortcut">Shortcut (recommended)</option>
                  <option value="file">Copy File</option>
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
        </div>
        {/* Right: Tag management */}
        <div className="edit-background-tags-panel">
          <div className="edit-bg-field">
            <label className="edit-bg-label">Public Tags:</label>
            <div className="tag-row">
              {PUBLIC_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={
                    summary.tags?.includes(tag) ? "tag-selected" : "tag"
                  }
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="local-tags">
            <div className="local-tags-header input-row">
              <label style={{ marginRight: 8 }}>Local Tags:</label>
              <input
                type="text"
                placeholder="Search tags..."
                value={localTagSearch}
                onChange={(e) => setLocalTagSearch(e.target.value)}
              />
              <button
                type="button"
                className="button"
                style={{ marginLeft: 8 }}
                onClick={handleAddTagClick}
              >
                Add Tag
              </button>
              <button
                type="button"
                className="button"
                style={{ marginLeft: 8 }}
                onClick={handleCategoriesClick}
              >
                Categories
              </button>
              <div>
                <div
                  className={`tag-category-block${dragOverCategory === "" ? " drag-over-category" : ""}`}
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
                    <span></span>
                    <button
                      className="tag-toggle-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory("");
                      }}
                    >
                      {collapsedCategories.has("") ? "▸" : "▾"}
                    </button>
                  </div>
                  {!collapsedCategories.has("") && (
                    <div className="tag-grid">
                      {(groupedLocalTags[""] || []).map((tagObj) => (
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
                        >
                          <input
                            type="checkbox"
                            className="tag-checkbox"
                            checked={summary.localTags?.includes(tagObj.name)}
                            onChange={() =>
                              handlePersonalTagToggle(tagObj.name)
                            }
                            id={`tag-checkbox--${tagObj.name}`}
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
                  .filter((category) => category !== "")
                  .map((category) => {
                    const isCollapsed = collapsedCategories.has(category);
                    const isDragOver = dragOverCategory === category;
                    const tags = groupedLocalTags[category] || [];
                    return (
                      <div
                        key={category}
                        className={`tag-category-block${isDragOver ? " drag-over-category" : ""}`}
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
                          <span>{category}</span>
                          <button
                            className="tag-toggle-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(category);
                            }}
                          >
                            {isCollapsed ? "▸" : "▾"}
                          </button>
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
                              >
                                <input
                                  type="checkbox"
                                  className="tag-checkbox"
                                  checked={summary.localTags?.includes(
                                    tagObj.name
                                  )}
                                  onChange={() =>
                                    handlePersonalTagToggle(tagObj.name)
                                  }
                                  id={`tag-checkbox-${category}-${tagObj.name}`}
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
            </div>
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
      {showEditTags && (
        <div
          className="edit-tags-modal-overlay"
          onClick={() => setShowEditTags(false)}
        >
          <div
            className="edit-tags-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <EditTagsWindow onClose={() => setShowEditTags(false)} />
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
    </div>
  );
};

export default EditBackground;
