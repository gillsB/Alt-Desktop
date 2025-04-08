import React, { useEffect, useState } from "react";
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

  return (
    <div className="edit-icon-container">
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
      <div className="edit-icon-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default EditIcon;
