import React from "react";
import "../App.css";

interface EditIconProps {
  iconName: string;
  onClose: () => void;
}

const EditIcon: React.FC<EditIconProps> = ({ iconName, onClose }) => {
  return (
    <div className="edit-icon-container">
      <div className="edit-icon-header">
        <span>{iconName}</span>
        <button onClick={onClose} className="edit-icon-close">
          ✖
        </button>
      </div>
      <div className="edit-icon-content">
        <p>Icon Details Here</p>
      </div>
    </div>
  );
};

export default EditIcon;
