import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { getAppDataPath } from "./appDataSetup.js";
import { DesktopIcon } from "./DesktopIcon.js";
import { baseLogger, createLoggerForFile } from "./logging.js"; // Import the baseLogger directly
import {
  closeActiveSubWindow,
  getActiveSubWindow,
} from "./subWindowManager.js";
import { ensureFileExists, ipcMainHandle, ipcMainOn } from "./util.js";
import { openEditIconWindow } from "./editIconWindow.js";

const logger = createLoggerForFile("ipcHandlers.ts");

export function registerIpcHandlers(mainWindow: Electron.BrowserWindow) {
  ipcMainHandle("getDesktopIconData", async (): Promise<DesktopIconData> => {
    const directoryPath = path.join(getAppDataPath(), "desktop");
    const filePath = path.join(directoryPath, "desktopIcons.json");

    try {
      // Read JSON file
      const data = fs.readFileSync(filePath, "utf-8");
      logger.info(`Read file contents from ${filePath}`);
      const parsedData: DesktopIconData = JSON.parse(data);

      if (parsedData.icons) {
        parsedData.icons = parsedData.icons.map((icon) => {
          return icon;
        });
      }

      return parsedData;
    } catch (error) {
      logger.error(`Error reading or creating JSON file. ${error}`);
      return { icons: [] }; // Return default if error
    }
  });

  ipcMainHandle(
    "getDesktopIcon",
    async (row: number, col: number): Promise<DesktopIcon | null> => {
      logger.info("ipcMainHandle getDesktopIcon called");
      const directoryPath = path.join(getAppDataPath(), "desktop");
      logger.info(`Directory path: ${directoryPath}`);
      const filePath = path.join(directoryPath, "desktopIcons.json");

      try {
        logger.info(
          `Received request for getDesktopIcon with row: ${row}, col: ${col}`
        );
        logger.info(`Directory path: ${directoryPath}`);
        logger.info(`File path: ${filePath}`);

        // Read JSON file
        const data = fs.readFileSync(filePath, "utf-8");
        logger.info(`Read file contents: ${filePath}`);
        const parsedData: DesktopIconData = JSON.parse(data);

        if (parsedData.icons) {
          // Find the icon with the specified row and col
          const icon = parsedData.icons.find(
            (icon) => icon.row === row && icon.col === col
          );

          if (icon) {
            logger.info(
              `Found icon at [${row}, ${col}]: ${JSON.stringify(icon)}`
            );
            return icon;
          } else {
            logger.warn(`No icon found at [${row}, ${col}]`);
            return null; // Return null if no matching icon is found
          }
        }

        logger.warn("No icons found in the data file.");
        return null; // Return null if no icons exist
      } catch (error) {
        logger.error(`Error reading or parsing JSON file: ${error}`);
        return null; // Return null if an error occurs
      }
    }
  );

  ipcMainOn("sendHeaderAction", (payload) => {
    switch (payload) {
      case "MINIMIZE":
        logger.info(`HeaderAction MINIMIZE`);
        mainWindow.minimize();
        break;
      case "MAXIMIZE":
        if (mainWindow.isMaximized()) {
          logger.info(`HeaderAction MAXIMIZE -> UNMAXIMIZE`);
          mainWindow.unmaximize();
        } else {
          logger.info(`HeaderAction MAXIMIZE -> MAXIMIZE`);
          mainWindow.maximize();
        }
        break;
      case "CLOSE":
        logger.info(`HeaderAction CLOSE`);
        mainWindow.close();
        break;
      case "SHOW_DEVTOOLS":
        logger.info(`HeaderAction SHOW_DEVTOOLS`);
        mainWindow.webContents.openDevTools();
        break;
    }
  });

  ipcMainOn(
    "sendSubWindowAction",
    (payload: { action: SubWindowAction; icon?: DesktopIcon }) => {
      switch (payload.action) {
        case "CLOSE_SUBWINDOW":
          logger.info(`SubWindowAction CLOSE_SUBWINDOW`);
          closeActiveSubWindow();
          break;
      }
    }
  );

  ipcMainHandle(
    "ensureDataFolder",
    async (row: number, col: number): Promise<boolean> => {
      try {
        const basePath = getAppDataPath();
        const dataFolderPath = path.join(basePath, "data");
        const fullPath = path.join(dataFolderPath, `[${row},${col}]`);

        if (!fs.existsSync(fullPath)) {
          logger.info(
            `Data folder [${row},${col}] does not exist, creating: ${fullPath}`
          );
          fs.mkdirSync(fullPath, { recursive: true });
          logger.info(`Data folder [${row},${col}] created successfully.`);
        }

        // Ensure Data file exists
        return ensureFileExists(fullPath, { icons: [] });
      } catch (error) {
        logger.error(`Error ensuring Data folder [${row},${col}]: ${error}`);
        return false;
      }
    }
  );

  ipcMainHandle("setIconData", async (icon: DesktopIcon): Promise<boolean> => {
    try {
      const { row, col } = icon; // Extract row and col from the icon object
      const directoryPath = path.join(getAppDataPath(), "desktop");
      const filePath = path.join(directoryPath, "desktopIcons.json");

      logger.info(`Updating icon at [${row},${col}] in ${filePath}`);
      let desktopData: DesktopIconData = { icons: [] };

      // Ensure file exists
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        desktopData = JSON.parse(data);
      }

      // Find existing icon or add new one
      const existingIndex = desktopData.icons.findIndex(
        (i) => i.row === row && i.col === col
      );

      if (existingIndex !== -1) {
        // Update existing icon
        desktopData.icons[existingIndex] = icon;
      } else {
        // Add new icon
        desktopData.icons.push(icon);
      }

      // Write back updated JSON
      fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2));

      logger.info(`Successfully updated icon at [${row},${col}]`);
      return true;
    } catch (error) {
      logger.error(
        `Error updating icon at [${icon.row},${icon.col}]: ${error}`
      );
      return false;
    }
  });

  ipcMainHandle("getSubWindowState", async (): Promise<boolean> => {
    const subWindow = getActiveSubWindow();
    return subWindow !== null; // Return true if a subwindow is active
  });

  ipcMainHandle(
    "reloadIcon",
    async (row: number, col: number): Promise<boolean> => {
      const directoryPath = path.join(getAppDataPath(), "desktop");
      const filePath = path.join(directoryPath, "desktopIcons.json");

      try {
        // Read JSON file
        const data = fs.readFileSync(filePath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);

        // Find the icon with the specified row and col
        const icon = parsedData.icons.find(
          (icon) => icon.row === row && icon.col === col
        );

        if (icon) {
          logger.info(`Reloaded icon at [${row}, ${col}]: ${icon}`);

          // Notify the renderer process to reload the icon
          if (mainWindow) {
            logger.info(
              `Sending reload request to renderer for icon at [${row}, ${col}]`
            );
            mainWindow.webContents.send("reload-icon", { row, col, icon });
          }

          return true;
        } else {
          logger.warn(`No icon found at [${row}, ${col}] to reload.`);
          return false; // Icon not found
        }
      } catch (error) {
        logger.error(`Error reloading icon at [${row}, ${col}]: ${error}`);
        return false; // Error occurred
      }
    }
  );

  ipcMainHandle(
    "editIcon",
    async (row: number, col: number): Promise<boolean> => {
      logger.info(`ipcMainHandle editIcon called with ${row}, ${col}`);
      openEditIconWindow(row, col);
      return false;
    }
  );

  ipcMainHandle("reloadWindow", async (): Promise<boolean> => {
    if (mainWindow) {
      mainWindow.reload();
      return true;
    } else {
      return false;
    }
  });

  // Handle log messages from the renderer process
  ipcMain.on("log-message", (event, { level, file, message }) => {
    switch (level) {
      case "info":
        baseLogger.info({ message, file });
        break;
      case "warn":
        baseLogger.warn({ message, file });
        break;
      case "error":
        baseLogger.error({ message, file });
        break;
      case "debug":
        baseLogger.debug({ message, file });
        break;
      default:
        baseLogger.info({ message, file });
    }
  });
}
