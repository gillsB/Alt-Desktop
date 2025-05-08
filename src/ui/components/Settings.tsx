import {
  FolderIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
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
  const [isHoveringMagnifyingGlass, setHoveringMagnifyingGlass] =
    useState(false); // State for magnifying glass hover
  const [isDragging, setIsDragging] = useState(false);

  const dragCounter = useRef(0);

  const handleClose = async () => {
    if (getChanges()) {
      try {
        const ret = await showSmallWindow(
          "Close Without Saving",
          "Close without saving the changes?",
          ["Yes", "No"]
        );
        if (ret === "Yes") {
          logger.info("User confirmed to close without saving.");
          if (getSpecificChanges(["videoBackground", "imageBackground"])) {
            await window.electron.reloadBackground();
          }
          closeWindow();
        }
      } catch (error) {
        logger.error("Error showing close confirmation window:", error);
      }
    } else {
      //no changes
      closeWindow();
    }
  };

  const closeWindow = () => {
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
        // Reload the background if background value changes were made
        if (getSpecificChanges(["videoBackground", "imageBackground"])) {
          await window.electron.reloadBackground();
        }
        closeWindow();
      } else {
        logger.error("Failed to save settings.");

        const ret = await showSmallWindow(
          "Did not save",
          "Settings did not save correctly, check logs. \nClick yes to continue closing settings.",
          ["Yes", "No"]
        );
        if (ret === "Yes") {
          closeWindow();
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
        closeWindow();
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

  const getSpecificChanges = (keys: (keyof SettingsData)[]): boolean => {
    if (!settings || !initialSettings) return false; // No changes if one corrupts

    for (const key of keys) {
      if (settings[key] !== initialSettings[key]) {
        logger.info(`Change detected for key "${key}":`, {
          initial: initialSettings[key],
          current: settings[key],
        });
        return true; // Return true as soon as a change is detected
      }
    }

    logger.info("No changes detected for specified keys:", keys);
    return false; // Return false if no changes are detected
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

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current++;

    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleFileDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current = 0;
    setIsDragging(false);

    const files = event.dataTransfer.files[0];
    const filePath = window.electron.getFilePath(files);
    const fileType = await window.electron.getFileType(filePath);

    logger.info("Dropped file path:", filePath);
    logger.info("Dropped file type:", fileType);

    if (fileType.startsWith("image/")) {
      logger.info("Dropped file is an image. Updating image background...");
      setSettings((prev) =>
        prev ? { ...prev, imageBackground: filePath } : null
      );
    } else if (fileType.startsWith("video/")) {
      logger.info("Dropped file is a video. Updating video background...");
      setSettings((prev) =>
        prev ? { ...prev, videoBackground: filePath } : null
      );
    } else {
      logger.warn("Dropped file is neither an image nor a video.");
      showSmallWindow(
        "Invalid File Type",
        "Dropped file is neither image nor video, and will not be used.",
        ["OK"]
      );
    }
  };

  const handleMagnifyingGlassClick = async () => {
    let filePath = "";
    // if no imageBackground path set
    if (!settings?.imageBackground) {
      // Added subfolder path just to make it open inside "backgrounds folder"
      filePath = `backgrounds/`;
    } else {
      // Open and highlight current imageBackground path file
      filePath = `backgrounds/${settings?.imageBackground}`;
    }

    const success = await window.electron.openFileDialog("image", filePath);
    logger.info("Open file dialog result:", success);
    if (success) {
      updateSetting("imageBackground", success);
    } else {
      logger.info(
        "No file selected or dialog closed without selection.",
        success
      );
    }
  };

  const sendPreviewUpdate = async (updatedFields: Partial<SettingsData>) => {
    try {
      const previewData: Partial<SettingsData> = {
        videoBackground: settings?.videoBackground || undefined,
        imageBackground: settings?.imageBackground || undefined,
        ...updatedFields, // Override with any explicitly updated fields
      };

      await window.electron.previewBackgroundUpdate(previewData);
      logger.info(`Sent preview update for settings:`, previewData);
    } catch (error) {
      logger.error("Failed to send preview update:", error);
    }
  };

  return (
    <div
      className="settings-container"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      <SubWindowHeader title={`Settings`} onClose={handleClose} />
      <div className="settings-content">
        <div className="settings-field">
          <label htmlFor="video-background">Video Background path</label>
          <input
            id="video-background"
            type="text"
            value={settings?.videoBackground || ""}
            title="Drop a video file on this window to auto set the path."
            onChange={(e) => {
              const updatedValue = e.target.value;
              updateSetting("videoBackground", updatedValue);
              sendPreviewUpdate({ videoBackground: updatedValue });
            }}
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
            title="Drop an image on this window to auto set the path."
            value={settings?.imageBackground || ""}
            onChange={(e) => {
              const updatedValue = e.target.value;
              updateSetting("imageBackground", updatedValue);
              sendPreviewUpdate({ imageBackground: updatedValue });
            }}
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
          <button
            className="magnifying-glass-button flex items-center gap-2"
            onClick={handleMagnifyingGlassClick}
            onMouseEnter={() => setHoveringMagnifyingGlass(true)}
            onMouseLeave={() => setHoveringMagnifyingGlass(false)}
            title="Select from previously set background images"
          >
            <MagnifyingGlassIcon
              className={`custom-magnifying-glass-icon ${
                isHoveringMagnifyingGlass ? "hovered" : ""
              }`}
            />
          </button>
        </div>
        <div className="settings-field">
          <label htmlFor="font-size">Icon font size</label>
          <input
            id="font-size"
            type="number"
            value={settings?.fontSize}
            title="Blank for default (16px) 0 to not render names."
            onChange={(e) => {
              const updatedValue = e.target.value;
              if (updatedValue === "") {
                updateSetting("fontSize", undefined);
              } else {
                updateSetting("fontSize", Number(updatedValue));
              }
            }}
          />
        </div>
      </div>
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            <div className="drag-icon">+</div>
            <div className="drag-text">Drop image or video file here.</div>
          </div>
        </div>
      )}
      <div className="settings-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Settings;
