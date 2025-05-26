import React, { useEffect, useState } from "react";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
import { SafeImage } from "./SafeImage";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const handleClose = () => {
  logger.info("EditBackground window closed");
  window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
};

const EditBackground: React.FC = () => {
  const [summaries, setSummaries] = useState<BackgroundSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const handleSelect = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const selected = summaries.filter((bg) => selectedIds.includes(bg.id));

  return (
    <div className="edit-background-root">
      <SubWindowHeader title="Edit Backgrounds" onClose={handleClose} />
      <div className="edit-background-content">
        <div className="background-grid">
          {summaries.map((bg) => (
            <div
              key={bg.id}
              className={
                "background-grid-item" +
                (selectedIds.includes(bg.id) ? " selected" : "")
              }
              onClick={(e) => handleSelect(bg.id, e)}
              tabIndex={0}
            >
              {bg.iconPath && (
                <SafeImage
                  imagePath={bg.iconPath}
                  className="background-icon"
                />
              )}
              <h4>{bg.name || bg.id}</h4>
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="background-details-panel">
            {selected.map((bg) => (
              <div key={bg.id}>
                {bg.iconPath && (
                  <div className="details-row">
                    <SafeImage
                      imagePath={bg.iconPath}
                      width={128}
                      height={128}
                      className="panel-icon"
                    />
                  </div>
                )}
                <h3>{bg.name || bg.id}</h3>
                <div className="details-row">
                  <label>Description</label>
                  <div className="details-value">
                    {bg.description || <em>No description</em>}
                  </div>
                </div>
                <div className="details-row">
                  <label>File Path</label>
                  <div className="details-value">
                    {bg.filePath || <em>None</em>}
                  </div>
                </div>
                <div className="details-row">
                  <label>Tags</label>
                  <div className="details-value">
                    {bg.tags?.join(", ") || <em>None</em>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditBackground;
