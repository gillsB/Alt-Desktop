import { useEffect, useState } from "react";
import "../styles/DesktopProfile.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("DesktopProfile.tsx");

const TABS = [
  { key: "desktop", label: "Desktop Files" },
  { key: "other", label: "Other Profiles" },
];

const DesktopProfile: React.FC = () => {
  const [uniqueFiles, setUniqueFiles] = useState<desktopFile[]>([]);
  const [alreadyImported, setAlreadyImported] = useState<
    Array<{
      name: string;
      path: string;
      icon: DesktopIcon;
    }>
  >([]);
  const [profile, setProfile] = useState<string>("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("desktop");
  const [alreadyImportedCollapsed, setAlreadyImportedCollapsed] =
    useState(true);

  const handleClose = () => {
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW", "DesktopProfile");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileList = await window.electron.getProfiles();
      if (!cancelled) {
        // Sort profiles: "default" first, then alphabetically
        const sortedProfiles = profileList.sort((a, b) => {
          if (a === "default") return -1;
          if (b === "default") return 1;
          return a.localeCompare(b);
        });
        setProfiles(sortedProfiles);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchRendererStates = async () => {
      const rendererStates = await window.electron.getRendererStates();
      setProfile(rendererStates.profile || "");
    };
    fetchRendererStates();
  }, []);

  useEffect(() => {
    const updateStates = (...args: unknown[]) => {
      const state = args[1] as Partial<RendererStates>;
      if ("profile" in state) {
        setProfile(state.profile || "default");
      }
    };
    window.electron.on("renderer-state-updated", updateStates);
    return () => {
      window.electron.off("renderer-state-updated", updateStates);
    };
  }, []);

  useEffect(() => {
    const fetchUniqueFiles = async () => {
      if (profile) {
        try {
          const result = await window.electron.getDesktopUniqueFiles(profile);
          setUniqueFiles(result.filesToImport || []);
          setAlreadyImported(result.alreadyImported || []);
        } catch (error) {
          logger.error("Error fetching unique desktop files:", error);
        }
      }
    };
    fetchUniqueFiles();
  }, [profile]);

  const handleProfileChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newProfile = e.target.value;
    setProfile(newProfile);
    window.electron.setRendererStates({ profile: newProfile });

    // Save the current background with the new profile
    try {
      // Get the current background ID from settings
      const bgId = await window.electron.getSetting("background");
      if (bgId) {
        await window.electron.saveBgJson({
          id: bgId,
          localProfile: newProfile,
        });
      }
    } catch (err) {
      logger.error(
        "Failed to update background profile on profile change:",
        err
      );
    }
  };

  const handleImportAll = async () => {
    if (!uniqueFiles || uniqueFiles.length === 0) return;
    try {
      await window.electron.importAllIconsFromDesktop();

      const refreshed = await window.electron.getDesktopUniqueFiles(profile);
      setUniqueFiles(refreshed.filesToImport || []);
      setAlreadyImported(refreshed.alreadyImported || []);
    } catch (err) {
      logger.error("Failed to import desktop files:", err);
    }
  };

  const handleImportFile = async (file: desktopFile) => {
    try {
      const importedIcon = await window.electron.importDesktopFile(
        file,
        profile
      );
      if (importedIcon) {
        // Refresh the unique files list after import
        reloadFiles();
        logger.info(`Successfully imported ${file.name}`);
      }
    } catch (error) {
      logger.error(`Failed to import ${file.name}:`, error);
    }
  };

  const reloadFiles = async () => {
    try {
      const refreshed = await window.electron.getDesktopUniqueFiles(profile);
      setUniqueFiles(refreshed.filesToImport || []);
      setAlreadyImported(refreshed.alreadyImported || []);
      logger.info("also received data:", refreshed.alreadyImported);
    } catch (error) {
      logger.error("Error reloading unique desktop files:", error);
    }
  };

  return (
    <div className="subwindow-container">
      <SubWindowHeader title={`Desktop Profile`} onClose={handleClose} />
      <section className="desktop-profile-top">
        <label className="desktop-profile-label">Current Profile:</label>
        <select
          className="desktop-profile-select"
          value={profile}
          onChange={handleProfileChange}
        >
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p === "default" ? "Default" : p}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button"
          onClick={() => {
            showSmallWindow("Placeholder", "Placeholder", ["Ok"]);
          }}
          title="Placeholder"
        >
          Manage Profiles
        </button>
      </section>
      <section className="desktop-profile-bottom">
        <div className="import-icons-header">
          <h2>Import Icons</h2>
          <div className="import-icons-subtitle">
            Import icons from other sources.
          </div>
        </div>
        <div className="import-icons-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`import-icons-tab-btn${
                activeTab === tab.key ? " active" : ""
              }`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="import-icons-tab-content">
          {activeTab === "desktop" && (
            <div className="import-icons-desktop">
              <div className="desktop-profile-count-row">
                <div className="desktop-profile-count">
                  Total unique DesktopFiles found: {uniqueFiles.length}
                </div>
                <button
                  type="button"
                  className="button import-all-inline"
                  onClick={handleImportAll}
                >
                  Import All
                </button>
              </div>
              <div className="desktop-profile-list">
                {uniqueFiles.map((file, index) => (
                  <div key={`new-${index}`} className="desktop-profile-file">
                    <div className="desktop-file-content">
                      {JSON.stringify(file)}
                    </div>
                    <button
                      type="button"
                      className="button import-file-btn"
                      onClick={() => handleImportFile(file)}
                    >
                      Import
                    </button>
                  </div>
                ))}

                {alreadyImported.length > 0 && (
                  <div className="imported-files-section">
                    <div
                      className="imported-files-header"
                      onClick={() =>
                        setAlreadyImportedCollapsed(!alreadyImportedCollapsed)
                      }
                    >
                      <button
                        className="tag-toggle-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAlreadyImportedCollapsed(
                            !alreadyImportedCollapsed
                          );
                        }}
                      >
                        {alreadyImportedCollapsed ? "▸" : "▾"}
                      </button>
                      <span>
                        Already Imported Files ({alreadyImported.length})
                      </span>
                    </div>

                    {!alreadyImportedCollapsed && (
                      <div className="imported-files-content">
                        {alreadyImported.map((file, index) => (
                          <div
                            key={`imported-${index}`}
                            className="desktop-profile-file imported"
                          >
                            <div className="desktop-file-content">
                              {JSON.stringify(file)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "other" && (
            <div className="import-icons-other">
              {/* TODO: UI for copying from other profiles */}
              <div className="import-icons-placeholder">
                Copy icons from other profiles here.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DesktopProfile;
