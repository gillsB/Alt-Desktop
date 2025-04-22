import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("SmallWindow.tsx");

const SmallWindow: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const title = queryParams.get("title") || "SmallWindow";
  const message = queryParams.get("message") || "No message provided.";

  const buttons: string[] = JSON.parse(
    queryParams.get("buttons") || '["Okay"]'
  );

  useEffect(() => {
    logger.info("SmallWindow component mounted");
    logger.info(`Title: ${title}`);
    logger.info(`Message: ${message}`);
    logger.info(`Buttons: ${buttons}`);
  }, [title, message, buttons]);

  return (
    <div className="small-window-container">
      <header className="subwindow-header">
        <div className="header-title">{title}</div>
        <div className="window-controls">
          <button
            id="close"
            onClick={() => {
              logger.info("Close button clicked");
              window.close();
            }}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="small-window-content">
        <p className="small-window-message">{message}</p>
        <div className="small-window-buttons">
          {buttons.map((button: string, index: number) => (
            <button
              key={index}
              className="small-window-button"
              onClick={() => {
                logger.info(`Button clicked: ${button}`);
                window.close();
              }}
            >
              {button}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SmallWindow;
