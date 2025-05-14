import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("Header.tsx");

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <header>
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
