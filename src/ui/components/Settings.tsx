import { useEffect, useState } from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("Settings.tsx");

const Settings: React.FC = () => {
  logger.info("Settings component rendered");

  // Initialize settings with a default object.
  const [settings, setSettings] = useState<SettingsData | null>(null);

  const handleClose = () => {
    logger.info("Settings window closed");
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = () => {
    if (settings) {
      logger.info("Settings obj:", settings); //just print for now to make sure it works
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.electron.getSettingsData();
        setSettings(loadedSettings);
        logger.info("Loaded settings:", loadedSettings);
      } catch (error) {
        logger.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  return (
    <div className="settings-container">
      <SubWindowHeader title={`Settings`} onClose={handleClose} />
      <div className="settings-content">
        <div className="settings-field">
          <label htmlFor="background">Background path</label>
          <input
            id="background"
            type="text"
            value={settings?.background || ""}
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
