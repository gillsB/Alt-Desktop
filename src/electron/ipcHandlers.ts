import { dialog, ipcMain, screen, shell } from "electron";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { openEditIconWindow } from "./editIconWindow.js";
import { baseLogger, createLoggerForFile, videoLogger } from "./logging.js";
import { defaultSettings } from "./settings.js";
import { openSettingsWindow } from "./settingsWindow.js";
import {
  closeActiveSubWindow,
  getActiveSubWindow,
  openSmallWindow,
  pendingSmallWindowResponses,
} from "./subWindowManager.js";
import {
  ensureFileExists,
  getAppDataPath,
  getDataFolderPath,
  getDesktopIconsFilePath,
  getSettingsFilePath,
  ipcMainHandle,
  ipcMainOn,
  setSubWindowDevtoolsEnabled,
} from "./util.js";
import { safeSpawn } from "./utils/safeSpawn.js";
import { getVideoFileUrl } from "./videoFileProtocol.js";

const logger = createLoggerForFile("ipcHandlers.ts");

export function registerIpcHandlers(mainWindow: Electron.BrowserWindow) {
  ipcMainHandle("getDesktopIconData", async (): Promise<DesktopIconData> => {
    const filePath = getDesktopIconsFilePath();

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
      const filePath = getDesktopIconsFilePath();

      try {
        logger.info(
          `Received request for getDesktopIcon with row: ${row}, col: ${col}`
        );
        logger.info(`DesktopIcons file path: ${filePath}`);

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
      case "ENABLE_SUBWINDOW_DEVTOOLS":
        logger.info(`HeaderAction ENABLE_SUBWINDOW_DEVTOOLS`);
        setSubWindowDevtoolsEnabled(true);
        break;
      case "DISABLE_SUBWINDOW_DEVTOOLS":
        logger.info(`HeaderAction DISABLE_SUBWINDOW_DEVTOOLS`);
        setSubWindowDevtoolsEnabled(false);
        break;
    }
  });

  ipcMainOn(
    "sendSubWindowAction",
    (payload: { action: SubWindowAction; icon?: DesktopIcon }) => {
      switch (payload.action) {
        case "CLOSE_SUBWINDOW":
          logger.info(`SubWindowAction CLOSE_SUBWINDOW`);
          mainWindow.focus();
          closeActiveSubWindow();
          if (mainWindow) {
            mainWindow.webContents.send("hide-highlight");
            logger.info("Sent 'hide-highlight' message to renderer.");
          }
          break;
      }
    }
  );

  ipcMainHandle(
    "ensureDataFolder",
    async (row: number, col: number): Promise<boolean> => {
      try {
        const fullPath = path.join(getDataFolderPath(), `[${row},${col}]`);

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
      const filePath = getDesktopIconsFilePath();

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

  ipcMainHandle("isSubWindowActive", async (): Promise<boolean> => {
    const subWindow = getActiveSubWindow();
    if (subWindow) {
      logger.info("Subwindow is active, re-centering it.");
      // Re-center the subwindow
      const { width, height } = subWindow.getBounds();
      const { width: screenWidth, height: screenHeight } =
        screen.getPrimaryDisplay().workAreaSize;

      const x = Math.round((screenWidth - width) / 2);
      const y = Math.round((screenHeight - height) / 2);

      subWindow.setBounds({ x, y, width, height });

      subWindow.focus();
    } else {
      logger.info("No active subwindow found.");
    }
    return subWindow !== null; // Return true if a subwindow is active
  });

  ipcMainHandle(
    "reloadIcon",
    async (row: number, col: number): Promise<boolean> => {
      const filePath = getDesktopIconsFilePath();

      try {
        // Read JSON file
        const data = fs.readFileSync(filePath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);

        // Find the icon with the specified row and col
        const icon = parsedData.icons.find(
          (icon) => icon.row === row && icon.col === col
        );

        if (icon) {
          logger.info(
            `Reloaded icon at [${row}, ${col}]: ${JSON.stringify(icon)}`
          );

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

  ipcMainHandle("openSettings", async (): Promise<boolean> => {
    try {
      logger.info(`ipcMainHandle openSettings called`);
      openSettingsWindow();
      return true;
    } catch (error) {
      logger.error(`Error opening settings window: ${error}`);
      return false;
    }
  });

  ipcMainHandle(
    "editIcon",
    async (row: number, col: number): Promise<boolean> => {
      try {
        logger.info(`ipcMainHandle editIcon called with ${row}, ${col}`);
        openEditIconWindow(row, col);
        return true;
      } catch (error) {
        logger.error(`Error opening edit icon window: ${error}`);
        return false;
      }
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

  ipcMainHandle(
    "openFileDialog",
    async (type: string): Promise<string | null> => {
      let result: Electron.OpenDialogReturnValue;
      if (type === "image") {
        result = await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            {
              name: "Images",
              extensions: ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"],
            },
          ],
        });
      } else if (type === "media") {
        // Video and Images
        result = await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            {
              name: "Media",
              extensions: [
                "mp4",
                "webm",
                "ogg",
                "mov",
                "png",
                "jpg",
                "jpeg",
                "gif",
                "bmp",
                "svg",
                "webp",
              ],
            },
          ],
        });
      } else {
        result = await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            {
              name: type,
              extensions: ["*"],
            },
          ],
        });
      }

      if (result.canceled || result.filePaths.length === 0) {
        return null; // No file selected
      }

      return result.filePaths[0]; // Return the selected file path
    }
  );

  ipcMainHandle(
    "saveIconImage",
    async (sourcePath: string, row: number, col: number): Promise<string> => {
      const targetDir = path.join(getDataFolderPath(), `[${row},${col}]`);

      const ext = path.extname(sourcePath);
      const baseName = path.basename(sourcePath, ext);

      // Verify that the source file exists
      if (!fs.existsSync(sourcePath)) {
        logger.error(`Source file does not exist: ${sourcePath}`);
        throw new Error(`Source file does not exist: ${sourcePath}`);
      }

      // Ensure the target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (sourcePath.startsWith(targetDir)) {
        logger.info("Source already in target directory, skipping copy.");
        return path.basename(sourcePath);
      }

      let localFileName = `${baseName}${ext}`;
      let targetPath = path.join(targetDir, localFileName);
      let counter = 1;

      // Increment filename if it already exists
      while (fs.existsSync(targetPath)) {
        localFileName = `${baseName}(${counter})${ext}`;
        targetPath = path.join(targetDir, localFileName);
        counter++;
      }

      try {
        fs.copyFileSync(sourcePath, targetPath);
        logger.info(`Image saved to: ${targetPath}`);

        return localFileName;
      } catch (error) {
        logger.error("Failed to save image:", error);
        throw error;
      }
    }
  );

  // Handle log messages from the renderer process
  ipcMain.on("logMessage", (event, { level, file, message }) => {
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
  ipcMain.on("logVideoMessage", (event, { level, file, message }) => {
    switch (level) {
      case "info":
        videoLogger.info({ message, file });
        break;
      case "warn":
        videoLogger.warn({ message, file });
        break;
      case "error":
        videoLogger.error({ message, file });
        break;
      case "debug":
        videoLogger.debug({ message, file });
        break;
      default:
        videoLogger.info({ message, file });
    }
  });

  ipcMainHandle(
    "launchProgram",
    async (row: number, col: number): Promise<boolean> => {
      const filePath = getDesktopIconsFilePath();

      try {
        const data = fs.readFileSync(filePath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);

        const icon = parsedData.icons.find(
          (icon) => icon.row === row && icon.col === col
        );

        if (!icon) {
          logger.warn(`No icon found at [${row}, ${col}]`);
          return false;
        }

        if (!icon.programLink) {
          logger.warn(`No programLink found for icon at [${row}, ${col}]`);
          return false;
        }

        const launchPath = icon.programLink;

        if (!fs.existsSync(launchPath)) {
          logger.warn(`Launch path does not exist: ${launchPath}`);
          return false;
        }

        logger.info(`Launching program: ${launchPath}`);

        return safeSpawn(icon.programLink, icon.args || []);
      } catch (error) {
        logger.error(`Error in launchIcon: ${error}`);
        return false;
      }
    }
  );
  ipcMainHandle(
    "launchWebsite",
    async (row: number, col: number): Promise<boolean> => {
      const filePath = getDesktopIconsFilePath();

      try {
        const data = fs.readFileSync(filePath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);

        const icon = parsedData.icons.find(
          (icon) => icon.row === row && icon.col === col
        );

        if (!icon) {
          logger.warn(`No icon found at [${row}, ${col}]`);
          return false;
        }

        if (!icon.websiteLink) {
          logger.warn(`No websiteLink found for icon at [${row}, ${col}]`);
          return false;
        }

        let websiteLink = icon.websiteLink.trim();

        // Ensure the link starts with a valid protocol
        if (!/^https?:\/\//i.test(websiteLink)) {
          websiteLink = `https://${websiteLink}`;
          logger.info(`Formatted website link to: ${websiteLink}`);
        }

        // Open the website link in the default web browser
        logger.info(`Opening website: ${websiteLink}`);
        await shell.openExternal(websiteLink);

        return true;
      } catch (error) {
        logger.error(`Error in launchWebsite: ${error}`);
        return false;
      }
    }
  );

  ipcMainHandle("getFileType", async (filePath: string): Promise<string> => {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn(`File does not exist: ${filePath}`);
        return "";
      }

      const mimeType = mime.lookup(filePath);
      if (!mimeType) {
        logger.warn(`Could not determine file type for: ${filePath}`);
        return "";
      }

      return mimeType;
    } catch (error) {
      logger.error(`Error in getFileType for ${filePath}: ${error}`);
      return "";
    }
  });
  ipcMainHandle(
    "deleteIcon",
    async (row: number, col: number): Promise<boolean> => {
      const filePath = getDesktopIconsFilePath();
      const iconFolderPath = path.join(getDataFolderPath(), `[${row},${col}]`);

      try {
        logger.info(`Deleting icon at [${row}, ${col}] from ${filePath}`);

        // Ensure the file exists
        if (!fs.existsSync(filePath)) {
          logger.warn(`File not found: ${filePath}`);
          return false;
        }

        // Read the JSON file
        const data = fs.readFileSync(filePath, "utf-8");
        const desktopData: DesktopIconData = JSON.parse(data);

        // Filter out the icon with the matching row and col
        const updatedIcons = desktopData.icons.filter(
          (icon) => icon.row !== row || icon.col !== col
        );

        if (updatedIcons.length === desktopData.icons.length) {
          logger.warn(`No icon found at [${row}, ${col}] to delete.`);
          return false; // No icon was deleted
        }

        // Update the JSON data
        desktopData.icons = updatedIcons;

        // Write the updated JSON back to the file
        fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2));
        logger.info(`Successfully deleted icon at [${row}, ${col}]`);

        // Move the icon folder to the recycle bin
        if (fs.existsSync(iconFolderPath)) {
          await shell.trashItem(iconFolderPath);
          logger.info(
            `Successfully moved folder to recycle bin: ${iconFolderPath}`
          );
        } else {
          logger.warn(`Folder not found: ${iconFolderPath}`);
        }

        return true;
      } catch (error) {
        logger.error(`Error deleting icon at [${row}, ${col}]: ${error}`);
        return false;
      }
    }
  );
  ipcMainHandle(
    "openInExplorer",
    async (
      type: "image" | "programLink",
      filePath: string
    ): Promise<boolean> => {
      try {
        let resolvedPath = filePath;
        logger.info("resolvedPath", resolvedPath);

        if (type === "image") {
          // Resolve the localized app-data file path
          const appDataBasePath = getAppDataPath();
          resolvedPath = path.resolve(appDataBasePath, filePath);
        }

        if (!fs.existsSync(resolvedPath)) {
          logger.warn(`File does not exist: ${resolvedPath}`);

          // Attempt to resolve the parent folder
          const parentFolder = path.dirname(resolvedPath);
          if (fs.existsSync(parentFolder)) {
            logger.info(`Opening parent folder: ${parentFolder}`);
            shell.openPath(parentFolder);
            return true;
          } else {
            logger.error(`Parent folder does not exist: ${parentFolder}`);
            return false;
          }
        }

        // Open the file in Explorer
        shell.showItemInFolder(resolvedPath);
        logger.info(`Opened ${type} in Explorer: ${resolvedPath}`);
        return true;
      } catch (error) {
        logger.error(`Failed to open ${type} in Explorer: ${error}`);
        return false;
      }
    }
  );
  ipcMainHandle(
    "showSmallWindow",
    async (
      title: string,
      message: string,
      buttons: string[] = ["Okay"]
    ): Promise<string> => {
      try {
        logger.info(
          `Showing small window with title: "${title}", message: "${message}", and buttons: ${JSON.stringify(buttons)}`
        );

        // Call openSmallWindow and wait for the button clicked
        const buttonClicked = await openSmallWindow(title, message, buttons);

        return buttonClicked;
      } catch (error) {
        logger.error(`Failed to show small window: ${error}`);
        return ""; // Return an empty string on error
      }
    }
  );
  ipcMainOn(
    "buttonResponse",
    (payload: { windowId: number; buttonText: string | null }) => {
      const { windowId, buttonText } = payload;

      logger.info(
        `Received button response in main process: ${buttonText} from window ${windowId}`
      );

      if (windowId && pendingSmallWindowResponses.has(windowId)) {
        const { resolve } = pendingSmallWindowResponses.get(windowId)!;
        pendingSmallWindowResponses.delete(windowId);

        // Resolve with the button text or default to an empty string
        resolve(buttonText || "");
      }
    }
  );
  ipcMainHandle(
    "previewIconUpdate",
    async (
      row: number,
      col: number,
      updates: Partial<DesktopIcon>
    ): Promise<boolean> => {
      try {
        logger.info(
          `Received previewIconUpdate for icon at [${row}, ${col}] with updates: ${JSON.stringify(
            updates
          )}`
        );

        // Ensure updates is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid updates object:", updates);
          return false;
        }

        // Notify the renderer process to update the preview
        if (mainWindow) {
          mainWindow.webContents.send("update-icon-preview", {
            row,
            col,
            updates, // Ensure this is the correct object
          });
          logger.info(
            `Sent 'update-icon-preview' event to renderer for [${row}, ${col}]`
          );
        }

        return true;
      } catch (error) {
        logger.error(
          `Error handling previewIconUpdate for [${row}, ${col}]: ${error}`
        );
        return false;
      }
    }
  );
  ipcMainHandle("getSettingsData", async (): Promise<SettingsData> => {
    try {
      const settingsFilePath = getSettingsFilePath();
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
      return settings;
    } catch (error) {
      logger.error("Error retrieving settings data:", error);
      return defaultSettings;
    }
  });
  ipcMainHandle(
    "saveSettingsData",
    async (data: SettingsData): Promise<boolean> => {
      try {
        const settingsFilePath = getSettingsFilePath();
        fs.writeFileSync(
          settingsFilePath,
          JSON.stringify(data, null, 2),
          "utf-8"
        );
        logger.info("Settings data saved successfully.");
        return true;
      } catch (error) {
        logger.error("Error saving settings data:", error);
        return false;
      }
    }
  );
  ipcMainHandle(
    "getSetting",
    async (key: SettingKey): Promise<SettingsData[SettingKey]> => {
      try {
        const settingsFilePath = getSettingsFilePath();
        const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
        const value =
          settings[key] !== undefined ? settings[key] : defaultSettings[key];
        return value; // Return the value as is, without converting to a string
      } catch (error) {
        logger.error("Error retrieving setting:", error);
        return defaultSettings[key]; // Return the default value
      }
    }
  );
  ipcMain.handle("convertToVideoFileUrl", async (_event, filePath) => {
    try {
      // Check if the file exists and is a video
      if (!fs.existsSync(filePath)) {
        logger.warn(`Video file does not exist: ${filePath}`);
        return null;
      }

      // Check file extension
      const fileExt = path.extname(filePath).toLowerCase();
      const allowedExtensions = [".mp4", ".webm", ".mov", ".ogg"];

      if (!allowedExtensions.includes(fileExt)) {
        logger.warn(`Not a valid video file: ${filePath}`);
        return null;
      }

      // Convert to video URL
      const pathResult = getVideoFileUrl(filePath);
      logger.info("returning video URL:", pathResult);
      return pathResult;
    } catch (error) {
      logger.error(`Error converting path to video URL: ${error}`);
      return null;
    }
  });
}
