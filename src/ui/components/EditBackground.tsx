import React, { useEffect, useState } from "react";
import "../App.css";
import { createLogger } from "../util/uiLogger";
import { SafeImage } from "./SafeImage";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const handleClose = () => {
  logger.info("Settings window closed");
  window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
};

const EditBackground: React.FC = () => {
  const [summaries, setSummaries] = useState<BackgroundSummary[]>([]);

  useEffect(() => {
    window.electron
      .getBackgroundSummaries()
      .then((result) => {
        setSummaries(result);
        logger.info("Loaded background summaries", result);
      })
      .catch((err) => {
        logger.error("Failed to fetch background summaries:", err);
      });
  }, []);

  // TODO redefine safeImage to not require row and col.
  return (
    <div className="settings-container">
      <SubWindowHeader title="Edit Backgrounds" onClose={handleClose} />
      <div className="grid">
        {summaries.map((bg) => (
          <div key={bg.id} className="grid-item">
            <h4>{bg.name || bg.id}</h4>
            <p>{bg.description}</p>
            <p>{bg.filePath}</p>
            {bg.iconPath && (
              <SafeImage
                imagePath={bg.iconPath}
                width={128}
                height={128}
                className="background-icon"
              />
            )}
            <p>
              <em>Tags:</em> {bg.tags.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditBackground;
