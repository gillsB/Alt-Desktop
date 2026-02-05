import React, { useState } from "react";
import "../styles/IconDifferenceViewer.css";
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
    if (value === null || value === undefined) return "(empty)";
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

  const copyLeftToRight = (field: string) => {
    setEditedRight((prev) => ({ ...prev, [field]: editedLeft[field] }));
  };

  const copyRightToLeft = (field: string) => {
    setEditedLeft((prev) => ({ ...prev, [field]: editedRight[field] }));
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
  };

  const isFieldEdited = (field: string, side: "left" | "right"): boolean => {
    const original =
      side === "left"
        ? getFieldValue(icon, field as keyof DesktopIcon)
        : getFieldValue(otherIcon, field as keyof DesktopIcon);
    const current = side === "left" ? editedLeft[field] : editedRight[field];
    return formatValue(original) !== current;
  };

  const fieldsMatch = (field: string): boolean => {
    return editedLeft[field] === editedRight[field];
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
            {fieldsToCompare.map((fieldName) => {
              const isDifferent = isFieldDifferent(fieldName);
              const currentMatch = fieldsMatch(String(fieldName));
              const leftEdited = isFieldEdited(String(fieldName), "left");
              const rightEdited = isFieldEdited(String(fieldName), "right");

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
                    {(leftEdited || rightEdited) && (
                      <span className="unsaved-indicator">*</span>
                    )}
                  </div>
                  <div className="field-values">
                    <div className="field-value">
                      {editedLeft[String(fieldName)]}
                    </div>
                    <div className="field-buttons">
                      <button
                        className="field-copy-btn field-copy-left"
                        onClick={() => copyRightToLeft(String(fieldName))}
                        title="Copy right to left"
                      >
                        &lt;
                      </button>
                      <button
                        className="field-copy-btn field-copy-center"
                        onClick={() => resetField(String(fieldName))}
                        title="Reset to original"
                        disabled={!leftEdited && !rightEdited}
                      >
                        o
                      </button>
                      <button
                        className="field-copy-btn field-copy-right"
                        onClick={() => copyLeftToRight(String(fieldName))}
                        title="Copy left to right"
                      >
                        &gt;
                      </button>
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
