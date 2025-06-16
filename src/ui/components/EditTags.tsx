import React from "react";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditTags.tsx");

const EditTagsWindow: React.FC = () => {
  const handleSaveClick = () => {
    logger.info("Save button clicked in Edit Tags window");
    handleClose();
  };
  const handleClose = () => {
    window.electron.closeEditTagsWindow();
  };
  return (
    <div className="subwindow-container">
      <SubWindowHeader title={`Edit Tags`} onClose={handleClose} />
      <div className="subwindow-content">
        <h2>Edit Tags</h2>
        <p>This is the Edit Tags window. Add your tag management UI here.</p>
      </div>
      <div className="subwindow-footer">
        <button className="save-button" onClick={handleSaveClick}>
          Save
        </button>
        <button className="button">Cancel</button>
      </div>
    </div>
  );
};

export default EditTagsWindow;
