import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("SmallMenu.tsx");

const SmallMenu: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const title = queryParams.get("title") || "Small Menu";
  const message = queryParams.get("message") || "No message provided.";

  useEffect(() => {
    logger.info("SmallMenu component mounted");
    logger.info(`Title: ${title}`);
    logger.info(`Message: ${message}`);
  }, [title, message]);

  return (
    <div className="small-menu-container">
      <div className="small-menu-content">
        <h2 className="small-menu-title">{title}</h2>
        <p className="small-menu-message">{message}</p>
        <button
          className="small-menu-button"
          onClick={() => {
            logger.info("Close button clicked");
            window.close(); // Close the window
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default SmallMenu;
