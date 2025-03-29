import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { DesktopIcon } from "../../electron/DesktopIcon";
import "../App.css";

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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!icon) {
    return <div>No icon data available.</div>;
  }

  return (
    <div className="edit-icon-container">
      <div className="edit-icon-header">
        <span>Edit Desktop Icon</span>
        <button onClick={onClose} className="edit-icon-close">
          ✖
        </button>
      </div>
      <div className="edit-icon-content">
        <div className="edit-icon-field">
          <label htmlFor="icon-name">Icon Name</label>
          <input
            id="icon-name"
            type="text"
            value={icon.name}
          />
        </div>
        <div className="edit-icon-field">
          <label htmlFor="image-path">Image Path</label>
          <input
            id="image-path"
            type="text"
            value={icon.image}
          />
        </div>
        <div className="edit-icon-field">
          <label htmlFor="font-color">Font Color</label>
          <input
            id="font-color"
            type="text"
            value={icon.fontColor}
          />
        </div>
      </div>
    </div>
  );
};

export default EditIcon;
