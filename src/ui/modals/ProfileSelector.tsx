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
  const [pinnedProfile] = useState<string>(currentProfile);

  const fetchProfiles = useCallback(async () => {
    try {
      let result = await window.electron.getProfiles();
      if (!result) result = [];

      // sort alphabetically
      const hasPinned = pinnedProfile && result.includes(pinnedProfile);
      const others = hasPinned
        ? result.filter((p) => p !== pinnedProfile)
        : [...result];
      others.sort((a, b) => a.localeCompare(b));
      const ordered = hasPinned ? [pinnedProfile, ...others] : others;
      setProfiles(ordered);
    } catch (e) {
      logger.error("Failed to fetch profiles", e);
    }
  }, [pinnedProfile]);

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
  }, [selectedProfile, pinnedProfile]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleProfileClick = (profile: string) => {
    setSelectedProfile(profile);
  };

  let filteredProfiles = profiles.filter((p) =>
    p.toLowerCase().includes(searchText.toLowerCase())
  );

  if (searchText) {
    filteredProfiles = filteredProfiles.filter(
      (p) => p !== selectedProfile || p === pinnedProfile
    );
  }

  const topProfiles: string[] = [];

  if (pinnedProfile && filteredProfiles.includes(pinnedProfile)) {
    topProfiles.push(pinnedProfile);
  }
  if (
    selectedProfile &&
    selectedProfile !== pinnedProfile &&
    filteredProfiles.includes(selectedProfile)
  ) {
    topProfiles.push(selectedProfile);
  }

  const restProfiles = filteredProfiles.filter((p) => !topProfiles.includes(p));

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
              <div className="manage-profiles-top-section">
                <ul>
                  {topProfiles.map((profile, idx) => (
                    <li
                      key={`top-${profile}-${idx}`}
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
              </div>

              {restProfiles.length > 0 && topProfiles.length > 0 && (
                <div className="profile-separator-section" />
              )}

              <div className="manage-profiles-list">
                {restProfiles.length === 0 && filteredProfiles.length === 0 ? (
                  <div className="no-results">No profiles match</div>
                ) : (
                  <ul>
                    {restProfiles.map((profile, idx) => (
                      <li
                        key={`rest-${profile}-${idx}`}
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
