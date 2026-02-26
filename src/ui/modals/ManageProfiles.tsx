import React, { useEffect, useState } from "react";
import "../styles/ManageProfiles.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("ManageProfiles.tsx");

interface ManageProfilesProps {
  currentProfile: string;
  onClose: () => void;
  onSelectProfile: (profile: string) => void;
}

const ManageProfiles: React.FC<ManageProfilesProps> = ({
  currentProfile,
  onClose,
  onSelectProfile,
}) => {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [searchText, setSearchText] = useState<string>("");
  const [selectedProfile, setSelectedProfile] =
    useState<string>(currentProfile);
  const [pinnedProfile, setPinnedProfile] = useState<string>(currentProfile);

  const fetchProfiles = async () => {
    try {
      let result = await window.electron.getProfiles();
      logger.info("Fetched profiles:", result);
      if (!result) result = [];

      // remove pinned if deleted
      if (pinnedProfile && !result.includes(pinnedProfile)) {
        setPinnedProfile("");
      }

      // sort alphabetically
      const hasPinned = pinnedProfile && result.includes(pinnedProfile);
      const others = hasPinned
        ? result.filter((p) => p !== pinnedProfile)
        : [...result];
      others.sort((a, b) => a.localeCompare(b));
      const ordered = hasPinned ? [pinnedProfile, ...others] : others;
      setProfiles(ordered);
      setSelectedProfile(currentProfile);
    } catch (e) {
      logger.error("Failed to fetch profiles", e);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // if parent tells us the current profile has changed while we are mounted,
  // update the selected item but keep the original pinned profile at the top
  useEffect(() => {
    if (!currentProfile) return;
    setSelectedProfile(currentProfile);
    setProfiles((prev) => {
      // start with pinned profile if it exists
      const base: string[] = [];
      if (pinnedProfile) base.push(pinnedProfile);

      // gather others excluding pinned
      const others = prev.filter(
        (p) => p !== pinnedProfile && p !== currentProfile
      );
      others.sort((a, b) => a.localeCompare(b));

      // insert current profile just after pinned (or at front if same)
      if (currentProfile && currentProfile !== pinnedProfile) {
        base.push(currentProfile);
      }

      return [...base, ...others];
    });
  }, [currentProfile, pinnedProfile]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleProfileClick = (profile: string) => {
    setSelectedProfile(profile);
    onSelectProfile(profile);
  };

  const handleDeleteClick = async (profile: string) => {
    if (profile === "default") {
      await showSmallWindow(
        "Cannot Delete",
        "The default profile cannot be deleted.",
        ["Okay"]
      );
      return;
    }
    const confirm = await showSmallWindow(
      "Delete Profile",
      `Are you sure you want to delete the profile "${profile}"?`,
      ["Yes", "No"]
    );
    if (confirm === "Yes") {
      try {
        const ok = await window.electron.deleteProfile(profile);
        if (ok) {
          logger.info(`Profile deleted: ${profile}`);
          if (profile === pinnedProfile) {
            setPinnedProfile("");
          }
          // if the deleted profile was selected, fallback default
          if (selectedProfile === profile) {
            const fallback = "default";
            setSelectedProfile(fallback);
            onSelectProfile(fallback);
          }
        } else {
          logger.error(`deleteProfile returned false for ${profile}`);
        }
      } catch (err) {
        logger.error("Error deleting profile", err);
      } finally {
        await fetchProfiles();
      }
    }
  };

  let filteredProfiles = profiles.filter((p) =>
    p.toLowerCase().includes(searchText.toLowerCase())
  );

  if (pinnedProfile) {
    filteredProfiles = filteredProfiles.filter((p) => p !== pinnedProfile);
    filteredProfiles.unshift(pinnedProfile);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="manage-profiles-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-window-content">
          <div className="modal-content">
            <div className="subwindow-field">
              <input
                type="text"
                value={searchText}
                onChange={handleSearchChange}
                placeholder="Search profiles"
                className="manage-profiles-search"
              />
            </div>
            <div className="manage-profiles-list">
              <ul>
                {filteredProfiles.map((profile, idx) => (
                  <li
                    key={`${profile}-${idx}`}
                    className={`profile-item${
                      profile === selectedProfile ? " selected" : ""
                    }`}
                    onClick={() => handleProfileClick(profile)}
                  >
                    <span className="profile-text">
                      {profile === "default" ? "Default" : profile}
                    </span>
                    {profile !== "default" && (
                      <button
                        className="profile-delete-btn"
                        title="Delete profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(profile);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
                {filteredProfiles.length === 0 && (
                  <li className="no-results">No profiles match</li>
                )}
              </ul>
            </div>
          </div>
          <div className="modal-window-footer">
            <button className="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageProfiles;
