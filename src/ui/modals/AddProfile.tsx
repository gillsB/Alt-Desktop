import React, { useEffect, useMemo, useState } from "react";
import "../styles/AddProfile.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("AddProfile.tsx");

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;

interface AddProfileFormProps {
  profiles: string[];
  copyEnabled: boolean;
  onCopyChange: (enabled: boolean) => void;
  onCreate: (name: string, copyFrom?: string) => void;
  onCancel?: () => void;
}

const AddProfileForm: React.FC<AddProfileFormProps> = ({
  profiles,
  copyEnabled,
  onCopyChange,
  onCreate,
  onCancel,
}) => {
  const [profileInput, setProfileInput] = useState("");
  const [duplicateError, setDuplicateError] = useState(false);
  const [copyFromProfile, setCopyFromProfile] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  useEffect(() => {
    const trimmed = profileInput.trim().toLowerCase();
    const isReserved = trimmed === "desktop_cache";
    setDuplicateError(
      trimmed.length > 0 &&
        (isReserved || profiles.some((p) => p.toLowerCase() === trimmed))
    );
  }, [profileInput, profiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(INVALID_FOLDER_CHARS, "");
    setProfileInput(sanitized);
  };

  const handleCreate = async () => {
    if (!profileInput.trim()) {
      await showSmallWindow(
        "Invalid Profile Name",
        "Profile name cannot be empty.",
        ["Okay"]
      );
      return;
    }
    logger.info(
      `Attempting to create profile ${profileInput.trim()} copyFrom=${
        copyEnabled ? copyFromProfile : undefined
      }`
    );
    onCreate(
      profileInput.trim(),
      copyEnabled ? copyFromProfile || undefined : undefined
    );
  };

  const filteredProfiles = useMemo(() => {
    let list = profiles.filter((p) => p !== profileInput.trim());
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter((p) => p.toLowerCase().includes(lower));
    }
    return list;
  }, [profiles, searchText, profileInput]);

  return (
    <div className="add-profile-form">
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
              if (e.key === "Enter") handleCreate();
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
        <label>Copy from profile</label>
        <input
          type="checkbox"
          checked={copyEnabled}
          onChange={(e) => onCopyChange(e.target.checked)}
        />
      </div>

      {copyEnabled && (
        <div className="copy-section">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search profiles"
            className="create-tag-input"
          />
          <div className="copy-list">
            <ul>
              {filteredProfiles.map((p) => (
                <li
                  key={p}
                  className={`profile-item${p === copyFromProfile ? " selected" : ""}`}
                  onClick={() => setCopyFromProfile(p)}
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="modal-window-footer">
        <button
          className="button"
          onClick={handleCreate}
          disabled={duplicateError}
        >
          Create Profile
        </button>
        <button className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const AddProfileWindow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [copyEnabled, setCopyEnabled] = useState<boolean>(false);

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
    };
    fetchProfiles();
  }, []);

  const handleCreate = async (name: string, copyFrom?: string) => {
    logger.info(`Creating profile ${name} copyFrom=${copyFrom}`);
    await window.electron.ensureProfileFolder(name, copyFrom);
    onClose?.();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`add-tag-modal-content${!copyEnabled ? " compact" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-window-content">
          <div className="modal-content">
            <AddProfileForm
              profiles={profiles}
              copyEnabled={copyEnabled}
              onCopyChange={setCopyEnabled}
              onCreate={handleCreate}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProfileWindow;
