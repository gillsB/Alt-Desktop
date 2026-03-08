import React, { useEffect, useState } from "react";
import { SafeImage } from "../components/SafeImage";
import "../styles/IconDifferenceViewer.css";
import { showSmallWindow } from "../util/uiUtil";

interface IconDifferenceViewerProps {
  profileName: string;
  icon: DesktopIcon;
  otherProfileName: string;
  otherIcon: DesktopIcon;
  differences: string[];
  onClose: (saved?: boolean) => void;
  desktopComparison?: boolean;
}

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

const IconDifferenceViewer: React.FC<IconDifferenceViewerProps> = ({
  profileName,
  icon,
  otherProfileName,
  otherIcon,
  differences,
  onClose,
  desktopComparison = false,
}) => {
  const [showAllFields, setShowAllFields] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  window.electron.hoverHighlightIcon(icon.id);

  const buildFieldMap = (iconObj: DesktopIcon) => {
    const map: Record<string, string> = {};
    fieldsToCompare.forEach((f) => {
      map[String(f)] = formatValue(iconObj[f]);
    });
    return map;
  };

  const [left, setLeft] = useState<Record<string, string>>(() =>
    buildFieldMap(icon)
  );

  const [right, setRight] = useState<Record<string, string>>(() =>
    buildFieldMap(otherIcon)
  );

  const leftEdited = (field: string) =>
    left[field] !== formatValue(icon[field as keyof DesktopIcon]);

  const rightEdited = (field: string) =>
    right[field] !== formatValue(otherIcon[field as keyof DesktopIcon]);

  const isAnyLeftEdited = fieldsToCompare.some((f) => leftEdited(String(f)));

  const isAnyRightEdited = fieldsToCompare.some((f) => rightEdited(String(f)));

  const fieldsMatch = (field: string) => left[field] === right[field];

  const [leftImageSource, setLeftImageSource] = useState<"left" | "right">(
    "left"
  );
  const [rightImageSource, setRightImageSource] = useState<"left" | "right">(
    "right"
  );

  const copyLeftToRight = (field: string) => {
    setRight((prev) => ({ ...prev, [field]: left[field] }));

    if (field === "image") {
      setRightImageSource("left");
    }
  };

  const copyRightToLeft = (field: string) => {
    setLeft((prev) => ({ ...prev, [field]: right[field] }));

    if (field === "image") {
      setLeftImageSource("right");
    }
  };

  const resetField = (field: string) => {
    setLeft((prev) => ({
      ...prev,
      [field]: formatValue(icon[field as keyof DesktopIcon]),
    }));

    setRight((prev) => ({
      ...prev,
      [field]: formatValue(otherIcon[field as keyof DesktopIcon]),
    }));

    if (field === "image") {
      setLeftImageSource("left");
      setRightImageSource("right");
    }
  };

  // Mirror preview logic for images
  const leftMirrorsRight =
    leftEdited("image") && left["image"] === formatValue(otherIcon.image);
  const rightMirrorsLeft =
    rightEdited("image") && right["image"] === formatValue(icon.image);

  const previewLeftIcon = leftMirrorsRight
    ? { ...otherIcon, image: left["image"] }
    : { ...icon, image: left["image"] };

  const previewRightIcon = rightMirrorsLeft
    ? { ...icon, image: right["image"] }
    : { ...otherIcon, image: right["image"] };

  const previewLeftProfile = leftMirrorsRight ? otherProfileName : profileName;
  const previewRightProfile = rightMirrorsLeft ? profileName : otherProfileName;

  // Show "Windows Desktop Icon" instead of "desktop_cache" if comparing to desktop
  const displayOtherProfileName =
    desktopComparison && otherProfileName === "desktop_cache"
      ? "Windows Desktop Icon"
      : otherProfileName;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [hasSaved]);

  const saveLeft = async () => {
    const iconBackup = { ...icon };
    fieldsToCompare.forEach((field) => {
      if (leftEdited(String(field))) {
        icon[field] = parseFieldValue(field, left[String(field)]) as never;
      }
    });

    if (leftImageSource === "right" && otherIcon.image) {
      const transferredFileName = await window.electron.transferIconImage(
        otherProfileName,
        otherIcon.id,
        profileName,
        icon.id
      );

      if (!transferredFileName) {
        showSmallWindow(
          "Error",
          `Failed to transfer image file from profile 
            \n${otherProfileName}: ${otherIcon.id} ${otherIcon.image}, 
            \nto ${profileName}: ${icon.id} ${icon.image} 
            \nChanges not saved.`
        );
        return;
      }

      icon.image = transferredFileName;
    }

    const result = await window.electron.saveIcon(
      iconBackup,
      icon,
      profileName
    );

    if (result.success) {
      if (result.newID) {
        icon.id = result.newID;
      }
      setLeft(buildFieldMap(icon));

      if (iconBackup.id !== icon.id) {
        await window.electron.reloadIcon(iconBackup.id);
      }
      await window.electron.reloadIcon(icon.id);

      setHasSaved(true);
    } else {
      Object.assign(icon, iconBackup);
    }
  };

  const saveRight = async () => {
    const otherIconBackup = { ...otherIcon };

    fieldsToCompare.forEach((field) => {
      if (rightEdited(String(field))) {
        otherIcon[field] = parseFieldValue(
          field,
          right[String(field)]
        ) as never;
      }
    });

    if (rightImageSource === "left" && icon.image) {
      const transferredFileName = await window.electron.transferIconImage(
        profileName,
        icon.id,
        otherProfileName,
        otherIcon.id
      );

      if (!transferredFileName) {
        showSmallWindow("Error", "Failed to transfer image.");
        return;
      }

      otherIcon.image = transferredFileName;
    }

    const result = await window.electron.saveIcon(
      otherIconBackup,
      otherIcon,
      otherProfileName
    );

    if (result.success) {
      if (result.newID) otherIcon.id = result.newID;
      setRight(buildFieldMap(otherIcon));
      setHasSaved(true);
    } else {
      Object.assign(otherIcon, otherIconBackup);
    }
  };

  const handleClose = () => {
    onClose(hasSaved);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-window-content modal-window-content-icon-difference-viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content icon-difference-viewer-content">
          {/* ICON PREVIEW */}
          <div className="icon-comparison-header">
            <div className="checkbox-container">
              <input
                type="checkbox"
                checked={showAllFields}
                onChange={(e) => setShowAllFields(e.target.checked)}
              />
              <label onClick={() => setShowAllFields(!showAllFields)}>
                Show all fields
              </label>
            </div>
            <div className="icon-comparison-column">
              <div className="icon-container">
                <div className="comparison-profile-name">{profileName}</div>
                <SafeImage
                  profile={previewLeftProfile}
                  id={previewLeftIcon.id}
                  row={previewLeftIcon.row}
                  col={previewLeftIcon.col}
                  imagePath={previewLeftIcon.image}
                  width={64}
                  height={64}
                  highlighted={false}
                />
                <div className="comparison-icon-id">
                  {left["name"] || icon.id}
                </div>
              </div>
              <div className="icon-container">
                <div className="comparison-profile-name">
                  {displayOtherProfileName}
                </div>
                <SafeImage
                  profile={previewRightProfile}
                  id={previewRightIcon.id}
                  row={previewRightIcon.row}
                  col={previewRightIcon.col}
                  imagePath={previewRightIcon.image}
                  width={64}
                  height={64}
                  highlighted={false}
                />
                <div className="comparison-icon-id">
                  {right["name"] || otherIcon.id}
                </div>
              </div>
            </div>
          </div>
          {/* SAVE BUTTONS (only when comparing two profiles) */}
          {!desktopComparison && (
            <div className="icon-save-buttons-row">
              <div className="icon-save-buttons-inner">
                <button
                  className="button icon-save-button"
                  onClick={saveLeft}
                  disabled={!isAnyLeftEdited}
                >
                  Save {profileName}
                </button>
                <button
                  className="button icon-save-button"
                  onClick={saveRight}
                  disabled={!isAnyRightEdited}
                >
                  Save {displayOtherProfileName}
                </button>
              </div>
            </div>
          )}
          {/* FIELD ROWS */}
          <div className="icon-fields-comparison">
            {fieldsToCompare.map((field) => {
              const fieldName = String(field);
              const isDifferent = differences.includes(fieldName);
              if (!showAllFields && !isDifferent) return null;
              const match = fieldsMatch(fieldName);
              const edited = leftEdited(fieldName) || rightEdited(fieldName);
              return (
                <div
                  key={fieldName}
                  className={`icon-field-row ${match ? "same" : "different"}`}
                >
                  <div className="field-indicator">
                    <div
                      className={`indicator-dot ${match ? "green" : "yellow"}`}
                    />
                  </div>
                  <div className="field-name">
                    {fieldName}
                    {edited && <span className="unsaved-indicator">*</span>}
                  </div>
                  <div className="field-values">
                    <div className="field-value">{left[fieldName]}</div>
                    <div className="field-buttons">
                      {edited ? (
                        <button
                          className="field-copy-btn field-copy-center"
                          onClick={() => resetField(fieldName)}
                          title="Reset to original"
                        >
                          ↩️
                        </button>
                      ) : !match ? (
                        <>
                          <button
                            className="button field-copy-left"
                            onClick={() => copyRightToLeft(fieldName)}
                            title="Copy right to left"
                          >
                            &lt;
                          </button>
                          {!desktopComparison && (
                            <button
                              className="button field-copy-right"
                              onClick={() => copyLeftToRight(fieldName)}
                              title="Copy left to right"
                            >
                              &gt;
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                    <div className="field-value">{right[fieldName]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-window-footer">
          <button className="button" onClick={handleClose}>
            Close
          </button>
          {desktopComparison && (
            <button
              className="button icon-save-button"
              onClick={saveLeft}
              disabled={!isAnyLeftEdited}
            >
              Save {profileName}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IconDifferenceViewer;
