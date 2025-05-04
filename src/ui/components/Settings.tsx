import { FolderIcon, FolderOpenIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("Settings.tsx");

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(
    null
  );
  const [isHoveringVideo, setHoveringVideo] = useState(false);
  const [isHoveringImage, setHoveringImage] = useState(false);

  const handleClose = () => {
    logger.info("Settings window closed");
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = async () => {
    if (!getChanges()) {
      logger.info("No changes detected, closing settings.");
      handleClose();
      return;
    }
    if (settings) {
      logger.info("Saving settings:", settings);

      // Create a copy of the current settings to work with
      const updatedSettings = { ...settings };

      // Save the image background if it exists
      if (updatedSettings.imageBackground) {
        try {
          const savedPath = await window.electron.saveBackgroundImage(
            updatedSettings.imageBackground
          );
          // Update our local copy rather than the state
          updatedSettings.imageBackground = savedPath;
          logger.info(`Image background saved and updated to: ${savedPath}`);
        } catch (error) {
          logger.error("Failed to save image background:", error);
        }
      }

      logger.info("Saving settings data to file:", updatedSettings);

      // Save the updated settings data
      if (await window.electron.saveSettingsData(updatedSettings)) {
        logger.info("Settings saved successfully.");
        // Update the state once after everything is done
        setSettings(updatedSettings);
        handleClose();
      } else {
        logger.error("Failed to save settings.");

        const ret = await showSmallWindow(
          "Did not save",
          "Settings did not save correctly, check logs. \nClick yes to continue closing settings.",
          ["Yes", "No"]
        );
        if (ret === "Yes") {
          handleClose();
        }
      }
    } else {
      logger.error("No settings to save.");

      const ret = await showSmallWindow(
        "Did not save",
        "No settings to save. \nClick yes to continue closing settings.",
        ["Yes", "No"]
      );
      if (ret === "Yes") {
        handleClose();
      }
    }
  };

  const handleFileSelect = async (type: string) => {
    try {
      // Open a file dialog to select a file
      const filePath = await window.electron.openFileDialog(type);
      if (type === "video") {
        if (filePath) {
          updateSetting("videoBackground", filePath);
        }
      } else if (type === "image") {
        if (filePath) {
          // For consistency, we'll only update the path here
          // The actual saving will happen in handleSave
          updateSetting("imageBackground", filePath);
          logger.info(`Image background path set to: ${filePath}`);
        }
      } else {
        logger.error("Invalid type for file selection:", type);
      }
    } catch (error) {
      logger.error(`Failed to select or save ${type}:`, error);
    }
  };

  const getChanges = (): boolean => {
    if (!settings || !initialSettings) return false; // No changes if one corrupts
    const changesMade =
      JSON.stringify(settings) !== JSON.stringify(initialSettings);
    logger.info("Changes detected");
    return changesMade;
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.electron.getSettingsData();
        setSettings(loadedSettings);
        setInitialSettings(loadedSettings);
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
          <label htmlFor="video-background">Video Background path</label>
          <input
            id="video-background"
            type="text"
            value={settings?.videoBackground || ""}
            onChange={(e) => updateSetting("videoBackground", e.target.value)}
          />
          <button
            className="file-select-button flex items-center gap-2"
            onClick={() => handleFileSelect("video")}
            onMouseEnter={() => setHoveringVideo(true)}
            onMouseLeave={() => setHoveringVideo(false)}
          >
            {isHoveringVideo ? (
              <FolderOpenIcon className="custom-folder-icon" />
            ) : (
              <FolderIcon className="custom-folder-icon" />
            )}
          </button>
        </div>
        <div className="settings-field">
          <label htmlFor="image-background">Image Background path</label>
          <input
            id="image-background"
            type="text"
            value={settings?.imageBackground || ""}
            onChange={(e) => updateSetting("imageBackground", e.target.value)}
          />
          <button
            className="file-select-button flex items-center gap-2"
            onClick={() => handleFileSelect("image")}
            onMouseEnter={() => setHoveringImage(true)}
            onMouseLeave={() => setHoveringImage(false)}
          >
            {isHoveringImage ? (
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
