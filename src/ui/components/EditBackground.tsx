import React, { useEffect, useState } from "react";
import "../App.css";
import "../styles/EditBackground.css";
import { createLogger } from "../util/uiLogger";
import { SafeImage } from "./SafeImage";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("EditBackground.tsx");

const EditBackground: React.FC = () => {
  const [summaries, setSummaries] = useState<BackgroundSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    backgroundId: string;
  } | null>(null);

  const handleClose = async () => {
    logger.info("EditBackground window closed");
    await window.electron.saveSettingsData({ background: selectedIds[0] });
    await window.electron.reloadBackground();
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  useEffect(() => {
    window.electron
      .getBackgroundSummaries()
      .then((result) => {
        setSummaries(result);
        logger.info(
          "Loaded background summary IDs",
          result.map((bg) => bg.id)
        );
      })
      .catch((err) => {
        logger.error("Failed to fetch background summaries:", err);
      });
  }, []);

  useEffect(() => {
    // Only run when summaries are loaded
    if (summaries.length > 0) {
      (async () => {
        const savedBackground = await window.electron.getSetting("background");
        if (savedBackground) {
          handleSelect(savedBackground);
        } else {
          logger.info("No saved background found");
        }
      })();
    }
  }, [summaries]);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  const handleSelect = async (id: string, e?: React.MouseEvent) => {
    // Used for selecting multiple files, not sure if this will be allowed or what to do with this.
    if (e) {
      if (e.ctrlKey || e.metaKey) {
        setSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
        return;
      }
    }

    // Find the selected background, select it, and update the preview
    const bg = summaries.find((bg) => bg.id === id);
    logger.info("Selected background:", bg);
    if (bg) {
      setSelectedIds([id]);
    } else {
      logger.warn(`Background with id ${id} not found in summaries`);
      return;
    }
    if (bg?.id) {
      await window.electron.previewBackgroundUpdate({
        background: bg.id,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, backgroundId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      backgroundId,
    });
  };

  const handleOpenFolder = async (backgroundId: string) => {
    logger.info(`Open Folder for background ${backgroundId}`);
    setContextMenu(null);
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
              onContextMenu={(e) => handleContextMenu(e, bg.id)}
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

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="menu-item"
            onClick={() => handleOpenFolder(contextMenu.backgroundId)}
          >
            Open Folder
          </div>
        </div>
      )}
    </div>
  );
};

export default EditBackground;
