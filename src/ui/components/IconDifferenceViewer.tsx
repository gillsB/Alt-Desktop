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
              const currentValue = getFieldValue(icon, fieldName);
              const otherValue = getFieldValue(otherIcon, fieldName);
              const isDifferent = isFieldDifferent(fieldName);

              // Only show different fields unless showAllFields is true
              if (!showAllFields && !isDifferent) {
                return null;
              }

              return (
                <div
                  key={fieldName}
                  className={`icon-field-row ${
                    isDifferent ? "different" : "same"
                  }`}
                >
                  <div className="field-indicator">
                    <div
                      className={`indicator-dot ${
                        isDifferent ? "yellow" : "green"
                      }`}
                      title={isDifferent ? "Different" : "Same"}
                    ></div>
                  </div>
                  <div className="field-name">{fieldName}</div>
                  <div className="field-values">
                    <div className="field-value">
                      {formatValue(currentValue)}
                    </div>
                    <div className="field-value">{formatValue(otherValue)}</div>
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
