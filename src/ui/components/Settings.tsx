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
  const [isHoveringBackground, setHoveringBackground] = useState(false);
  const [isHoveringMagnifyingGlass, setHoveringMagnifyingGlass] =
    useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragCounter = useRef(0);
  const colorInputRef = useRef<HTMLInputElement>(null);

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
          if (getSpecificChanges(["background"])) {
            await window.electron.reloadBackground();
          }
          if (
            getSpecificChanges([
              "defaultIconSize",
              "defaultFontSize",
              "defaultFontColor",
            ])
          ) {
            await window.electron.reloadGrid();
          }
          if (getSpecificChanges(["windowType"])) {
            await window.electron.reloadHeader();
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

      logger.info("Saving settings data to file:", updatedSettings);

      if (
        settings?.windowType === "BORDERLESS" &&
        getSpecificChanges(["windowType"])
      ) {
        await window.electron.showSmallWindow(
          "Restart Required",
          "Borderless mode uses a transparency effect when hovering the original header area.\n" +
            " This requires a restart to take effect.",
          ["Okay"]
        );
      }

      // Save the updated settings data
      if (await window.electron.saveSettingsData(updatedSettings)) {
        logger.info("Settings saved successfully.");
        // Update the state once after everything is done
        setSettings(updatedSettings);
        // Reload the background if background value changes were made
        if (getSpecificChanges(["background"])) {
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

  const handleFileSelect = async () => {
    try {
      const filePath = await window.electron.openFileDialog("all"); // Accept both image/video
      if (filePath) {
        updateSetting("background", filePath);
        sendPreviewBackgroundUpdate({ background: filePath });
        logger.info(`Background path set to: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to select or save background:`, error);
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
    try {
      setSettings((prev) => {
        if (!prev) return null; // Handle null state gracefully
        return {
          ...prev,
          [key]: value, // Update only the targeted field
        };
      });
    } catch (error) {
      logger.error("Error updating setting:", error);
    }
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

    if (fileType.startsWith("image/") || fileType.startsWith("video/")) {
      logger.info("Dropped file is an image or video. Updating background...");
      updateSetting("background", filePath);
      sendPreviewBackgroundUpdate({ background: filePath });
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
    if (!settings?.background) {
      filePath = `backgrounds/`;
    } else {
      filePath = `backgrounds/${settings?.background}`;
    }

    const success = await window.electron.openFileDialog("all", filePath);
    logger.info("Open file dialog result:", success);
    if (success) {
      updateSetting("background", success);
      sendPreviewBackgroundUpdate({ background: success });
    } else {
      logger.info(
        "No file selected or dialog closed without selection.",
        success
      );
    }
  };

  const sendPreviewBackgroundUpdate = async (
    updatedFields: Partial<SettingsData>
  ) => {
    try {
      const previewData: Partial<SettingsData> = {
        background: settings?.background ?? "",
        ...updatedFields,
      };
      await window.electron.previewBackgroundUpdate(previewData);
    } catch (error) {
      logger.error("Failed to send preview update:", error);
    }
  };

  const sendPreviewGridUpdate = async (
    updatedFields: Partial<SettingsData>
  ) => {
    try {
      const previewData: Partial<SettingsData> = {
        ...updatedFields, // Override with any explicitly updated fields
      };

      await window.electron.previewGridUpdate(previewData);
    } catch (error) {
      logger.error("Failed to send preview update:", error);
    }
  };
  const sendPreviewHeaderUpdate = async (
    updatedFields: Partial<SettingsData>
  ) => {
    try {
      const previewData: Partial<SettingsData> = {
        ...updatedFields, // Override with any explicitly updated fields
      };

      await window.electron.previewHeaderUpdate(previewData);
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
          <label htmlFor="background-path">Background Path</label>
          <input
            id="background-path"
            type="text"
            value={settings?.background || ""}
            title="Drop an image or video file on this window to auto set the path."
            onChange={(e) => {
              const updatedValue = e.target.value;
              updateSetting("background", updatedValue);
              sendPreviewBackgroundUpdate({ background: updatedValue });
            }}
          />
          <button
            className="file-select-button flex items-center gap-2"
            onClick={handleFileSelect}
            onMouseEnter={() => setHoveringBackground(true)}
            onMouseLeave={() => setHoveringBackground(false)}
          >
            {isHoveringBackground ? (
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
            title="Select from previously set backgrounds"
          >
            <MagnifyingGlassIcon
              className={`custom-magnifying-glass-icon ${
                isHoveringMagnifyingGlass ? "hovered" : ""
              }`}
            />
          </button>
        </div>
        <div className="settings-field">
          <label htmlFor="icon-size">Default Icon Size</label>
          <input
            id="icon-size"
            type="number"
            value={settings?.defaultIconSize}
            title="Blank for default (64px)"
            onChange={(e) => {
              const updatedValue = e.target.value;
              if (updatedValue === "") {
                updateSetting("defaultIconSize", undefined);
                sendPreviewGridUpdate({
                  defaultIconSize: 64,
                });
              } else {
                updateSetting("defaultIconSize", Number(updatedValue));
                sendPreviewGridUpdate({
                  defaultIconSize: Number(updatedValue),
                });
              }
            }}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="font-size">Default Icon Font Size</label>
          <input
            id="font-size"
            type="number"
            value={settings?.defaultFontSize}
            title="Blank for default (16px) 0 to not render names."
            onChange={(e) => {
              const updatedValue = e.target.value;
              if (updatedValue === "") {
                updateSetting("defaultFontSize", undefined);
                sendPreviewGridUpdate({
                  defaultFontSize: 16,
                });
              } else {
                updateSetting("defaultFontSize", Number(updatedValue));
                sendPreviewGridUpdate({
                  defaultFontSize: Number(updatedValue),
                });
              }
            }}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="font-color">Default Icon Font Color</label>
          <div className="color-input-container">
            <input
              id="font-color"
              type="text"
              value={settings?.defaultFontColor}
              title="Click box for selector. Blank for default (white)"
              onChange={(e) => {
                const updatedValue = e.target.value;
                if (updatedValue === "") {
                  updateSetting("defaultFontColor", undefined);
                  sendPreviewGridUpdate({
                    defaultFontColor: "#FFFFFF",
                  });
                } else {
                  updateSetting("defaultFontColor", String(updatedValue));
                  sendPreviewGridUpdate({
                    defaultFontColor: String(updatedValue),
                  });
                }
              }}
            />
            <div
              className="color-preview"
              style={{
                backgroundColor: settings?.defaultFontColor || "#FFFFFF",
              }}
              onClick={() => colorInputRef.current?.click()}
            >
              <input
                ref={colorInputRef}
                type="color"
                value={settings?.defaultFontColor}
                onChange={(e) => {
                  updateSetting("defaultFontColor", e.target.value);
                  sendPreviewGridUpdate({ defaultFontColor: e.target.value });
                }}
              />
            </div>
            <button
              type="button"
              className="default-font-color-btn"
              title="Reset All icons to default font color"
              onClick={async () => {
                const ret = await showSmallWindow(
                  "Reset All Icon Font Colors",
                  "Do you want to reset **ALL ICONS**\n to use the default font color? \nThis does not require a save,\nand **CANNOT be undone.**",
                  ["Yes", "No"]
                );
                if (ret === "Yes") {
                  logger.info("Send request to reset all icons font color");
                  try {
                    const result =
                      await window.electron.resetAllIconsFontColor();
                    await window.electron.reloadGrid();
                    if (!result) {
                      logger.error("Failed to reset all icons font color.");
                    }
                  } catch (error) {
                    logger.error(
                      "Failed to reset all icons font color:",
                      error
                    );
                  }
                } else {
                  logger.info("User canceled the reset action.");
                }
              }}
            >
              Reset All Icons
            </button>
          </div>
        </div>
        <div className="settings-field window-type">
          <label htmlFor="window-type">Window Type</label>
          <select
            id="window-type"
            value={settings?.windowType || "WINDOWED"}
            onChange={(e) => {
              const selected = e.target.value as "WINDOWED" | "BORDERLESS";
              updateSetting("windowType", selected);
              sendPreviewHeaderUpdate({ windowType: selected });
            }}
          >
            <option value="WINDOWED">Windowed</option>
            <option value="BORDERLESS">Borderless</option>
          </select>
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
