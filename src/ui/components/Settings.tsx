import { useState } from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("Settings.tsx");

const Settings: React.FC = () => {
  logger.info("Settings component rendered");

  // Initialize settings with a default object.
  // TODO make a useEffect to load it from settings.json later.
  const [settings, setSettings] = useState<SettingsData>({
    background: "",
  });

  const handleClose = () => {
    logger.info("Settings window closed");
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = () => {
    if (settings) {
      logger.info("Settings obj:", settings); //just print for now to make sure it works
    }
  };

  return (
    <div className="settings-container">
      <SubWindowHeader title={`Settings`} onClose={handleClose} />
      <div className="settings-content">
        <div className="settings-field">
          <label htmlFor="background">Background path</label>
          <input
            id="background"
            type="text"
            value={settings.background}
            onChange={(e) => {
              setSettings((prev) => ({
                ...prev,
                background: e.target.value, // Update the background field
              }));
              logger.info("Background path changed:", e.target.value);
            }}
          />
        </div>
      </div>
      <div className="settings-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Settings;
