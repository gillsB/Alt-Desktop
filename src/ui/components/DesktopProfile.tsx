import { useEffect, useRef, useState } from "react";
import IconDifferenceViewer from "../modals/IconDifferenceViewer";
import ManageProfiles from "../modals/ManageProfiles";
import "../styles/DesktopProfile.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SafeImage } from "./SafeImage";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("DesktopProfile.tsx");

const TABS = [
  { key: "desktop", label: "Desktop Files" },
  { key: "other", label: "Other Profiles" },
];

interface ProfileCompareState {
  filesToImport: DesktopIcon[];
  alreadyImported: PairedIcons[];
  modified: Array<{
    otherIcon: DesktopIcon;
    currentIcon: DesktopIcon;
    differences: string[];
  }>;
}

const DesktopProfile: React.FC = () => {
  const [desktopCacheCompare, setDesktopCacheCompare] =
    useState<ProfileCompareState>({
      filesToImport: [],
      alreadyImported: [],
      modified: [],
    });
  const [profileCompare, setProfileCompare] = useState<ProfileCompareState>({
    filesToImport: [],
    alreadyImported: [],
    modified: [],
  });
  const [profile, setProfile] = useState<string>("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("desktop");
  const [compareToProfile, setCompareToProfile] = useState<string>("");
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [desktopCacheLoading, setDesktopCacheLoading] = useState(false);
  const [desktopCacheProgress, setDesktopCacheProgress] = useState<{
    imported: number;
    total: number;
  }>({ imported: 0, total: 0 });
  const [compareImportCollapsed, setCompareImportCollapsed] = useState(false);
  const [compareModifiedCollapsed, setCompareModifiedCollapsed] =
    useState(false);
  const [compareAlreadyImportedCollapsed, setCompareAlreadyImportedCollapsed] =
    useState(true);
  const [desktopCacheImportCollapsed, setDesktopCacheImportCollapsed] =
    useState(false);
  const [desktopCacheModifiedCollapsed, setDesktopCacheModifiedCollapsed] =
    useState(false);
  const [
    desktopCacheAlreadyImportedCollapsed,
    setDesktopCacheAlreadyImportedCollapsed,
  ] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    icon?: DesktopIcon;
    section?: "desktop" | "compare";
  }>({ visible: false, x: 0, y: 0 });
  const [iconDifferenceViewer, setIconDifferenceViewer] = useState<{
    profileName: string;
    icon: DesktopIcon;
    otherProfileName: string;
    otherIcon: DesktopIcon;
    differences: string[];
  } | null>(null);
  const escapeHandlerRef = useRef<() => void>(() => {});

  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  escapeHandlerRef.current = () => {
    if (contextMenu.visible) {
      hideContextMenu();
    } else if (iconDifferenceViewer) {
      // modal captures escape key so it can pass back saved state
      return;
    } else {
      handleClose();
    }
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

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        escapeHandlerRef.current();
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey, true);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey, true);
    };
  }, []);

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
      try {
        reloadDesktopCache();
      } catch (error) {
        logger.error("Error fetching desktop cache:", error);
      }
    };

    // Only load when desktop tab is active AND profile is set
    if (activeTab === "desktop" && profile) {
      fetchUniqueFiles();
    }
  }, [profile]);
  // Removed activeTab reloading, it reloads on mount and when differenceViewer is closed.
  // So any change not reloaded is external, which the user can just click reload. Instead of adding weight to every tab swap.

  useEffect(() => {
    const onProgress = (...args: unknown[]) => {
      const payload = args[1] as
        | { imported: number; total: number }
        | undefined;
      if (payload) {
        setDesktopCacheProgress({
          imported: payload.imported,
          total: payload.total,
        });
        setDesktopCacheLoading(true);
      }
    };

    window.electron.on("desktop-cache-import-progress", onProgress);
    return () => {
      window.electron.off("desktop-cache-import-progress", onProgress);
    };
  }, [profile]);

  const doProfileChange = async (newProfile: string) => {
    setProfile(newProfile);
    window.electron.setRendererStates({ profile: newProfile });

    try {
      const list = await window.electron.getProfiles();
      if (list) {
        // sort default selection order and apply to state
        const others = list.filter((p) => p !== newProfile);
        others.sort((a, b) => a.localeCompare(b));
        setProfiles(newProfile ? [newProfile, ...others] : others);
      }
    } catch (err) {
      logger.error("Error reloading profile list:", err);
    }

    if (activeTab === "other") {
      let updatedCompareToProfile = compareToProfile;
      if (!compareToProfile || compareToProfile === newProfile) {
        updatedCompareToProfile = profiles.find((p) => p !== newProfile) || "";
        setCompareToProfile(updatedCompareToProfile);
      }
      setProfileCompare({
        filesToImport: [],
        alreadyImported: [],
        modified: [],
      });
      if (updatedCompareToProfile) {
        try {
          const result = await window.electron.compareProfiles(
            newProfile,
            updatedCompareToProfile
          );
          setProfileCompare({
            filesToImport: result.filesToImport || [],
            alreadyImported: result.alreadyImported || [],
            modified: result.modified || [],
          });
        } catch (error) {
          logger.error("Error comparing profiles:", error);
        }
      }
    }

    // Save the current background with the new profile
    try {
      // Get the current background ID from settings
      const bgId = await window.electron.getSetting("background");
      if (bgId) {
        await window.electron.saveBgJson({
          id: bgId,
          localProfile: newProfile,
        });
      } else {
        await window.electron.saveSettingsData({
          noBgDesktopProfile: newProfile,
        });
      }
    } catch (err) {
      logger.error(
        "Failed to update background profile on profile change:",
        err
      );
    }
  };

  const handleProfileChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    await doProfileChange(e.target.value);
  };

  // import every icon currently listed as "not imported" in Desktop Files (icons from desktop_cache)
  const handleImportAll = async () => {
    if (!profile) {
      logger.warn("Cannot import all when no profile is selected");
      return;
    }

    const confirmImport = await showSmallWindow(
      "Confirm Import",
      `Import all (${desktopCacheCompare.filesToImport.length}) "Not Imported" icons\n to the "${profile}" profile?`,
      ["Yes", "No"]
    );

    if (confirmImport === "Yes") {
      const toImport = desktopCacheCompare.filesToImport;
      if (!toImport || toImport.length === 0) {
        return;
      }

      // process sequentially; errors for individual icons won't abort the loop
      for (const icon of toImport) {
        try {
          const importedIcon = await window.electron.importIconFromProfile(
            profile,
            "desktop_cache",
            icon
          );
          if (!importedIcon) {
            logger.error(
              "Failed to import icon from desktop_cache during importAll",
              {
                icon,
                profile,
              }
            );
          }
        } catch (err) {
          logger.error(
            "Error importing icon from desktop_cache during importAll",
            err
          );
        }
      }

      // refresh once when done
      try {
        await reloadDesktopCache();
      } catch (error) {
        logger.error("Error reloading desktop cache after importAll", error);
      }
    }
  };

  const importFromProfile = async (icon: DesktopIcon) => {
    try {
      const sourceProfile =
        activeTab === "desktop" ? "desktop_cache" : compareToProfile;
      const importedIcon = await window.electron.importIconFromProfile(
        profile,
        sourceProfile,
        icon
      );
      if (!importedIcon) {
        logger.error("Failed to import icon from profile:", {
          icon,
          sourceProfile,
          profile,
        });
      } else {
        if (activeTab === "desktop") {
          await reloadDesktopCache();
        } else {
          await handleCompareProfiles(compareToProfile, true);
        }
      }
    } catch (error) {
      logger.error("Error importing icon from profile:", error);
    }
  };

  const reloadDesktopCache = async () => {
    setDesktopCacheLoading(true);
    try {
      const importResult = await window.electron.importAllIconsToDesktopCache();
      if (importResult === false) {
        logger.warn(
          "Import to desktop_cache is already in progress, keeping loading placeholder"
        );
        return;
      }

      // Then compare the current profile with desktop_cache
      const result = await window.electron.compareProfiles(
        profile,
        "desktop_cache"
      );
      setDesktopCacheCompare({
        filesToImport: result.filesToImport || [],
        alreadyImported: result.alreadyImported || [],
        modified: result.modified || [],
      });
      setDesktopCacheLoading(false);
    } catch (error) {
      logger.error("Error reloading desktop cache:", error);
      setDesktopCacheCompare({
        filesToImport: [],
        alreadyImported: [],
        modified: [],
      });
      setDesktopCacheLoading(false);
    }
  };

  const reloadOtherProfiles = async () => {
    await handleCompareProfiles(compareToProfile, true);
  };

  const handleCompareProfiles = async (
    eOrValue: React.ChangeEvent<HTMLSelectElement> | string,
    force: boolean = false
  ) => {
    const selectedProfile =
      typeof eOrValue === "string" ? eOrValue : eOrValue.target.value;

    setCompareToProfile(selectedProfile);

    if (
      selectedProfile &&
      profile &&
      (force ||
        selectedProfile !== compareToProfile ||
        (profileCompare.filesToImport.length === 0 &&
          profileCompare.alreadyImported.length === 0 &&
          profileCompare.modified.length === 0))
    ) {
      try {
        setProfileCompare({
          filesToImport: [],
          alreadyImported: [],
          modified: [],
        });
        const result = await window.electron.compareProfiles(
          profile,
          selectedProfile
        );
        setProfileCompare({
          filesToImport: result.filesToImport || [],
          alreadyImported: result.alreadyImported || [],
          modified: result.modified || [],
        });
      } catch (error) {
        logger.error("Error comparing profiles:", error);
      }
    }
  };

  const handleModifiedIconClick = (
    item: ProfileCompareState["modified"][0]
  ) => {
    window.electron.highlightIcon(item.currentIcon.id);
    setIconDifferenceViewer({
      profileName: profile,
      icon: item.currentIcon,
      otherProfileName: compareToProfile,
      otherIcon: item.otherIcon,
      differences: item.differences,
    });
  };

  const handleIconHover = (icon: DesktopIcon) => {
    window.electron.hoverHighlightIcon(icon.id);
  };

  const handleIconDifferenceClose = async (saved: boolean = false) => {
    setIconDifferenceViewer(null);
    logger.info("Icon difference viewer closed. Changes saved:", saved);
    if (saved) {
      try {
        await reloadDesktopCache();
        await reloadOtherProfiles();
      } catch (err) {
        logger.error(
          "Error reloading profiles after difference viewer closed:",
          err
        );
      }
    }
  };

  useEffect(() => {
    if (activeTab !== "other") return;
    if (!profiles || profiles.length === 0) return;
    const candidate =
      compareToProfile || profiles.find((p) => p !== profile) || profiles[0];
    if (candidate) {
      handleCompareProfiles(candidate);
    }
  }, [activeTab]);

  //TODO this needs a lot of testing with different size texts etc.

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
          onClick={() => setShowManageModal(true)}
          title="Manage Profiles"
        >
          Manage Profiles
        </button>
      </section>
      <section className="desktop-profile-bottom">
        <div className="import-icons-header">
          <h2>Import Icons</h2>
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
          {/* Desktop Files Tab - Compare with desktop_cache */}
          {activeTab === "desktop" && (
            <div className="import-icons-other">
              {desktopCacheLoading ? (
                <div className="loading-state">
                  <p>
                    Importing Desktop files to cache...
                    {desktopCacheProgress.total > 0 && (
                      <span>
                        {` `}({desktopCacheProgress.imported}/
                        {desktopCacheProgress.total})
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="import-icons-header">
                    <div className="header-left-group">
                      <button
                        type="button"
                        className="button import-all-btn"
                        onClick={handleImportAll}
                        disabled={
                          desktopCacheCompare.filesToImport.length === 0 ||
                          !profile
                        }
                      >
                        Import all
                      </button>
                    </div>
                    <div className="header-right-group">
                      <button
                        type="button"
                        className="button reload-btn"
                        onClick={reloadDesktopCache}
                      >
                        Reload
                      </button>
                    </div>
                  </div>

                  <div className="compare-grid-container">
                    {/* Not Imported Section */}
                    {desktopCacheCompare.filesToImport.length > 0 && (
                      <div className="icon-grid-section">
                        <div
                          className="desktop-profile-section-header"
                          onClick={() =>
                            setDesktopCacheImportCollapsed(
                              !desktopCacheImportCollapsed
                            )
                          }
                        >
                          <button
                            className="tag-toggle-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDesktopCacheImportCollapsed(
                                !desktopCacheImportCollapsed
                              );
                            }}
                            aria-label={
                              desktopCacheImportCollapsed
                                ? "Expand"
                                : "Collapse"
                            }
                          >
                            {desktopCacheImportCollapsed ? "▸" : "▾"}
                          </button>
                          <span>
                            Not Imported (
                            {desktopCacheCompare.filesToImport.length})
                          </span>
                        </div>
                        {!desktopCacheImportCollapsed && (
                          <div className="desktop-profile-icons-grid">
                            {desktopCacheCompare.filesToImport.map((icon) => (
                              <div
                                key={`desktop-cache-not-imported-${icon.id}`}
                                className="desktop-profile-icon-item with-import-button"
                                title={icon.name}
                              >
                                <SafeImage
                                  profile="desktop_cache"
                                  id={icon.id}
                                  row={icon.row}
                                  col={icon.col}
                                  imagePath={icon.image}
                                  width={84}
                                  height={84}
                                  highlighted={false}
                                />
                                <div className="desktop-profile-icon-name">
                                  {icon.name}
                                </div>
                                <button
                                  className="import-hover-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    importFromProfile(icon);
                                  }}
                                  aria-label={`Import ${icon.name}`}
                                >
                                  Import
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modified Section */}
                    {desktopCacheCompare.modified.length > 0 && (
                      <div className="icon-grid-section">
                        <div
                          className="desktop-profile-section-header"
                          onClick={() =>
                            setDesktopCacheModifiedCollapsed(
                              !desktopCacheModifiedCollapsed
                            )
                          }
                        >
                          <button
                            className="tag-toggle-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDesktopCacheModifiedCollapsed(
                                !desktopCacheModifiedCollapsed
                              );
                            }}
                            aria-label={
                              desktopCacheModifiedCollapsed
                                ? "Expand"
                                : "Collapse"
                            }
                          >
                            {desktopCacheModifiedCollapsed ? "▸" : "▾"}
                          </button>
                          <span>
                            Modified ({desktopCacheCompare.modified.length})
                          </span>
                        </div>
                        {!desktopCacheModifiedCollapsed && (
                          <div className="desktop-profile-icons-grid-modified">
                            {desktopCacheCompare.modified.map((item) => (
                              <div
                                key={`desktop-cache-modified-${item.otherIcon.id}`}
                                className="desktop-profile-icon-item modified-item"
                                title={item.otherIcon.name}
                                onMouseEnter={() =>
                                  handleIconHover(item.currentIcon)
                                }
                                onMouseLeave={() =>
                                  window.electron.hoverHighlightIcon()
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <div className="icon-card">
                                  <SafeImage
                                    profile="desktop_cache"
                                    id={item.otherIcon.id}
                                    row={item.otherIcon.row}
                                    col={item.otherIcon.col}
                                    imagePath={item.otherIcon.image}
                                    width={84}
                                    height={84}
                                    highlighted={false}
                                  />
                                  <div className="desktop-profile-icon-name">
                                    {item.otherIcon.name}
                                  </div>
                                </div>

                                <div className="difference-box">
                                  <div className="modified-differences">
                                    {item.differences.map((diff, index) => (
                                      <button
                                        key={index}
                                        className="difference-tag"
                                        title={diff}
                                      >
                                        {diff}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Already Imported Section */}
                    {desktopCacheCompare.alreadyImported.length > 0 && (
                      <div className="icon-grid-section">
                        <div
                          className="desktop-profile-section-header"
                          onClick={() =>
                            setDesktopCacheAlreadyImportedCollapsed(
                              !desktopCacheAlreadyImportedCollapsed
                            )
                          }
                        >
                          <button
                            className="tag-toggle-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDesktopCacheAlreadyImportedCollapsed(
                                !desktopCacheAlreadyImportedCollapsed
                              );
                            }}
                            aria-label={
                              desktopCacheAlreadyImportedCollapsed
                                ? "Expand"
                                : "Collapse"
                            }
                          >
                            {desktopCacheAlreadyImportedCollapsed ? "▸" : "▾"}
                          </button>
                          <span>
                            Already Imported (
                            {desktopCacheCompare.alreadyImported.length})
                          </span>
                        </div>
                        {!desktopCacheAlreadyImportedCollapsed && (
                          <div className="desktop-profile-icons-grid">
                            {desktopCacheCompare.alreadyImported.map((pair) => (
                              <div
                                key={`desktop-cache-already-${pair.otherIcon.id}`}
                                className="desktop-profile-icon-item"
                                title={pair.otherIcon.name}
                                onMouseEnter={() =>
                                  handleIconHover(pair.currentIcon)
                                }
                                onMouseLeave={() =>
                                  window.electron.hoverHighlightIcon()
                                }
                              >
                                <SafeImage
                                  profile="desktop_cache"
                                  id={pair.otherIcon.id}
                                  row={pair.otherIcon.row}
                                  col={pair.otherIcon.col}
                                  imagePath={pair.otherIcon.image}
                                  width={84}
                                  height={84}
                                  highlighted={false}
                                />
                                <div className="desktop-profile-icon-name">
                                  {pair.otherIcon.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {/* Other Profiles Tab */}
          {activeTab === "other" && (
            <div className="import-icons-other">
              <div className="import-icons-header">
                <div className="header-left-group">
                  <label className="desktop-profile-label">
                    Compare to Profile:
                  </label>
                  <select
                    className="desktop-profile-select"
                    value={compareToProfile}
                    onChange={handleCompareProfiles}
                  >
                    {profiles
                      .filter((p) => p !== profile)
                      .map((p) => (
                        <option key={p} value={p}>
                          {p === "default" ? "Default" : p}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="header-right-group">
                  <button
                    type="button"
                    className="button reload-btn"
                    onClick={reloadOtherProfiles}
                  >
                    Reload
                  </button>
                </div>
              </div>

              {compareToProfile && (
                <div className="compare-grid-container">
                  {/* Not Imported Section */}
                  {profileCompare.filesToImport.length > 0 && (
                    <div className="icon-grid-section">
                      <div
                        className="desktop-profile-section-header"
                        onClick={() =>
                          setCompareImportCollapsed(!compareImportCollapsed)
                        }
                      >
                        <button
                          className="tag-toggle-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompareImportCollapsed(!compareImportCollapsed);
                          }}
                          aria-label={
                            compareImportCollapsed ? "Expand" : "Collapse"
                          }
                        >
                          {compareImportCollapsed ? "▸" : "▾"}
                        </button>
                        <span>
                          Not Imported ({profileCompare.filesToImport.length})
                        </span>
                      </div>
                      {!compareImportCollapsed && (
                        <div className="desktop-profile-icons-grid">
                          {profileCompare.filesToImport.map((icon) => (
                            <div
                              key={`not-imported-${icon.id}`}
                              className="desktop-profile-icon-item with-import-button"
                              title={icon.name}
                            >
                              <SafeImage
                                profile={compareToProfile}
                                id={icon.id}
                                row={icon.row}
                                col={icon.col}
                                imagePath={icon.image}
                                width={84}
                                height={84}
                                highlighted={false}
                              />
                              <div className="desktop-profile-icon-name">
                                {icon.name}
                              </div>
                              <button
                                className="import-hover-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  importFromProfile(icon);
                                }}
                                aria-label={`Import ${icon.name}`}
                              >
                                Import
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modified Section */}
                  {profileCompare.modified.length > 0 && (
                    <div className="icon-grid-section">
                      <div
                        className="desktop-profile-section-header"
                        onClick={() =>
                          setCompareModifiedCollapsed(!compareModifiedCollapsed)
                        }
                      >
                        <button
                          className="tag-toggle-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompareModifiedCollapsed(
                              !compareModifiedCollapsed
                            );
                          }}
                          aria-label={
                            compareModifiedCollapsed ? "Expand" : "Collapse"
                          }
                        >
                          {compareModifiedCollapsed ? "▸" : "▾"}
                        </button>
                        <span>Modified ({profileCompare.modified.length})</span>
                      </div>
                      {!compareModifiedCollapsed && (
                        <div className="desktop-profile-icons-grid-modified">
                          {profileCompare.modified.map((item) => (
                            <div
                              key={`modified-${item.otherIcon.id}`}
                              className="desktop-profile-icon-item modified-item"
                              title={item.otherIcon.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleModifiedIconClick(item);
                              }}
                              onMouseEnter={() =>
                                handleIconHover(item.currentIcon)
                              }
                              onMouseLeave={() =>
                                window.electron.hoverHighlightIcon()
                              }
                              style={{ cursor: "pointer" }}
                            >
                              <div className="icon-card">
                                <SafeImage
                                  profile={compareToProfile}
                                  id={item.otherIcon.id}
                                  row={item.otherIcon.row}
                                  col={item.otherIcon.col}
                                  imagePath={item.otherIcon.image}
                                  width={84}
                                  height={84}
                                  highlighted={false}
                                />

                                <div className="desktop-profile-icon-name">
                                  {item.otherIcon.name}
                                </div>
                              </div>

                              <div
                                className="difference-box"
                                aria-hidden={item.differences?.length === 0}
                              >
                                <div className="modified-differences">
                                  {item.differences?.map((diff, idx) => (
                                    <button
                                      key={`diff-${item.otherIcon.id}-${idx}`}
                                      className="difference-tag"
                                      title={diff}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleModifiedIconClick(item);
                                      }}
                                    >
                                      {diff}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Already Imported Section */}
                  {profileCompare.alreadyImported.length > 0 && (
                    <div className="icon-grid-section">
                      <div
                        className="desktop-profile-section-header"
                        onClick={() =>
                          setCompareAlreadyImportedCollapsed(
                            !compareAlreadyImportedCollapsed
                          )
                        }
                      >
                        <button
                          className="tag-toggle-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompareAlreadyImportedCollapsed(
                              !compareAlreadyImportedCollapsed
                            );
                          }}
                          aria-label={
                            compareAlreadyImportedCollapsed
                              ? "Expand"
                              : "Collapse"
                          }
                        >
                          {compareAlreadyImportedCollapsed ? "▸" : "▾"}
                        </button>
                        <span>
                          Already Imported (
                          {profileCompare.alreadyImported.length})
                        </span>
                      </div>
                      {!compareAlreadyImportedCollapsed && (
                        <div className="desktop-profile-icons-grid">
                          {profileCompare.alreadyImported.map((pair) => (
                            <div
                              key={`already-imported-${pair.otherIcon.id}`}
                              className="desktop-profile-icon-item"
                              title={pair.otherIcon.name}
                              onMouseEnter={() =>
                                handleIconHover(pair.currentIcon)
                              }
                              onMouseLeave={() =>
                                window.electron.hoverHighlightIcon()
                              }
                            >
                              <SafeImage
                                profile={compareToProfile}
                                id={pair.otherIcon.id}
                                row={pair.otherIcon.row}
                                col={pair.otherIcon.col}
                                imagePath={pair.otherIcon.image}
                                width={84}
                                height={84}
                                highlighted={false}
                              />
                              <div className="desktop-profile-icon-name">
                                {pair.otherIcon.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {contextMenu.visible && contextMenu.icon && (
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
              if (contextMenu.icon && contextMenu.icon.programLink) {
                window.electron.openInExplorer(
                  "programLink",
                  contextMenu.icon.programLink
                );
              } else {
                logger.error("No programLink found for icon in context menu");
              }
              setContextMenu({ visible: false, x: 0, y: 0 });
            }}
          >
            Open file in explorer
          </div>
        </div>
      )}

      {iconDifferenceViewer && (
        <IconDifferenceViewer
          profileName={iconDifferenceViewer.profileName}
          icon={iconDifferenceViewer.icon}
          otherProfileName={iconDifferenceViewer.otherProfileName}
          otherIcon={iconDifferenceViewer.otherIcon}
          differences={iconDifferenceViewer.differences}
          onClose={handleIconDifferenceClose}
        />
      )}

      {showManageModal && (
        <ManageProfiles
          currentProfile={profile}
          onClose={() => setShowManageModal(false)}
          onSelectProfile={(p) => {
            doProfileChange(p);
          }}
        />
      )}
    </div>
  );
};

export default DesktopProfile;
