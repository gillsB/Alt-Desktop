import { Cog6ToothIcon, ComputerDesktopIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import "../styles/Header.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("Header.tsx");

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowType, setWindowType] = useState("WINDOWED");
  const [subWindowDevtoolsChecked, setSubWindowDevtoolsChecked] =
    useState(false);
  const [smallWindowDevtoolsChecked, setSmallWindowDevtoolsChecked] =
    useState(false);
  const [isMaximized, setIsMaximized] = useState(true);
  const devMode = process.env.NODE_ENV === "development";

  const backgroundSelectClicked = async () => {
    if (await window.electron.getSubWindowTitle()) {
      return;
    } else {
      window.electron.openBackgroundSelect();
    }
  };
  const settingsClicked = async () => {
    if (await window.electron.getSubWindowTitle()) {
      return;
    } else {
      await window.electron.desktopSetHideIcons(false);
      window.electron.openSettings();
    }
  };

  // Listen for header reload updates from the main process
  useEffect(() => {
    const handleReload = () => {
      fetchWindowType();
    };

    window.electron.on("reload-header", handleReload);

    return () => {
      window.electron.off("reload-header", handleReload);
    };
  }, []);

  // Listen for header preview updates from the main process
  useEffect(() => {
    const handlePreview = (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>;

      logger.info("Received Header preview updates:", updates);
      fetchWindowType(updates.windowType);
    };

    window.electron.on("update-header-preview", handlePreview);

    return () => {
      window.electron.off("update-header-preview", handlePreview);
    };
  }, []);

  // Fetch the header type from settings when the component mounts
  useEffect(() => {
    fetchWindowType();
  }, []);

  useEffect(() => {
    const handleMaximized = () => {
      setIsMaximized(true);
    };
    const handleUnmaximized = () => {
      setIsMaximized(false);
    };

    window.electron.on("window-maximized", handleMaximized);
    window.electron.on("window-unmaximized", handleUnmaximized);

    return () => {
      window.electron.off("window-maximized", handleMaximized);
      window.electron.off("window-unmaximized", handleUnmaximized);
    };
  }, []);

  const fetchWindowType = async (overrides?: WindowType) => {
    if (overrides) {
      setWindowType(overrides);
    } else {
      const fetchedType = await window.electron.getSetting("windowType");
      if (fetchedType) {
        setWindowType(fetchedType);
      } else {
        logger.error(
          "Failed to fetch header type from settings defaulting to WINDOWED."
        );
        setWindowType("WINDOWED");
      }
    }
  };

  const headerClass =
    "main-header " +
    (windowType === "BORDERLESS"
      ? isMaximized
        ? "borderless-header"
        : "windowed-header"
      : "windowed-header");

  return (
    <header className={headerClass}>
      {devMode && (
        <div className="menu-container">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Devtools
          </button>
          {menuOpen && (
            <div className="dropdown-menu">
              <button
                onClick={() =>
                  window.electron.sendHeaderAction("SHOW_DEVTOOLS")
                }
              >
                Show Devtools
              </button>
              <div className="checkbox-container">
                <label>
                  subWindow tools
                  <input
                    type="checkbox"
                    checked={subWindowDevtoolsChecked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSubWindowDevtoolsChecked(isChecked);
                      if (isChecked) {
                        logger.info("subWindow devtools enabled.");
                        window.electron.sendHeaderAction(
                          "ENABLE_SUBWINDOW_DEVTOOLS"
                        );
                      } else {
                        logger.info("subWindow devtools disabled.");
                        window.electron.sendHeaderAction(
                          "DISABLE_SUBWINDOW_DEVTOOLS"
                        );
                      }
                    }}
                  />
                </label>
              </div>
              <div className="checkbox-container">
                <label>
                  smallWindow tools
                  <input
                    type="checkbox"
                    checked={smallWindowDevtoolsChecked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSmallWindowDevtoolsChecked(isChecked);
                      if (isChecked) {
                        logger.info("smallWindow devtools enabled.");
                        window.electron.sendHeaderAction(
                          "ENABLE_SMALLWINDOW_DEVTOOLS"
                        );
                      } else {
                        logger.info("smallWindow devtools disabled.");
                        window.electron.sendHeaderAction(
                          "DISABLE_SMALLWINDOW_DEVTOOLS"
                        );
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="window-controls">
        <button
          id="background"
          onClick={backgroundSelectClicked}
          title="Background"
        >
          <ComputerDesktopIcon className="background-select-icon" />
        </button>
        <button id="settings" onClick={settingsClicked} title="Settings">
          <Cog6ToothIcon className="settings-icon" />
        </button>
        <button
          id="minimize"
          onClick={() => window.electron.sendHeaderAction("MINIMIZE")}
        >
          ─
        </button>
        <button
          id="maximize"
          onClick={() => window.electron.sendHeaderAction("MAXIMIZE")}
        >
          <span className="maximize-icon"></span>
        </button>
        <button
          id="close"
          onClick={() => window.electron.sendHeaderAction("CLOSE")}
        >
          ✕
        </button>
      </div>
    </header>
  );
}
