import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import { SubWindowHeader } from "./SubWindowHeader";

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
          window.electron.logMessage(
            "info",
            "EditIcon.tsx",
            "Fetched icon data successfully."
          );
        } else {
          setError(`No icon found at row ${row}, column ${col}.`);
          window.electron.logMessage("warn", "EditIcon.tsx", "No icon found.");
        }
      } catch (err) {
        console.error("Error fetching icon:", err);
        setError("Failed to fetch icon data.");
        window.electron.logMessage(
          "error",
          "EditIcon.tsx",
          `Error fetching icon: ${err}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchIcon();
  }, [row, col]);

  const handleSave = async () => {
    // Ensure valid icon
    if (!icon) {
      console.error("Icon data is missing.");
      return;
    } // Try to set Icon data
    else if (await window.electron.setIconData(icon)) {
      // Reload Icon data
      if (await window.electron.reloadIcon(icon.row, icon.col)) {
        console.log("Icon reloaded successfully");
      } else {
        console.error("Failed to reload icon");
      }
      window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
    } else {
      console.log("Failed to save icon");
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
                onChange={(e) => setIcon({ ...icon, image: e.target.value })}
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
      <div className="edit-icon-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default EditIcon;
