import React, { useState } from "react";
import "../styles/EditTags.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("EditTags.tsx");

const EditTagsWindow: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [tagInput, setTagInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase, replace spaces with "-"
    const value = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setTagInput(value);
  };

  const handleCreateTag = () => {
    logger.info(`Create Tag clicked with value: ${tagInput}`);
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <div className="subwindow-field">
          <label>Tag Name:</label>
          <input
            type="text"
            value={tagInput}
            onChange={handleInputChange}
            placeholder="Enter new tag"
            className="create-tag-input"
          />
        </div>
      </div>
      <div className="modal-window-footer">
        <button className="button" onClick={handleCreateTag}>
          Create Tag
        </button>
        <button className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default EditTagsWindow;
