import React from "react";
import { useLocation } from "react-router-dom";
import "../App.css";

interface EditIconProps {
  iconName: string;
  onClose: () => void;
}

const EditIcon: React.FC<EditIconProps> = ({ iconName, onClose }) => {
  // Get the row and column from the URL query parameters
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const row = queryParams.get("row");
  const col = queryParams.get("col");



  return (
    <div className="edit-icon-container">
      <div className="edit-icon-header">
        <span>{iconName}</span>
        <button onClick={onClose} className="edit-icon-close">
          ✖
        </button>
      </div>
      <div className="edit-icon-content">
        <p>
          Editing icon at row {row}, column {col}
        </p>
      </div>
    </div>
  );
};

export default EditIcon;
