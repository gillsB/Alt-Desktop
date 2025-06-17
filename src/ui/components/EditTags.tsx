import React from "react";
import "../styles/EditTags.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("EditTags.tsx");

const EditTagsWindow: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  logger.info("Rendering EditTags");
  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <h2>Edit Tags</h2>
        <p>This is the Edit Tags window. Add tag management UI here.</p>
      </div>
      <div className="modal-window-footer">
        <button className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default EditTagsWindow;
