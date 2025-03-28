import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";
import { SubWindowHeader } from "./SubWindowHeader";

interface EditIconProps {
  onClose: () => void;
}

const EditIcon: React.FC<EditIconProps> = ({ onClose }) => {
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
        } else {
          setError(`No icon found at row ${row}, column ${col}.`);
        }
      } catch (err) {
        console.error("Error fetching icon:", err);
        setError("Failed to fetch icon data.");
      } finally {
        setLoading(false);
      }
    };

    fetchIcon();
  }, [row, col]);

  return (
    <div className="edit-icon-container">
      <SubWindowHeader onClose={onClose} />
      <div className="edit-icon-content">
        {loading && <div>Loading...</div>}
        {error && <div>Error: {error}</div>}
        {!loading && !error && icon && (
          <>
            <div className="edit-icon-field">
              <label htmlFor="icon-name">Icon Name</label>
              <input id="icon-name" type="text" value={icon.name} />
            </div>
            <div className="edit-icon-field">
              <label htmlFor="image-path">Image Path</label>
              <input id="image-path" type="text" value={icon.image} />
            </div>
            <div className="edit-icon-field">
              <label htmlFor="font-color">Font Color</label>
              <input id="font-color" type="text" value={icon.fontColor} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EditIcon;
