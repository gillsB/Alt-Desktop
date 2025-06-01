import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const PUBLIC_TAGS = ["These", "Are", "Official", "Tags", "Only"];
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
        // No name -> fallback to a 6-digit numerical id
        let num = 1;
        let numId = num.toString().padStart(6, "0");
        while (ids.has(numId)) {
          num++;
          numId = num.toString().padStart(6, "0");
        }
        updatedSummary.id = numId;
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
      if (bgFileType.startsWith("image") || bgFileType.startsWith("video")) {
        updatedSummary.bgFile = await saveFileToBackground(
          updatedSummary.id,
          updatedSummary.bgFile,
          bgFileType.startsWith("image") ? true : !saveBgFileAsShortcut // true for images, user choice for videos
        );
      } else {
        logger.error("Invalid file type for bgFile:", bgFileType);
        await showSmallWindow(
          "Invalid File Type",
          `Selected Background File Path is not an image or video, it is a ${bgFileType} type` +
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
            placeholder="Drop an image or video on this field to set (not implemented yet)"
            onChange={(e) =>
              setSummary((prev) => ({ ...prev, bgFile: e.target.value }))
            }
          />
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
          <label>Icon:</label>
          <div className="icon-input-row">
            <input
              type="text"
              className="icon-path-input"
              value={summary.iconPath ?? ""}
              placeholder="Drop an image on this field to set (not implemented yet)"
              onChange={(e) =>
                setSummary((prev) => ({ ...prev, iconPath: e.target.value }))
              }
            />
          </div>
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
