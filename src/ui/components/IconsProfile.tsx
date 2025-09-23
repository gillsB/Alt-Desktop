import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("IconsProfile.tsx");

const IconsProfile: React.FC = () => {
  const handleClose = () => {
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW", "IconsProfile");
  };

  logger.info("Rendering IconsProfile component");

  return (
    <div className="subwindow-container">
      <SubWindowHeader title={`Icons Profile`} onClose={handleClose} />
      <label>IconsProfile</label>
    </div>
  );
};

export default IconsProfile;
