import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import "../styles/SmallWindow.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("SmallWindow.tsx");

const SmallWindow: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const title = queryParams.get("title") || "SmallWindow";
  const message = queryParams.get("message") || "No message provided.";
  const windowId = parseInt(queryParams.get("windowId") || "-1", 10); // Get the windowId from query parameters
  const buttons: string[] = JSON.parse(
    queryParams.get("buttons") || '["Okay"]'
  );

  const handleButtonClick = (buttonValue: string) => {
    logger.info(`Button clicked in UI: ${buttonValue}`);
    window.electron.sendButtonResponse({
      windowId,
      buttonText: buttonValue,
    });
    window.close();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.electron.sendButtonResponse({
          windowId,
          buttonText: "Escape",
        });
        window.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
        <div className="small-window-message">
          <ReactMarkdown>{message}</ReactMarkdown>
        </div>
        <div className="small-window-buttons">
          {buttons.map((button: string, index: number) => (
            <button
              key={index}
              className="small-window-button"
              onClick={() => {
                handleButtonClick(button);
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
