import { FolderIcon, FolderOpenIcon } from "@heroicons/react/24/solid";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { DesktopIcon, getDefaultDesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditIcon.tsx");

const EditIcon: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const row = queryParams.get("row");
  const col = queryParams.get("col");

  const [icon, setIcon] = useState<DesktopIcon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringImage, setHoveringImage] = useState(false);
  const [isHoveringProgram, setHoveringProgram] = useState(false);

  const dragCounter = useRef(0);

  const originalIcon = useRef<DesktopIcon | null>(null);

  useEffect(() => {
    const fetchIcon = async () => {
      if (!row || !col) {
        setError("Row and column parameters are missing.");
        setLoading(false);
        return;
      }

      try {
        const iconData = await window.electron.getDesktopIcon(
          parseInt(row, 10),
          parseInt(col, 10)
        );

        if (iconData) {
          setIcon(iconData);
          originalIcon.current = { ...iconData };
          logger.info("Fetched icon data successfully.");
        } else {
          // Use the default DesktopIcon values
          const defaultIcon = getDefaultDesktopIcon(
            parseInt(row, 10),
            parseInt(col, 10)
          );
          setIcon(defaultIcon);
          originalIcon.current = { ...defaultIcon };
          logger.warn(
            `No icon found at row ${row}, column ${col}. Initialized with default values.`
          );
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
  }, [row, col]);

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
    logger.info(`User attempting to close EditIcon[${row},${col}]`);
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

  const closeWindow = () => {
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = async () => {
    if (!icon) {
      console.error("Icon data is missing.");
      logger.error("Icon data is missing.");
      return;
    }

    try {
      // Check if the image path looks like a full file path
      const validExtensions = /\.(png|jpg|jpeg|gif|bmp|svg|webp)$/i;
      const driveLetterRegex = /^[a-zA-Z]:[\\/]/;

      if (
        validExtensions.test(icon.image) &&
        driveLetterRegex.test(icon.image)
      ) {
        logger.info(`Resolving full file path for image: ${icon.image}`);
        try {
          const savedFilePath = await window.electron.saveIconImage(
            icon.image,
            icon.row,
            icon.col
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
      }

      // Save the icon data
      if (await window.electron.setIconData(icon)) {
        if (await window.electron.reloadIcon(icon.row, icon.col)) {
          console.log("Icon reloaded successfully");
          logger.info("Icon reloaded successfully.");
        } else {
          console.error("Failed to reload icon");
          logger.error("Failed to reload icon.");
        }
        closeWindow();
      } else {
        console.log("Failed to save icon");
        logger.warn("Failed to save icon.");
      }
    } catch (error) {
      logger.error("Error during save operation:", error);
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
          // Save the file to the appropriate folder
          const savedFilePath = await window.electron.saveIconImage(
            filePath,
            icon.row,
            icon.col
          );

          // Update the icon's image path
          setIcon((prevIcon) =>
            prevIcon ? { ...prevIcon, image: savedFilePath } : null
          );
          logger.info(`Image saved to: ${savedFilePath}`);
        }
      } else {
        logger.info(`Opening file dialog for ${type} selection.`);
        const filePath = await window.electron.openFileDialog("File");
        if (filePath) {
          // Update the icon's program link
          setIcon((prevIcon) =>
            prevIcon ? { ...prevIcon, programLink: filePath } : null
          );
          logger.info(`Program link updated to: ${filePath}`);
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
        const savedFilePath = await window.electron.saveIconImage(
          filePath,
          icon.row,
          icon.col
        );

        setIcon((prevIcon) =>
          prevIcon ? { ...prevIcon, image: savedFilePath } : null
        );
        logger.info(`Image saved to: ${savedFilePath}`);
      } catch (error) {
        logger.error("Failed to save image:", error);
      }
    } else {
      logger.info("Dropped file is not an image:");
      setIcon((prevIcon) =>
        prevIcon ? { ...prevIcon, programLink: filePath } : null
      );
    }
  };

  const sendPreviewUpdate = async (updatedFields: Partial<DesktopIcon>) => {
    if (!icon) return;
    try {
      await window.electron.previewIconUpdate(
        icon.row,
        icon.col,
        updatedFields
      );
      logger.info(`Sent preview update for [${icon.row},${icon.col}]`);
    } catch (error) {
      logger.error("Failed to send icon preview update:", error);
    }
  };

  return (
    <div
      className="edit-icon-container"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      <SubWindowHeader
        title={`Editing [${row},${col}]`}
        onClose={handleClose}
      />
      <div className="edit-icon-content">
        {loading && <div>Loading...</div>}
        {error && <div>Error: {error}</div>}
        {!loading && !error && icon && (
          <>
            <div className="edit-icon-field">
              <label htmlFor="icon-name">Icon Name</label>
              <input
                id="icon-name"
                type="text"
                value={icon.name}
                onChange={(e) => {
                  const updatedValue = e.target.value;
                  setIcon({ ...icon, name: updatedValue });
                  sendPreviewUpdate({ name: updatedValue });
                }}
              />
            </div>
            <div className="edit-icon-field">
              <label htmlFor="image-path">Image Path</label>
              <input
                id="image-path"
                type="text"
                value={icon.image}
                onChange={(e) =>
                  setIcon((prevIcon) =>
                    prevIcon ? { ...prevIcon, image: e.target.value } : null
                  )
                }
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
            <div className="edit-icon-field">
              <label htmlFor="program-path">Program Path</label>
              <input
                id="program-path"
                type="text"
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
            <div className="edit-icon-field">
              <label htmlFor="website-path">Website Link</label>
              <input
                id="website-link"
                type="text"
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
            <div className="edit-icon-field">
              <label htmlFor="font-color">Font Color</label>
              <input
                id="font-color"
                type="text"
                value={icon.fontColor}
                onChange={(e) =>
                  setIcon({ ...icon, fontColor: e.target.value })
                }
              />
            </div>
            <div className="edit-icon-field">
              <label htmlFor="font-size">Font Size</label>
              <input
                id="font-size"
                type="number"
                value={icon.fontSize}
                onChange={(e) =>
                  setIcon({
                    ...icon,
                    fontSize: parseFloat(e.target.value) || 0,
                  })
                }
              />
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
      <div className="edit-icon-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default EditIcon;
