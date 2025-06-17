import React from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("EditTags.tsx");

const EditTagsWindow: React.FC = () => {
  logger.info("Rendering EditTags");
  return (
    <div className="modal-window-content">
      <div className="subwindow-content">
        <h2>Edit Tags</h2>
        <p>This is the Edit Tags window. Add your tag management UI here.</p>
      </div>
    </div>
  );
};

export default EditTagsWindow;
