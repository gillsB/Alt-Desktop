import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditIcon.tsx");

const Settings: React.FC = () => {
  logger.info("Settings component rendered");

  const handleClose = () => {
    logger.info("Settings window closed");
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  const handleSave = () => {
    logger.info("Save button clicked");
  };

  return (
    <div className="settings-container">
      <SubWindowHeader title={`Settings`} onClose={handleClose} />
      <div className="settings-content">
        <div className="settings-field">
          <label htmlFor="background">Background path</label>
          <input
            id="background"
            type="text"
            onChange={(e) => {
              logger.info("background field changed", e.target.value);
            }}
          />
        </div>
      </div>
      <div className="settings-footer">
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Settings;
