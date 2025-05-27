import React from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const EditBackground: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const filePath = params.get("filePath") || undefined;

  const handleClose = () => {
    logger.info("closing EditBackground.");
    window.close();
  };

  return (
    <div className="settings-container">
      <SubWindowHeader title="Edit Background" onClose={handleClose} />
      <div className="settings-content">
        <h2>Edit Background</h2>
        <div>
          <strong>Dropped file:</strong>
          <pre>{filePath ?? "(none)"}</pre>
        </div>
      </div>
    </div>
  );
};

export default EditBackground;
