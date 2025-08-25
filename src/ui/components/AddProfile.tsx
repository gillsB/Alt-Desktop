import React, { useState } from "react";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("addProfile.tsx");

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;

const AddProfileWindow: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [profileInput, setProfileInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove invalid folder characters as user types
    const sanitized = e.target.value.replace(INVALID_FOLDER_CHARS, "");
    setProfileInput(sanitized);
  };

  const handleCreateProfile = async () => {
    if (!profileInput.trim()) {
      await showSmallWindow(
        "Invalid Profile Name",
        "Profile name cannot be empty.",
        ["Okay"]
      );
      return;
    }
    logger.info("Attempted to make profile: " + profileInput.trim());
    await window.electron.ensureProfileFolder(profileInput.trim());
    onClose?.();
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <div className="subwindow-field">
          <label>Profile Name:</label>
          <input
            type="text"
            value={profileInput}
            onChange={handleInputChange}
            placeholder="Enter new profile name"
            className="create-tag-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose?.();
              if (e.key === "Enter") handleCreateProfile();
            }}
          />
        </div>
      </div>
      <div className="modal-window-footer">
        <button className="button" onClick={handleCreateProfile}>
          Create Profile
        </button>
        <button className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AddProfileWindow;
