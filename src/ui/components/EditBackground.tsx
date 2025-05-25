import React from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const handleClose = () => {
  logger.info("Settings window closed");
  window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
};

const EditBackground: React.FC = () => (
  <div className="settings-container">
    <SubWindowHeader title={`Edit Background`} onClose={handleClose} />
    <label>Hello World</label>
  </div>
);

export default EditBackground;
