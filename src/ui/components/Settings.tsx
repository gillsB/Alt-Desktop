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
  const [externalPathsInput, setExternalPathsInput] = useState(
    Array.isArray(settings?.externalPaths)
      ? settings.externalPaths.join(", ")
      : ""
  );
  const [defaultBackgroundPathInput, setDefaultBackgroundPathInput] = useState(
    settings?.defaultBackgroundPath ?? ""
  );
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
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW", "Settings");
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

      const externalPathsChanged = getSpecificChanges(["externalPaths"]);
      const defaultBackgroundPathChanged = getSpecificChanges([
        "defaultBackgroundPath",
      ]);

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

      logger.info("Settings data prepared for saving:", updatedSettings);

      // Save the updated settings data
      if (await window.electron.saveSettingsData(updatedSettings)) {
        logger.info("Settings saved successfully.");
        // Update the state once after everything is done
        setSettings(updatedSettings);

        // If externalPaths or defaultBackgroundPath changed, trigger re-index
        if (externalPathsChanged || defaultBackgroundPathChanged) {
          await window.electron.indexBackgrounds({
            newExternalPathAdded: externalPathsChanged,
            newDefaultPathAdded: defaultBackgroundPathChanged,
          });
        }

        closeWindow();
      } else {
        logger.error("Failed to save settings.");
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

  // Keep input in sync with settings changes
  useEffect(() => {
    setExternalPathsInput(
      Array.isArray(settings?.externalPaths)
        ? settings.externalPaths.join(", ")
        : ""
    );
  }, [settings?.externalPaths]);

  useEffect(() => {
    setDefaultBackgroundPathInput(settings?.defaultBackgroundPath ?? "");
  }, [settings?.defaultBackgroundPath]);

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
    <div className="subwindow-container">
      <SubWindowHeader title={`Settings`} onClose={handleClose} />
      <div className="subwindow-content">
        {/* Default Background Folder input */}
        <div className="subwindow-field">
          <label htmlFor="default-background-path">
            Default Background Folder
          </label>
          <input
            id="default-background-path"
            type="text"
            value={defaultBackgroundPathInput}
            onChange={(e) => setDefaultBackgroundPathInput(e.target.value)}
            title="Folder path for default backgrounds. Used for saving and indexing backgrounds."
            onBlur={() => {
              updateSetting(
                "defaultBackgroundPath",
                defaultBackgroundPathInput
              );
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateSetting(
                  "defaultBackgroundPath",
                  defaultBackgroundPathInput
                );
              }
            }}
            placeholder="Enter default background folder path"
          />
        </div>
        <div className="subwindow-field">
          <label htmlFor="external-paths">External Background Folders</label>
          <input
            id="external-paths"
            type="text"
            value={externalPathsInput}
            onChange={(e) => setExternalPathsInput(e.target.value)}
            title="Full filepath separated by commas. List of folders to include in background indexing/saving"
            onBlur={() => {
              const paths = externalPathsInput
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              updateSetting("externalPaths", paths);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const paths = externalPathsInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                updateSetting("externalPaths", paths);
              }
            }}
            placeholder="Enter external paths here"
          />
        </div>
        <div className="subwindow-field">
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
        <div className="subwindow-field">
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
        <div className="subwindow-field">
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
        <div className="subwindow-field dropdown-container">
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
      <div className="subwindow-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Settings;
