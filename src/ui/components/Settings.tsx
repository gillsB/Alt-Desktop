import { useEffect, useState } from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("Settings.tsx");

const Settings: React.FC = () => {
  // Initialize settings with a default object.
  const [settings, setSettings] = useState<SettingsData | null>(null);

  const handleClose = () => {
    logger.info("Settings window closed");
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = async () => {
    if (settings) {
      logger.info("Saving settings:", settings);
      if (await window.electron.saveSettingsData(settings)) {
        logger.info("Settings saved successfully.");
        handleClose();
      } else {
        logger.error("Failed to save settings.");
      }
    } else {
      logger.error("No settings to save.");
    }
    const ret = await showSmallWindow(
      "Did not save",
      "Settings did not save correctly, check logs. \nClick yes to continue closing settings.",
      ["Yes", "No"]
    );
    if (ret === "Yes") {
      handleClose();
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
