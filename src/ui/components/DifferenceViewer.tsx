import React from "react";
import "../styles/DifferenceViewer.css";

interface DifferenceViewerProps {
  profileName: string;
  icon: DesktopIcon;
  fieldName: string;
  currentValue: unknown;
  otherProfileName: string;
  otherIcon: DesktopIcon;
  otherValue: unknown;
  onClose: () => void;
}

const DifferenceViewer: React.FC<DifferenceViewerProps> = ({
  profileName,
  icon,
  fieldName,
  currentValue,
  otherProfileName,
  otherIcon,
  otherValue,
  onClose,
}) => {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-window-content">
        <div className="modal-content difference-viewer-content">
          <h2>Field Difference</h2>
          <div className="difference-field-name">
            <strong>{fieldName}</strong>
          </div>

          <div className="difference-comparison">
            <div className="difference-profile-section current-profile">
              <div className="difference-profile-header">
                <span className="profile-label">Profile:</span>
                <span className="profile-name">{profileName}</span>
              </div>
              <div className="difference-icon-info">
                <span className="icon-label">Icon:</span>
                <span className="icon-id">{icon.id}</span>
              </div>
              <div className="difference-value-section">
                <span className="value-label">Value:</span>
                <div className="value-box">{formatValue(currentValue)}</div>
              </div>
            </div>

            <div className="difference-divider"></div>

            <div className="difference-profile-section other-profile">
              <div className="difference-profile-header">
                <span className="profile-label">Profile:</span>
                <span className="profile-name">{otherProfileName}</span>
              </div>
              <div className="difference-icon-info">
                <span className="icon-label">Icon:</span>
                <span className="icon-id">{otherIcon.id}</span>
              </div>
              <div className="difference-value-section">
                <span className="value-label">Value:</span>
                <div className="value-box">{formatValue(otherValue)}</div>
              </div>
            </div>
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

export default DifferenceViewer;
