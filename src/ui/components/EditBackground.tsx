import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
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
        filename: "",
        tags: [],
        localTags: [],
      };

  const [summary, setSummary] = useState<BackgroundSummary>(initialSummary);

  // Preview background update when filename changes
  useEffect(() => {
    if (summary.filename) {
      window.electron.previewBackgroundUpdate({ background: summary.filename });
    }
  }, [summary.filename]);

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

  //TODO make this re-call BackgroundSelect, and default to newly added (if saved) EditBackground
  const handleClose = () => {
    logger.info("Closing EditBackground");
    window.electron.reloadBackground();
    // TODO make sure to save settings to new background if user wants to apply it before calling this
    //re-open BackgroundSelect
    window.electron.openBackgroundSelect();
  };

  // Save handler
  const handleSave = async () => {
    logger.info("Attempting to save...");
    const success = await window.electron.saveBgJson(summary);
    if (success) {
      logger.info("Background saved successfully.");
      handleClose();
    } else {
      logger.error("Failed to save background.");
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
          <label>File Path:</label>
          <input
            type="text"
            value={summary.filename ?? ""}
            placeholder="Drop an image or video on this field to set (not implemented yet)"
            onChange={(e) =>
              setSummary((prev) => ({ ...prev, filename: e.target.value }))
            }
          />
        </div>
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
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default EditBackground;
