import React, { useEffect, useState } from "react";
import "../styles/AddProfile.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("AddProfile.tsx");

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;

const AddProfileWindow: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [profileInput, setProfileInput] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [duplicateError, setDuplicateError] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>("default");

  useEffect(() => {
    const fetchProfiles = async () => {
      const result = await window.electron.getProfiles();
      let sortedProfiles: string[] = [];
      if (result && result.length > 0) {
        const filtered = result.filter((p) => p !== "default");
        sortedProfiles = [
          "default",
          ...filtered.sort((a, b) => a.localeCompare(b)),
        ];
      }
      setProfiles(sortedProfiles);
      setSelectedProfile("default"); // Always default to "Default"
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    const trimmed = profileInput.trim().toLowerCase();
    setDuplicateError(
      trimmed.length > 0 && profiles.some((p) => p.toLowerCase() === trimmed)
    );
  }, [profileInput, profiles]);

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
    if (selectedProfile) {
      logger.info(
        "Attempted to make profile: " +
          profileInput.trim() +
          "and copying from profile: " +
          selectedProfile
      );
    } else {
      logger.info("Attempted to make profile: " + profileInput.trim());
    }
    await window.electron.ensureProfileFolder(
      profileInput.trim(),
      selectedProfile
    );
    onClose?.();
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <div className="profile-field">
          <div className="profile-input-row">
            <label>Profile Name:</label>
            <input
              type="text"
              value={profileInput}
              onChange={handleInputChange}
              placeholder="Enter new profile name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose?.();
                if (e.key === "Enter") handleCreateProfile();
              }}
            />
          </div>
          <div className="error-space">
            {duplicateError && (
              <div className="add-profile-inline-error">
                That profile already exists
              </div>
            )}
          </div>
        </div>
        <div className="subwindow-field">
          <label>Copy from:</label>
          <div className="dropdown-container">
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="create-tag-input"
              style={{ width: "100%" }}
            >
              <option value="">None (Fresh)</option>
              {profiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile === "default" ? "Default" : profile}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="modal-window-footer">
        <button
          className="button"
          onClick={handleCreateProfile}
          disabled={duplicateError}
        >
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
