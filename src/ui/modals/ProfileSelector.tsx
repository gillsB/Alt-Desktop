import React, { useCallback, useEffect, useState } from "react";
import ClearableInput from "../components/ClearableInput";
import "../styles/ManageProfiles.css";
import { createLogger } from "../util/uiLogger";

// Stripped down ManageProfiles (no destruction, creation, changing, just returns profile as string)

const logger = createLogger("ProfileSelector.tsx");

interface ProfileSelectorProps {
  currentProfile: string;
  onClose: (selectedProfile: string) => void;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  currentProfile,
  onClose,
}) => {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [searchText, setSearchText] = useState<string>("");
  const [selectedProfile, setSelectedProfile] =
    useState<string>(currentProfile);

  const fetchProfiles = useCallback(async () => {
    try {
      let result = await window.electron.getProfiles();
      if (!result) result = [];

      // sort alphabetically
      result.sort((a, b) => a.localeCompare(b));
      setProfiles(result);
      setSelectedProfile(currentProfile);
    } catch (e) {
      logger.error("Failed to fetch profiles", e);
    }
  }, [currentProfile]);

  const handleClose = () => {
    onClose(selectedProfile);
  };

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        e.stopPropagation();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [selectedProfile]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleProfileClick = (profile: string) => {
    setSelectedProfile(profile);
  };

  const filteredProfiles = profiles.filter((p) =>
    p.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="manage-profiles-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-window-content">
          <div className="modal-content">
            <div className="manage-profiles-upper">
              <div className="subwindow-field">
                <ClearableInput
                  value={searchText}
                  onChange={handleSearchChange}
                  onClear={() => setSearchText("")}
                  placeholder="Search profiles"
                  inputClassName="manage-profiles-search"
                />
              </div>

              <div className="manage-profiles-list">
                {filteredProfiles.length === 0 ? (
                  <div className="no-results">No profiles match</div>
                ) : (
                  <ul>
                    {filteredProfiles.map((profile, idx) => (
                      <li
                        key={`profile-${profile}-${idx}`}
                        className={`profile-item${
                          profile === selectedProfile ? " selected" : ""
                        }`}
                        onClick={() => handleProfileClick(profile)}
                      >
                        <span className="profile-text">
                          {profile === "default" ? "Default" : profile}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-window-footer">
          <button className="button" onClick={handleClose}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelector;
