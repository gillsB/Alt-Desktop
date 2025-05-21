import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import "../styles/BorderlessHeader.css";
import "../styles/WindowedHeader.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("Header.tsx");

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerType, setHeaderType] = useState("WINDOWED");
  const [subWindowDevtoolsChecked, setSubWindowDevtoolsChecked] =
    useState(false);
  const [smallWindowDevtoolsChecked, setSmallWindowDevtoolsChecked] =
    useState(false);
  const devMode = process.env.NODE_ENV === "development";

  const settingsClicked = async () => {
    if (await window.electron.isSubWindowActive()) {
      return;
    } else {
      window.electron.openSettings();
    }
  };

  useEffect(() => {
    const handlePreview = (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>;

      logger.info("Received Header preview updates:", updates);
      fetchHeaderType(updates.headerType);
    };

    window.electron.on("update-header-preview", handlePreview);

    return () => {
      window.electron.off("update-header-preview", handlePreview);
    };
  }, []);

  useEffect(() => {
    fetchHeaderType();
  }, []);

  const fetchHeaderType = async (overrides?: HeaderType) => {
    if (overrides) {
      setHeaderType(overrides);
    } else {
      const fetchedType = await window.electron.getSetting("headerType");
      if (fetchedType) {
        setHeaderType(fetchedType);
      } else {
        logger.error(
          "Failed to fetch header type from settings defaulting to WINDOWED."
        );
        setHeaderType("WINDOWED");
      }
    }
  };

  // Dynamically set the header class based on headerType
  const headerClass =
    "main-header " +
    (headerType === "BORDERLESS" ? "borderless-header" : "windowed-header");

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
