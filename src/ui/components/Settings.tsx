import { FolderIcon, FolderOpenIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("Settings.tsx");

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isHoveringBackground, setHoveringBackground] = useState(false);

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

  const handleFileSelect = async (type: string) => {
    try {
      // Open a file dialog to select an image
      const filePath = await window.electron.openFileDialog(type);
      logger.info("Selected file path:", filePath);
    } catch (error) {
      logger.error("Failed to select or save image:", error);
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

  // Generic function to update a specific field in the settings
  const updateSetting = <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    setSettings((prev) => {
      if (!prev) return null; // Handle null state gracefully
      return {
        ...prev,
        [key]: value, // Update only the targeted field
      };
    });
    logger.info(`Updated setting "${key}" to:`, value);
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
            value={settings?.background || ""}
            onChange={(e) => updateSetting("background", e.target.value)}
          />
          <button
            className="file-select-button flex items-center gap-2"
            onClick={() => handleFileSelect("media")}
            onMouseEnter={() => setHoveringBackground(true)}
            onMouseLeave={() => setHoveringBackground(false)}
          >
            {isHoveringBackground ? (
              <FolderOpenIcon className="custom-folder-icon" />
            ) : (
              <FolderIcon className="custom-folder-icon" />
            )}
          </button>
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
