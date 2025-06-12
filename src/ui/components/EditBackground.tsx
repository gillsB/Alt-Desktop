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
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

//These are local tags and would not be shared with bg.json (made by user).
const PERSONAL_TAGS = ["These", "Are", "local", "Tags"];

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

  const [ids, setIds] = useState<Set<string>>(new Set<string>());
  const [isHoveringBgFile, setIsHoveringBgFile] = useState(false);
  const [isHoveringIconPath, setIsHoveringIconPath] = useState(false);
  const [hasBackgroundFolder, setHasBackgroundFolder] = useState(false);
  const [isHoveringBackgroundGlass, setHoveringBackgroundGlass] =
    useState(false);
  const [isHoveringIconGlass, setHoveringIconGlass] = useState(false);

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
    if (updatedSummary.id === "") {
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

  return (
    <div className="subwindow-container">
      <SubWindowHeader title="Edit Background" onClose={handleClose} />
      <div className="subwindow-content">
        <div className="subwindow-field">
          <label>Name:</label>
          <input
            type="text"
            value={summary.name ?? ""}
            placeholder="Background name"
            onChange={(e) =>
              setSummary((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </div>
        <div className="subwindow-field">
          <label>Background File Path:</label>
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
        {bgFileType?.startsWith("video") && (
          <div className="subwindow-field dropdown-container">
            <label htmlFor="save-bg-method">Save Background as:</label>
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
        )}

        <div className="subwindow-field">
          <label>Icon Preview Image:</label>
          <input
            type="text"
            value={summary.iconPath ?? ""}
            placeholder="Drop an image on this field to set"
            onChange={(e) => handleInputChange(e, "iconPath")}
            onDragOver={handleDragOver}
            onDrop={(e) => handleFileDrop(e, "iconPath")}
          />
          <button
            className="file-select-button flex items-center gap-2"
            onClick={() => handleFileDialog("iconPath")}
            onMouseEnter={() => setIsHoveringIconPath(true)}
            onMouseLeave={() => setIsHoveringIconPath(false)}
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
        <div className="subwindow-field">
          <label>Description:</label>
          <textarea
            value={summary.description ?? ""}
            placeholder="Short description"
            onChange={(e) =>
              setSummary((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={2}
          />
        </div>
        <div className="subwindow-field">
          <label>Public Tags:</label>
          <div className="tag-row">
            {PUBLIC_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={summary.tags?.includes(tag) ? "tag-selected" : "tag"}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="subwindow-field">
          <label>Personal Tags:</label>
          <div className="tag-row">
            {PERSONAL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={
                  summary.localTags?.includes(tag) ? "tag-selected" : "tag"
                }
                onClick={() => handlePersonalTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="subwindow-footer">
        <button className="save-button" onClick={() => handleSave(true)}>
          Save & Apply
        </button>
        <button className="save-button" onClick={() => handleSave(false)}>
          Save
        </button>
      </div>
    </div>
  );
};

export default EditBackground;
