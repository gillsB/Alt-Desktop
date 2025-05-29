import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
import { fileNameNoExt } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const PUBLIC_TAGS = ["These", "Are", "Official", "Tags", "Only"];
//These are local tags and would not be shared with bg.json (made by user).
const PERSONAL_TAGS = ["These", "Are", "local", "Tags"];

const EditBackground: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawParam = params.get("filePath");
  const initFilePath = !rawParam || rawParam === "undefined" ? "" : rawParam;
  logger.info("initFilePath = ", initFilePath);

  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [description, setDescription] = useState("");
  const [publicTags, setPublicTags] = useState<string[]>([]);
  const [personalTags, setPersonalTags] = useState<string[]>([]);

  useEffect(() => {
    if (initFilePath != "") {
      setFilePath(initFilePath);
      setName(fileNameNoExt(initFilePath));
    }
  }, []);

  useEffect(() => {
    const previewFilePath = async () => {
      await window.electron.previewBackgroundUpdate({ background: filePath });
    };
    previewFilePath();
  }, [filePath]);

  const handleTagToggle = (tag: string) => {
    setPublicTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePersonalTagToggle = (tag: string) => {
    setPersonalTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  //TODO make this re-call BackgroundSelect, and default to newly added (if saved) EditBackground
  const handleClose = () => {
    logger.info("Closing EditBackground");
    window.electron.reloadBackground();
    // TODO make sure to save settings to new background if user wants to apply it before calling this
    //re-open BackgroundSelect
    window.electron.openBackgroundSelect();
  };

  return (
    <div className="subwindow-container">
      <SubWindowHeader title="Edit Background" onClose={handleClose} />
      <div className="subwindow-content">
        <div className="subwindow-field">
          <label>Name:</label>
          <input
            type="text"
            value={name}
            placeholder="Background name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="subwindow-field">
          <label>File Path:</label>
          <input
            type="text"
            value={filePath}
            placeholder="Drop an image or video on this field to set"
            onChange={(e) => setFilePath(e.target.value)}
          />
        </div>
        <div className="subwindow-field">
          <label>Icon:</label>
          <div className="icon-input-row">
            <input
              type="text"
              className="icon-path-input"
              placeholder="Drop an image on this field to set"
            />
          </div>
        </div>
        <div className="subwindow-field">
          <label>Description:</label>
          <textarea
            value={description}
            placeholder="Short description"
            onChange={(e) => setDescription(e.target.value)}
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
                className={publicTags.includes(tag) ? "tag-selected" : "tag"}
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
                className={personalTags.includes(tag) ? "tag-selected" : "tag"}
                onClick={() => handlePersonalTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBackground;
