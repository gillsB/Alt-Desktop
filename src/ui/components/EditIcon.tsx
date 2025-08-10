import {
  FolderIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getDefaultDesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import "../styles/EditIcon.css";
import { createLogger } from "../util/uiLogger";
import { fileNameNoExt, showSmallWindow } from "../util/uiUtil";
import ClearableInput from "./ClearableInput";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditIcon.tsx");

const EditIcon: React.FC = () => {
  const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g; // Sanitize folder names
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get("id");
  const row = queryParams.get("row");
  const col = queryParams.get("col");

  const [icon, setIcon] = useState<DesktopIcon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringImage, setHoveringImage] = useState(false);
  const [isHoveringProgram, setHoveringProgram] = useState(false);
  const [isHoveringImageGlass, setHoveringImageGlass] = useState(false);

  const dragCounter = useRef(0);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const originalIcon = useRef<DesktopIcon | null>(null);

  const [fontColorDefault, setFontColorDefault] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const fetchFontColorDefault = async () => {
      const color = await window.electron.getSetting("defaultFontColor");
      setFontColorDefault(color);
    };
    fetchFontColorDefault();
  }, []);

  useEffect(() => {
    const fetchIcon = async () => {
      if (!id || !row || !col) {
        setError(`Parameters are missing: id={$id}, row= {$row}, col=${col}`);
        setLoading(false);
        return;
      }

      try {
        const iconData = await window.electron.getDesktopIcon(id);

        if (iconData) {
          setIcon(iconData);
          originalIcon.current = { ...iconData };
          logger.info("Fetched icon data successfully.");
        } else {
          // Use the default DesktopIcon values
          const defaultIcon = getDefaultDesktopIcon(
            id,
            parseInt(row, 10),
            parseInt(col, 10)
          );
          setIcon(defaultIcon);
          originalIcon.current = { ...defaultIcon };
          logger.warn(`No icon found ${id}. Initialized with default values.`);
        }
      } catch (err) {
        console.error("Error fetching icon:", err);
        setError("Failed to fetch icon data.");
        logger.error("Error fetching icon:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIcon();
  }, [id]);

  const getChanges = (): boolean => {
    if (!icon || !originalIcon.current) {
      return false; // No changes if either the current or original icon is null
    }

    // Dynamically compare all keys in the icon object
    for (const key of Object.keys(icon)) {
      if (
        icon[key as keyof DesktopIcon] !==
        originalIcon.current[key as keyof DesktopIcon]
      ) {
        return true; // Return true if any field has changed
      }
    }

    return false; // No changes detected
  };

  const handleClose = async () => {
    logger.info(`User attempting to close EditIcon[${id}]`);
    if (getChanges()) {
      try {
        const ret = await showSmallWindow(
          "Close Without Saving",
          "Close without saving the changes?",
          ["Yes", "No"]
        );
        if (ret === "Yes") {
          logger.info("User confirmed to close without saving.");
          closeWindow();
        }
      } catch (error) {
        logger.error("Error showing close confirmation window:", error);
      }
    } else {
      logger.info("No changes detected, closing without confirmation.");
      closeWindow();
    }
  };

  const closeWindow = async () => {
    // reload icon
    if (!icon) {
      logger.error("Icon data is missing. (closeWindow)");
      return;
    }
    await window.electron.reloadIcon(icon.id);
    logger.info("reloaded icon before closing");

    // close subwindow
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = async () => {
    if (!icon) {
      logger.error("Icon data is missing.");
      return;
    }

    try {
      const oldId = icon.id;
      const iconName = icon.name?.trim() || "";

      let newId: string | null;
      let nameChanged: boolean = false;

      if (!oldId || !iconName) {
        // If either id or name is empty, use "unknownIcon"
        logger.info("new icon and no name");
        newId = await window.electron.ensureUniqueIconId(
          iconName || "unknownIcon"
        );
        nameChanged = true;
      } else if (oldId !== iconName) {
        logger.info("icon name changed, generating new id");
        // If sanitized id does not match name, generate new id
        newId = await window.electron.ensureUniqueIconId(iconName);
        nameChanged = true;
      } else {
        // Otherwise, keep the current id
        logger.info("icon name not changed, not updating id");
        newId = icon.id;
      }
      // Fail to read -> cancel save and warn user. (Avoid giving it an arbitrary id as it could corrupt files)
      if (newId === null) {
        await showSmallWindow(
          "Failed to Read",
          "Failed to read desktopIcons.json file. Cannot generate unique icon ID.",
          ["Okay"]
        );
        return;
      }
      if (nameChanged) {
        logger.info("Renaming folder : " + oldId + " To: " + newId);
        await window.electron.renameDataFolder(oldId, newId);
      }

      icon.id = newId;

      // Check if the image path looks like a full file path and save if it is.
      // Otherwise it is a local file path and should already be saved.
      const driveLetterRegex = /^[a-zA-Z]:[\\/]/;
      if (driveLetterRegex.test(icon.image)) {
        const fileType = await window.electron.getFileType(icon.image);
        if (fileType.startsWith("image/")) {
          logger.info(`Resolving full file path for image: ${icon.image}`);
          try {
            const savedFilePath = await window.electron.saveIconImage(
              icon.image,
              icon.id
            );

            // Update the icon's image path with the resolved file path
            icon.image = savedFilePath;
            logger.info(`Image resolved and saved to: ${savedFilePath}`);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("Source file does not exist:")
            ) {
              logger.error("Failed to resolve and save image path:", error);
              showSmallWindow(
                "Bad Image Path",
                `Image path: ${icon.image} \nis invalid or does not exist.`,
                ["Okay"]
              );
            } else {
              logger.error("Unexpected error during save operation:", error);
            }
            return; // Stop saving if the image resolution fails
          }
        } else {
          logger.warn(
            `SaveIconImage failed with ${icon.image}, external drive detected but fileType not image ${fileType}`
          );
        }
      }

      // Save the icon data
      if (!(await window.electron.setIconData(icon))) {
        logger.error("Failed to reload icon.");
        const ret = await showSmallWindow(
          "Error",
          "Failed to update icon data. Please report this error.\nDo you still want to close?",
          ["Yes", "No"]
        );
        if (ret === "Yes") {
          logger.info("User confirmed to close after error.");
          closeWindow();
        }
      } else {
        closeWindow();
      }
    } catch (error) {
      logger.error("Error during save operation:", error);
    }
  };

  const handleGenerateIcon = async () => {
    if (!icon) return;
    try {
      let iconPaths = await window.electron.generateIcon(
        icon.id,
        icon.programLink ?? "",
        icon.websiteLink ?? ""
      );
      if (icon.image && !iconPaths.includes(icon.image)) {
        iconPaths = [icon.image, ...iconPaths];
      }

      let selectedIcon: string | undefined;
      if (iconPaths.length > 1) {
        selectedIcon = await window.electron.selectIconFromList(
          "Select an icon",
          iconPaths,
          icon.id,
          icon.row,
          icon.col
        );
        logger.info(`Selected icon: ${selectedIcon}`);
      } else if (iconPaths.length === 1) {
        selectedIcon = iconPaths[0];
        logger.info(
          "Only one icon path available, auto-selected: ",
          selectedIcon
        );
      } else {
        logger.warn("No icon paths available.");
      }
      if (selectedIcon) {
        setIcon((prevIcon) =>
          prevIcon ? { ...prevIcon, image: selectedIcon } : null
        );
        sendPreviewUpdate({ image: selectedIcon });
      } else {
        logger.info("No selected icon");
      }
    } catch (e) {
      logger.error("Error during autoGenIcon", e);
    }
  };

  const handleFileSelect = async (type: string) => {
    if (!icon) return;

    try {
      // Open a file dialog to select an image
      if (type === "image") {
        logger.info("Opening file dialog for image selection.");
        const filePath = await window.electron.openFileDialog("image");
        if (filePath) {
          // Update the icon's image path
          setIcon((prevIcon) =>
            prevIcon ? { ...prevIcon, image: filePath } : null
          );
          sendPreviewUpdate({ image: filePath });
        }
      } else {
        logger.info(`Opening file dialog for ${type} selection.`);
        const filePath = await window.electron.openFileDialog("File");
        if (filePath) {
          // Update the icon's program link
          setIcon((prevIcon) => {
            if (!prevIcon) return null;
            const updatedIcon = { ...prevIcon, programLink: filePath };
            if (!prevIcon.name || prevIcon.name.trim() === "") {
              updatedIcon.name = fileNameNoExt(filePath);
            }
            return updatedIcon;
          });
        }
      }
    } catch (error) {
      logger.error("Failed to select or save image:", error);
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

    // Reset counter and state
    dragCounter.current = 0;
    setIsDragging(false);

    if (!icon) return;

    const files = event.dataTransfer.files[0];
    const filePath = window.electron.getFilePath(files);
    const fileType = await window.electron.getFileType(filePath);
    logger.info("Returned filePath from dropped file: ", filePath);
    if (fileType.startsWith("image/")) {
      try {
        logger.info("Dropped file is an image:");
        setIcon((prevIcon) =>
          prevIcon ? { ...prevIcon, image: filePath } : null
        );
        sendPreviewUpdate({ image: filePath });
      } catch (error) {
        logger.error("Failed to save image:", error);
      }
    } else {
      logger.info("Dropped file is not an image:");
      setIcon((prevIcon) => {
        if (!prevIcon) return null;
        const updatedIcon = { ...prevIcon, programLink: filePath };
        if (!prevIcon.name || prevIcon.name.trim() === "") {
          updatedIcon.name = fileNameNoExt(filePath);
        }
        return updatedIcon;
      });
    }
  };

  const sendPreviewUpdate = async (updatedFields: Partial<DesktopIcon>) => {
    if (!icon) return;
    try {
      await window.electron.previewIconUpdate(icon.id, updatedFields);
    } catch (error) {
      logger.error("Failed to send icon preview update:", error);
    }
  };

  const handleImageMagnifyClick = async () => {
    if (icon) {
      const filePath = `data/${id}/`;

      const success = await window.electron.openFileDialog("image", filePath);
      logger.info("Open file dialog result:", success);
      if (success) {
        setIcon((prevIcon) =>
          prevIcon ? { ...prevIcon, image: success } : null
        );
        sendPreviewUpdate({ image: success });
      } else {
        logger.info(
          "No file selected or dialog closed without selection.",
          success
        );
      }
    } else {
      logger.error("Icon data is missing. (handleImageMagnifyClick)");
    }
  };

  return (
    <div
      className="subwindow-container"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      <SubWindowHeader
        title={`Editing [${id}], at [${row}, ${col}]`}
        onClose={handleClose}
      />
      <div className="subwindow-content">
        {loading && <div>Loading...</div>}
        {error && <div>Error: {error}</div>}
        {!loading && !error && icon && (
          <>
            <div className="subwindow-field">
              <label htmlFor="icon-name">Icon Name</label>
              <ClearableInput
                id="icon-name"
                flex={true}
                value={icon.name}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(
                    INVALID_FOLDER_CHARS,
                    ""
                  );
                  const updatedValue = sanitized;
                  setIcon({ ...icon, name: updatedValue });
                  sendPreviewUpdate({ name: updatedValue });
                }}
              />
            </div>
            <div className="subwindow-field">
              <label htmlFor="image-path">Image Path</label>
              <ClearableInput
                id="image-path"
                flex={true}
                value={icon.image}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({ ...icon, image: updatedValue });
                  sendPreviewUpdate({ image: updatedValue });
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
                onClick={handleImageMagnifyClick}
                onMouseEnter={() => setHoveringImageGlass(true)}
                onMouseLeave={() => setHoveringImageGlass(false)}
                title="Select from previously set background images"
              >
                <MagnifyingGlassIcon
                  className={`custom-magnifying-glass-icon ${
                    isHoveringImageGlass ? "hovered" : ""
                  }`}
                />
              </button>
            </div>
            <div className="subwindow-field">
              <label htmlFor="program-path">Program Path</label>
              <ClearableInput
                id="program-path"
                flex={true}
                value={icon.programLink}
                onChange={(e) =>
                  setIcon((prevIcon) =>
                    prevIcon
                      ? { ...prevIcon, programLink: e.target.value }
                      : null
                  )
                }
              />
              <button
                className="file-select-button flex items-center gap-2"
                onClick={() => handleFileSelect("file")} //update this with parameter to open program
                onMouseEnter={() => setHoveringProgram(true)}
                onMouseLeave={() => setHoveringProgram(false)}
              >
                {isHoveringProgram ? (
                  <FolderOpenIcon className="custom-folder-icon" />
                ) : (
                  <FolderIcon className="custom-folder-icon" />
                )}
              </button>
            </div>
            <div className="subwindow-field">
              <label htmlFor="website-path">Website Link</label>
              <ClearableInput
                id="website-link"
                flex={true}
                value={icon.websiteLink}
                onChange={(e) =>
                  setIcon((prevIcon) =>
                    prevIcon
                      ? { ...prevIcon, websiteLink: e.target.value }
                      : null
                  )
                }
              />
            </div>
            <div className="subwindow-field" style={{ position: "relative" }}>
              <label htmlFor="font-color">Font Color</label>
              <div className="color-input-container">
                <ClearableInput
                  id="font-color"
                  flex={true}
                  value={icon.fontColor}
                  title="Leave blank for default font color (in settings)"
                  onChange={(e) => {
                    setIcon({ ...icon, fontColor: e.target.value });
                    sendPreviewUpdate({ fontColor: e.target.value });
                  }}
                />
                <div
                  className="color-preview"
                  style={{
                    backgroundColor: icon.fontColor || fontColorDefault,
                  }}
                >
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={icon.fontColor}
                    onChange={(e) => {
                      setIcon({ ...icon, fontColor: e.target.value });
                      sendPreviewUpdate({ fontColor: e.target.value });
                    }}
                    tabIndex={-1}
                  />
                </div>
                <button
                  type="button"
                  className="default-font-color-btn"
                  onClick={() => {
                    setIcon({ ...icon, fontColor: "" });
                    sendPreviewUpdate({ fontColor: "" });
                  }}
                  title="Reset to default font color"
                >
                  Default
                </button>
              </div>
            </div>
            <div className="subwindow-field">
              <label htmlFor="font-size">Font Size</label>
              <input
                id="font-size"
                type="number"
                title="Leave blank for default size"
                value={icon.fontSize}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({
                    ...icon,
                    fontSize:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                  sendPreviewUpdate({
                    fontSize:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                }}
              />
            </div>
            <div className="subwindow-field">
              <label htmlFor="offset-x">Offset X</label>
              <input
                id="offset-x"
                type="number"
                title="Leave blank for default offset"
                value={icon.offsetX}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({
                    ...icon,
                    offsetX:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                  sendPreviewUpdate({
                    offsetX:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                }}
              />
            </div>
            <div className="subwindow-field">
              <label htmlFor="offset-y">Offset Y</label>
              <input
                id="offset-y"
                type="number"
                title="Leave blank for default offset"
                value={icon.offsetY}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({
                    ...icon,
                    offsetY:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                  sendPreviewUpdate({
                    offsetY:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                }}
              />
            </div>
            <div className="subwindow-field">
              <label htmlFor="icon-width">Icon width</label>
              <input
                id="icon-width"
                type="number"
                title="Leave blank for default width"
                value={icon.width}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({
                    ...icon,
                    width:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                  sendPreviewUpdate({
                    width:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                }}
              />
            </div>
            <div className="subwindow-field">
              <label htmlFor="icon-height">Icon height</label>
              <input
                id="icon-height"
                type="number"
                title="Leave blank for default height"
                value={icon.height}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({
                    ...icon,
                    height:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                  sendPreviewUpdate({
                    height:
                      updatedValue === ""
                        ? undefined
                        : parseFloat(updatedValue),
                  });
                }}
              />
            </div>
            <div className="subwindow-field dropdown-container">
              <label htmlFor="launch-default">Launch Default</label>
              <select
                id="launch-default"
                value={
                  icon.launchDefault === "website" ? "Website Link" : "Program"
                }
                onChange={(e) => {
                  const updatedValue =
                    e.target.value === "Website Link" ? "website" : "program";
                  setIcon((prevIcon) =>
                    prevIcon
                      ? { ...prevIcon, launchDefault: updatedValue }
                      : null
                  );
                  sendPreviewUpdate({ launchDefault: updatedValue });
                }}
              >
                <option value="Program">Program</option>
                <option value="Website Link">Website Link</option>
              </select>
            </div>
          </>
        )}
      </div>
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            <div className="drag-icon">+</div>
            <div className="drag-text">Drop image or program file here.</div>
          </div>
        </div>
      )}
      <div className="subwindow-footer">
        <button className="generate-button" onClick={handleGenerateIcon}>
          Generate icon
        </button>
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default EditIcon;
