import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import "../styles/SmallWindow.css";
import { createLogger } from "../util/uiLogger";
import { SafeImage } from "./SafeImage";

const logger = createLogger("SelectIconWindow.tsx");

const SelectIconWindow: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const title = queryParams.get("title") || "Select Icon";
  const images: string[] = JSON.parse(queryParams.get("images") || "[]");
  const id = queryParams.get("id") || "";
  const row = parseInt(queryParams.get("row") || "0", 10);
  const col = parseInt(queryParams.get("col") || "0", 10);
  const windowId = parseInt(queryParams.get("windowId") || "-1", 10);

  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    setSelected(index);
  };

  const handleButtonClick = (buttonValue: string) => {
    logger.info(`Button clicked in UI: ${buttonValue}`);
    window.electron.sendButtonResponse({
      windowId,
      buttonText: buttonValue,
    });
    window.close();
  };

  const handleConfirm = () => {
    if (selected !== null) {
      window.electron.sendButtonResponse({
        windowId,
        buttonText: images[selected],
      });
      window.close();
    }
  };

  return (
    <div className="small-window-container">
      <header className="subwindow-header">
        <div className="header-title">{title}</div>
        <div className="window-controls">
          <button
            id="close"
            onClick={() => {
              logger.info("Close button clicked");
              handleButtonClick("Close");
            }}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="small-window-content">
        <div className="icon-selection-grid">
          {images.map((img, idx) => (
            <div
              key={img}
              className={`icon-choice ${selected === idx ? "selected" : ""}`}
              onClick={() => handleSelect(idx)}
            >
              <SafeImage
                id={id}
                row={row}
                col={col}
                imagePath={img}
                width={64}
                height={64}
              />
            </div>
          ))}
        </div>
        <div className="small-window-buttons">
          <button
            className="small-window-button"
            disabled={selected === null}
            onClick={handleConfirm}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectIconWindow;
