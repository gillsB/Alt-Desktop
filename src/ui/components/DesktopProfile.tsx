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

interface DesktopFileState {
  uniqueFiles: DesktopFile[];
  alreadyImported: Array<{ name: string; path: string; icon: DesktopIcon }>;
  nameOnlyMatches: Array<{ name: string; path: string; icon: DesktopIcon }>;
  pathOnlyMatches: Array<{ name: string; path: string; icon: DesktopIcon }>;
}

const DesktopProfile: React.FC = () => {
  const [desktopFiles, setDesktopFiles] = useState<DesktopFileState>({
    uniqueFiles: [],
    alreadyImported: [],
    nameOnlyMatches: [],
    pathOnlyMatches: [],
  });
  const [profile, setProfile] = useState<string>("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("desktop");
  const [alreadyImportedCollapsed, setAlreadyImportedCollapsed] =
    useState(true);
  const [partialMatchesCollapsed, setPartialMatchesCollapsed] = useState(false);
  const [notImportedCollapsed, setNotImportedCollapsed] = useState(false);
  const [formattedPaths, setFormattedPaths] = useState<Record<string, string>>(
    {}
  );
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    file?: DesktopFile;
    section?: "notImported" | "partial" | "imported";
  }>({ visible: false, x: 0, y: 0 });

  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const contextMenuElement = document.querySelector(".context-menu");
      if (
        contextMenu &&
        contextMenuElement &&
        !e.composedPath().includes(contextMenuElement)
      ) {
        hideContextMenu();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu]);

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
          reloadFiles();
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
    if (!desktopFiles.uniqueFiles || desktopFiles.uniqueFiles.length === 0)
      return;
    try {
      await window.electron.importAllIconsFromDesktop();

      reloadFiles();
    } catch (err) {
      logger.error("Failed to import desktop files:", err);
    }
  };

  const handleImportFile = async (file: DesktopFile) => {
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
      setDesktopFiles({
        uniqueFiles: refreshed.filesToImport || [],
        alreadyImported: refreshed.alreadyImported || [],
        nameOnlyMatches: refreshed.nameOnlyMatches || [],
        pathOnlyMatches: refreshed.pathOnlyMatches || [],
      });
    } catch (error) {
      logger.error("Error reloading unique desktop files:", error);
    }
  };

  useEffect(() => {
    const formatPaths = async () => {
      const paths: Record<string, string> = {};
      const allFiles = [
        ...desktopFiles.uniqueFiles,
        ...desktopFiles.nameOnlyMatches,
        ...desktopFiles.pathOnlyMatches,
        ...desktopFiles.alreadyImported,
      ];

      for (const file of allFiles) {
        paths[file.path] = await formatFilePath(file.path);
      }

      setFormattedPaths(paths);
    };

    formatPaths();
  }, [desktopFiles]);

  const formatFilePath = async (path: string) => {
    // Check for extension first
    const extension = path.split(".").pop();
    if (extension && extension !== path) {
      return `.${extension.toLowerCase()}`;
    }

    // If no extension, get mimetype
    try {
      const mimeType = await window.electron.getFileType(path);
      if (mimeType) {
        if (mimeType.endsWith("directory")) {
          return "(folder)";
        }
        // Get the general type from mimetype (last part after '/')
        const type = mimeType.split("/")[0];
        return `(${type})`;
      }
    } catch (err) {
      logger.warn(`Could not determine file type for ${path}:`, err);
    }

    return "(unknown)";
  };

  const findCommonPrefixCut = (a: string, b: string) => {
    const minLen = Math.min(a.length, b.length);
    let i = 0;
    while (i < minLen && a[i] === b[i]) i++;
    if (i === minLen) return i;

    const sepPos = Math.max(
      a.lastIndexOf("\\", i - 1),
      a.lastIndexOf("/", i - 1)
    );
    if (sepPos >= 0) return sepPos + 1;
    return i;
  };

  // Render highlighted path: common prefix green, differing tail yellow
  const renderHighlightedPath = (
    iconPath: string | undefined,
    filePath: string
  ) => {
    const ip = (iconPath || "") as string;

    if (!ip) {
      logger.info("renderHighlightedPath - no iconPath", { filePath });
      return (
        <span className="partial-match-path different-highlight">
          (no path)
        </span>
      );
    }

    const ipLower = ip.toLowerCase();
    const fpLower = filePath.toLowerCase();
    const cut = findCommonPrefixCut(ipLower, fpLower);
    const common = ip.slice(0, cut);
    const diff = ip.slice(cut);

    // Append ... if iconPath is a substring of filePath
    if (!diff) {
      const identical = ipLower === fpLower;
      logger.info("renderHighlightedPath - no diff", {
        iconPath: ip,
        filePath,
        cut,
        common,
        identical,
      });

      return (
        <span className="highlighted-path-inline" title={ip}>
          {common ? <span className="match-highlight">{common}</span> : null}
          {!identical ? <span className="different-highlight">...</span> : null}
        </span>
      );
    }

    return (
      <span className="highlighted-path-inline" title={ip}>
        {common ? <span className="match-highlight">{common}</span> : null}
        {diff ? <span className="different-highlight">{diff}</span> : null}
      </span>
    );
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
          {/* Not imported */}
          {activeTab === "desktop" && (
            <div className="import-icons-desktop">
              <div className="desktop-profile-count-row">
                <div className="desktop-profile-count">
                  Total unique DesktopFiles found:{" "}
                  {desktopFiles.uniqueFiles.length}
                </div>
                <button
                  type="button"
                  className="button import-all-inline"
                  onClick={handleImportAll}
                >
                  Import All
                </button>
                <button
                  type="button"
                  className="button reload-btn"
                  onClick={reloadFiles}
                >
                  Reload
                </button>
              </div>
              <div className="desktop-profile-list">
                {/* Not Imported */}
                <div
                  className="not-imported-header"
                  onClick={() => setNotImportedCollapsed(!notImportedCollapsed)}
                >
                  <button
                    className="tag-toggle-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotImportedCollapsed(!notImportedCollapsed);
                    }}
                  >
                    {notImportedCollapsed ? "▸" : "▾"}
                  </button>
                  <span>Not Imported ({desktopFiles.uniqueFiles.length})</span>
                </div>

                {!notImportedCollapsed && (
                  <div className="not-imported-content">
                    {desktopFiles.uniqueFiles.map((file, index) => (
                      <div
                        key={`new-${index}`}
                        className="desktop-profile-file"
                        title={`View ${file.name} in File Explorer`}
                        onClick={() => {
                          if (contextMenu.visible) return;
                          window.electron.openInExplorer(
                            "programLink",
                            file.path
                          );
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            file: file,
                            section: "notImported",
                          });
                        }}
                      >
                        <div className="desktop-file-content">
                          <span className="file-name">
                            {file.name.includes(".")
                              ? file.name.split(".").slice(0, -1).join(".")
                              : file.name}
                          </span>
                          <span className="file-path">
                            {formattedPaths[file.path] || "..."}
                          </span>
                        </div>
                        <div className="desktop-file-actions">
                          <button
                            type="button"
                            className="button import-file-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImportFile(file);
                            }}
                          >
                            Import
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Partial matches */}
                {desktopFiles.nameOnlyMatches.length +
                  desktopFiles.pathOnlyMatches.length >
                  0 && (
                  <div className="partial-files-section">
                    <div
                      className="not-imported-header"
                      onClick={() =>
                        setPartialMatchesCollapsed(!partialMatchesCollapsed)
                      }
                    >
                      <button
                        className="tag-toggle-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPartialMatchesCollapsed(!partialMatchesCollapsed);
                        }}
                      >
                        {partialMatchesCollapsed ? "▸" : "▾"}
                      </button>
                      <span>
                        Partial Matches (
                        {desktopFiles.nameOnlyMatches.length +
                          desktopFiles.pathOnlyMatches.length}
                        )
                      </span>
                    </div>

                    {!partialMatchesCollapsed && (
                      <div className="not-imported-content">
                        {desktopFiles.nameOnlyMatches.map((file, index) => (
                          <div
                            key={`partial-name-${index}`}
                            className="desktop-profile-file partial"
                            onClick={() => {
                              if (contextMenu.visible) return;
                              window.electron.openInExplorer(
                                "programLink",
                                file.path
                              );
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                file: file,
                                section: "partial",
                              });
                            }}
                          >
                            <div className="desktop-file-content">
                              <span className={`partial-match-name`}>
                                {renderHighlightedPath(
                                  file.icon.name,
                                  file.name
                                )}
                              </span>
                              <span className="partial-match-path">
                                {renderHighlightedPath(
                                  file.icon.programLink,
                                  file.path
                                )}
                              </span>
                            </div>
                          </div>
                        ))}

                        {desktopFiles.pathOnlyMatches.map((file, index) => (
                          <div
                            key={`partial-path-${index}`}
                            className="desktop-profile-file partial"
                            onClick={() => {
                              if (contextMenu.visible) return;
                              window.electron.openInExplorer(
                                "programLink",
                                file.path
                              );
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                file: file,
                                section: "partial",
                              });
                            }}
                          >
                            <div className="desktop-file-content">
                              <span className={`partial-match-name`}>
                                {renderHighlightedPath(
                                  file.icon.name,
                                  file.name
                                )}
                              </span>
                              <span className="partial-match-path">
                                {renderHighlightedPath(
                                  file.icon.programLink,
                                  file.path
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Already imported */}
                {desktopFiles.alreadyImported.length > 0 && (
                  <>
                    <div
                      className="not-imported-header"
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
                        Already Imported Files (
                        {desktopFiles.alreadyImported.length})
                      </span>
                    </div>

                    {!alreadyImportedCollapsed && (
                      <div className="not-imported-content">
                        {desktopFiles.alreadyImported.map((file, index) => (
                          <div
                            key={`imported-${index}`}
                            className="desktop-profile-file imported"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                file: file,
                                section: "imported",
                              });
                            }}
                          >
                            <div className="desktop-file-content">
                              <span className="file-name">
                                {file.name.includes(".")
                                  ? file.name.split(".").slice(0, -1).join(".")
                                  : file.name}
                              </span>
                              <span className="file-path">
                                {formattedPaths[file.path] || "..."}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
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

      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            role="button"
            tabIndex={0}
            className="menu-item"
            onClick={() => {
              if (contextMenu.file) {
                // TODO custom handler for different sections (import/remove etc.)
                window.electron.openInExplorer(
                  "programLink",
                  contextMenu.file.path
                );
              }
              setContextMenu({ visible: false, x: 0, y: 0 });
            }}
          >
            Open file in explorer
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopProfile;
