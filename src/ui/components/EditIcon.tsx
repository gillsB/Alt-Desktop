import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { DesktopIcon, getDefaultDesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import { createLogger } from "../util/uiLogger";
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

  const dragCounter = useRef(0);

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
          logger.info("Fetched icon data successfully.");
        } else {
          // Use the default DesktopIcon values
          setIcon(getDefaultDesktopIcon(parseInt(row, 10), parseInt(col, 10)));
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

  const handleSave = async () => {
    if (!icon) {
      console.error("Icon data is missing.");
      logger.error("Icon data is missing.");
      return;
    }

    if (await window.electron.setIconData(icon)) {
      if (await window.electron.reloadIcon(icon.row, icon.col)) {
        console.log("Icon reloaded successfully");
        logger.info("Icon reloaded successfully.");
      } else {
        console.error("Failed to reload icon");
        logger.error("Failed to reload icon.");
      }
      window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
    } else {
      console.log("Failed to save icon");
      logger.warn("Failed to save icon.");
    }
  };

  const handleFileSelect = async () => {
    if (!icon) return;

    try {
      // Open a file dialog to select an image
      const filePath = await window.electron.openFileDialog();
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

  return (
    <div
      className="edit-icon-container"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      <SubWindowHeader />
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
                onChange={(e) => setIcon({ ...icon, name: e.target.value })}
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
              <button onClick={handleFileSelect}>Select Image</button>
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
