import React, { useState } from "react";
import "../styles/IconDifferenceViewer.css";
import { showSmallWindow } from "../util/uiUtil";
import { SafeImage } from "./SafeImage";

interface IconDifferenceViewerProps {
  profileName: string;
  icon: DesktopIcon;
  otherProfileName: string;
  otherIcon: DesktopIcon;
  differences: string[];
  onClose: () => void;
}

const IconDifferenceViewer: React.FC<IconDifferenceViewerProps> = ({
  profileName,
  icon,
  otherProfileName,
  otherIcon,
  differences,
  onClose,
}) => {
  const [showAllFields, setShowAllFields] = useState(false);

  const fieldsToCompare: (keyof DesktopIcon)[] = [
    "name",
    "image",
    "programLink",
    "args",
    "websiteLink",
    "fontColor",
  ];

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const isFieldDifferent = (fieldName: string): boolean => {
    return differences.includes(fieldName);
  };

  const getFieldValue = (icon: DesktopIcon, fieldName: keyof DesktopIcon) => {
    return icon[fieldName];
  };

  const [editedLeft, setEditedLeft] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    fieldsToCompare.forEach((f) => {
      const v = getFieldValue(icon, f);
      map[String(f)] = formatValue(v);
    });
    return map;
  });

  const [editedRight, setEditedRight] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    fieldsToCompare.forEach((f) => {
      const v = getFieldValue(otherIcon, f);
      map[String(f)] = formatValue(v);
    });
    return map;
  });

  const [isLeftEdited, setIsLeftEdited] = useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {};
      fieldsToCompare.forEach((f) => {
        map[String(f)] = false;
      });
      return map;
    }
  );

  const [isRightEdited, setIsRightEdited] = useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {};
      fieldsToCompare.forEach((f) => {
        map[String(f)] = false;
      });
      return map;
    }
  );

  const copyLeftToRight = (field: string) => {
    setEditedRight((prev) => ({ ...prev, [field]: editedLeft[field] }));
    setIsRightEdited((prev) => ({ ...prev, [field]: true }));
    setIsLeftEdited((prev) => ({ ...prev, [field]: false }));
  };

  const copyRightToLeft = (field: string) => {
    setEditedLeft((prev) => ({ ...prev, [field]: editedRight[field] }));
    setIsLeftEdited((prev) => ({ ...prev, [field]: true }));
    setIsRightEdited((prev) => ({ ...prev, [field]: false }));
  };

  const resetField = (field: string) => {
    setEditedLeft((prev) => ({
      ...prev,
      [field]: formatValue(getFieldValue(icon, field as keyof DesktopIcon)),
    }));
    setEditedRight((prev) => ({
      ...prev,
      [field]: formatValue(
        getFieldValue(otherIcon, field as keyof DesktopIcon)
      ),
    }));
    setIsLeftEdited((prev) => ({ ...prev, [field]: false }));
    setIsRightEdited((prev) => ({ ...prev, [field]: false }));
  };

  const fieldsMatch = (field: string): boolean => {
    return editedLeft[field] === editedRight[field];
  };

  const isAnyLeftEdited = (): boolean => {
    return Object.values(isLeftEdited).some((val) => val);
  };

  const isAnyRightEdited = (): boolean => {
    return Object.values(isRightEdited).some((val) => val);
  };

  const parseFieldValue = (
    fieldName: keyof DesktopIcon,
    value: string
  ): DesktopIcon[keyof DesktopIcon] => {
    if (fieldName === "args") {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    if (fieldName === "fontSize") {
      return parseInt(value, 10);
    }
    return value;
  };

  const saveLeft = async () => {
    const iconBackup = { ...icon };
    fieldsToCompare.forEach((field) => {
      if (isLeftEdited[String(field)]) {
        const newValue = editedLeft[String(field)];
        const parsedValue = parseFieldValue(field, newValue);
        icon[field] = parsedValue as never;
      }
    });

    // If image field was edited, transfer the image from right icon to left icon
    if (isLeftEdited["image"]) {
      // If the other icon has an image, attempt to transfer it (skips if right icon is empty)
      if (otherIcon.image) {
        const transferredFileName = await window.electron.transferIconImage(
          otherProfileName,
          otherIcon.id,
          profileName,
          icon.id
        );
        if (transferredFileName) {
          icon.image = transferredFileName;
        } else {
          // If transfer fails, restore backup and abort
          icon = iconBackup;
          showSmallWindow(
            "Error",
            `Failed to transfer image file from profile 
            \n${otherProfileName}: ${otherIcon.id} ${otherIcon.image}, 
            \nto ${profileName}: ${icon.id} ${icon.image} 
            \nChanges not saved.`
          );
          return;
        }
      }
    }
    // This saves the icon with updated id if "name" changed
    const result = await window.electron.saveIcon(
      iconBackup,
      icon,
      profileName
    );
    if (result.success) {
      // Update id if it was changed
      if (result.newID) {
        icon.id = result.newID;
      }
      setIsLeftEdited({});
      setEditedLeft(() => {
        const map: Record<string, string> = {};
        fieldsToCompare.forEach((f) => {
          const v = getFieldValue(icon, f);
          map[String(f)] = formatValue(v);
        });
        return map;
      });
      if (iconBackup.id !== icon.id) {
        await window.electron.reloadIcon(iconBackup.id);
      }
      await window.electron.reloadIcon(icon.id);
    } else {
      icon = iconBackup;
    }
  };

  const saveRight = async () => {
    const otherIconBackup = { ...otherIcon };
    fieldsToCompare.forEach((field) => {
      if (isRightEdited[String(field)]) {
        const newValue = editedRight[String(field)];
        const parsedValue = parseFieldValue(field, newValue);
        otherIcon[field] = parsedValue as never;
      }
    });

    // If image field was edited, transfer the image from left icon to right icon
    if (isRightEdited["image"]) {
      // If the left icon has an image, attempt to transfer it (skips if left icon is empty)
      if (icon.image) {
        const transferredFileName = await window.electron.transferIconImage(
          profileName,
          icon.id,
          otherProfileName,
          otherIcon.id
        );
        if (transferredFileName) {
          otherIcon.image = transferredFileName;
        } else {
          // If transfer fails, restore backup and abort
          otherIcon = otherIconBackup;
          showSmallWindow(
            "Error",
            `Failed to transfer image file from profile 
            \n${profileName}: ${icon.id} ${icon.image}, 
            \nto ${otherProfileName}: ${otherIcon.id} ${otherIcon.image} 
            \nChanges not saved.`
          );
          return;
        }
      }
    }

    // This saves the icon with updated id if "name" changed
    const result = await window.electron.saveIcon(
      otherIconBackup,
      otherIcon,
      otherProfileName
    );
    if (result.success) {
      // Update id if it was changed
      if (result.newID) {
        otherIcon.id = result.newID;
      }
      setIsRightEdited({});
      setEditedRight(() => {
        const map: Record<string, string> = {};
        fieldsToCompare.forEach((f) => {
          const v = getFieldValue(otherIcon, f);
          map[String(f)] = formatValue(v);
        });
        return map;
      });
    } else {
      otherIcon = otherIconBackup;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-window-content">
        <div className="modal-content icon-difference-viewer-content">
          {/* Icons Display */}
          <div className="icon-comparison-header">
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="showAllFields"
                checked={showAllFields}
                onChange={(e) => setShowAllFields(e.target.checked)}
              />
              <label htmlFor="showAllFields">Show all fields</label>
            </div>
            <div className="icon-comparison-column">
              <div className="icon-container">
                <div className="comparison-profile-name">{profileName}</div>
                <div className="comparison-icon-display">
                  <SafeImage
                    profile={profileName}
                    id={icon.id}
                    row={icon.row}
                    col={icon.col}
                    imagePath={icon.image}
                    width={64}
                    height={64}
                    highlighted={false}
                  />
                </div>
                <div className="comparison-icon-id">{icon.id}</div>
              </div>

              <div className="icon-container">
                <div className="comparison-profile-name">
                  {otherProfileName}
                </div>
                <div className="comparison-icon-display">
                  <SafeImage
                    profile={otherProfileName}
                    id={otherIcon.id}
                    row={otherIcon.row}
                    col={otherIcon.col}
                    imagePath={otherIcon.image}
                    width={64}
                    height={64}
                    highlighted={false}
                  />
                </div>
                <div className="comparison-icon-id">{otherIcon.id}</div>
              </div>
            </div>
          </div>

          {/* Fields Comparison */}
          <div className="icon-fields-comparison">
            {/* Save Buttons Row */}
            <div className="icon-save-buttons-row">
              <button
                className="button icon-save-button"
                onClick={saveLeft}
                disabled={!isAnyLeftEdited()}
                title={
                  isAnyLeftEdited()
                    ? "Save changes to left icon"
                    : "No changes to save"
                }
              >
                Save {profileName}
              </button>
              <button
                className="button icon-save-button"
                onClick={saveRight}
                disabled={!isAnyRightEdited()}
                title={
                  isAnyRightEdited()
                    ? "Save changes to right icon"
                    : "No changes to save"
                }
              >
                Save {otherProfileName}
              </button>
            </div>
            {fieldsToCompare.map((fieldName) => {
              const isDifferent = isFieldDifferent(fieldName);
              const currentMatch = fieldsMatch(String(fieldName));

              // Only show different fields unless showAllFields is true
              if (!showAllFields && !isDifferent) {
                return null;
              }

              return (
                <div
                  key={fieldName}
                  className={`icon-field-row ${
                    currentMatch ? "same" : "different"
                  }`}
                >
                  <div className="field-indicator">
                    <div
                      className={`indicator-dot ${
                        currentMatch ? "green" : "yellow"
                      }`}
                      title={currentMatch ? "Match" : "Different"}
                    ></div>
                  </div>
                  <div className="field-name">
                    {fieldName}
                    {(isLeftEdited[String(fieldName)] ||
                      isRightEdited[String(fieldName)]) && (
                      <span className="unsaved-indicator">*</span>
                    )}
                  </div>
                  <div className="field-values">
                    <div className="field-value">
                      {editedLeft[String(fieldName)]}
                    </div>
                    <div className="field-buttons">
                      {isLeftEdited[String(fieldName)] ||
                      isRightEdited[String(fieldName)] ? (
                        <button
                          className="field-copy-btn field-copy-center"
                          onClick={() => resetField(String(fieldName))}
                          title="Reset to original"
                        >
                          ↩️
                        </button>
                      ) : !currentMatch ? (
                        <>
                          <button
                            className="button field-copy-left"
                            onClick={() => copyRightToLeft(String(fieldName))}
                            title="Copy right to left"
                          >
                            &lt;
                          </button>
                          <button
                            className="button field-copy-right"
                            onClick={() => copyLeftToRight(String(fieldName))}
                            title="Copy left to right"
                          >
                            &gt;
                          </button>
                        </>
                      ) : null}
                    </div>
                    <div className="field-value">
                      {editedRight[String(fieldName)]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-window-footer">
          <button className="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconDifferenceViewer;
