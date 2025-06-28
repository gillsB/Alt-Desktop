import { spawn } from "child_process";
import { dialog, screen, shell } from "electron";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { baseLogger, createLoggerForFile, videoLogger } from "./logging.js";
import { getScriptsPath } from "./pathResolver.js";
import { PUBLIC_TAG_CATEGORIES } from "./publicTags.js";
import { getSafeFileUrl } from "./safeFileProtocol.js";
import {
  addCategory,
  defaultSettings,
  deleteCategory,
  getCategories,
  getSetting,
  renameCategory,
  renameLocalTag,
  saveSettingsData,
} from "./settings.js";
import { generateIcon } from "./utils/generateIcon.js";
import { safeSpawn } from "./utils/safeSpawn.js";
import {
  ensureFileExists,
  escapeRegExp,
  filterBackgroundEntries,
  getAppDataPath,
  getBackgroundFilePath,
  getBackgroundsJsonFilePath,
  getDataFolderPath,
  getDesktopIconsFilePath,
  getExternalPath,
  getSettingsFilePath,
  idToBackgroundFolder,
  idToBackgroundPath,
  indexBackgrounds,
  ipcMainHandle,
  ipcMainOn,
  moveToBackgroundFolder,
  resetAllIconsFontColor,
  resolveShortcut,
  saveBgJsonFile,
  setSmallWindowDevtoolsEnabled,
  setSubWindowDevtoolsEnabled,
  updateHeader,
} from "./utils/util.js";
import { getVideoFileUrl } from "./videoFileProtocol.js";
import { openBackgroundSelectWindow } from "./windows/backgroundSelectWindow.js";
import { openEditBackground } from "./windows/editBackgroundWindow.js";
import { openEditIconWindow } from "./windows/editIconWindow.js";
import { openSettingsWindow } from "./windows/settingsWindow.js";
import {
  closeActiveSubWindow,
  getActiveSubWindow,
  openSelectIconWindow,
  openSmallWindow,
  pendingSmallWindowResponses,
} from "./windows/subWindowManager.js";

ffmpeg.setFfprobePath(ffprobeStatic.path);

const logger = createLoggerForFile("ipcHandlers.ts");
const PUBLIC_TAGS_FLAT = PUBLIC_TAG_CATEGORIES.flatMap((cat) => cat.tags);

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
      case "ENABLE_SMALLWINDOW_DEVTOOLS":
        logger.info(`HeaderAction ENABLE_SMALLWINDOW_DEVTOOLS`);
        setSmallWindowDevtoolsEnabled(true);
        break;
      case "DISABLE_SMALLWINDOW_DEVTOOLS":
        logger.info(`HeaderAction DISABLE_SMALLWINDOW_DEVTOOLS`);
        setSmallWindowDevtoolsEnabled(false);
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

  ipcMainHandle("getSubWindowTitle", async (): Promise<string> => {
    let title = "";
    const subWindow = getActiveSubWindow();
    if (subWindow) {
      title = subWindow.customTitle || "";
      logger.info(`Subwindow ${title} is active`);

      // Get the mainWindow's current bounds and find the display it's on
      const mainWindowBounds = mainWindow.getBounds();
      const display = screen.getDisplayMatching(mainWindowBounds);

      // Center the subWindow on that display
      const { width, height } = subWindow.getBounds();
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

      const x = Math.round(dx + (dw - width) / 2);
      const y = Math.round(dy + (dh - height) / 2);

      subWindow.setBounds({ x, y, width, height });
      subWindow.focus();
    }
    return title; // Return the title, or ""
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

        // Notify the renderer process to reload the icon
        if (mainWindow) {
          logger.info(
            `Sending reload request to renderer for icon at [${row}, ${col}]`
          );
          mainWindow.webContents.send("reload-icon", { row, col, icon });
        }

        if (icon) {
          logger.info(
            `Reloaded icon at [${row}, ${col}]: ${JSON.stringify(icon)}`
          );

          return true;
        } else {
          logger.warn(
            `No icon found at [${row}, ${col}] to reload. (sent null response)`
          );
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
  ipcMainHandle("openBackgroundSelect", async (): Promise<boolean> => {
    try {
      logger.info(`ipcMainHandle openBackgroundSelect called`);
      openBackgroundSelectWindow();
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

  // optional filePath parameter to open the dialog at a path location.
  // If filePath is non-absolute, it opens in the AppData/Roaming/AltDesktop/{filePath} directory.
  ipcMainHandle(
    "openFileDialog",
    async (type: string, filePath?: string): Promise<string | null> => {
      let result: Electron.OpenDialogReturnValue;

      try {
        if (filePath && !path.isAbsolute(filePath)) {
          filePath = path.join(getAppDataPath(), filePath);
          logger.info("filePath = ", filePath);
        }

        const options: Electron.OpenDialogOptions = {
          properties: ["openFile"],
          defaultPath: filePath || undefined, // Use the provided filePath or just default
        };

        options.filters = [];
        const extensions: string[] = [];
        let filterName = "";

        if (type.includes("image")) {
          extensions.push(
            "png",
            "jpg",
            "jpeg",
            "gif",
            "bmp",
            "svg",
            "webp",
            "ico"
          );
          filterName += "Images";
        }
        if (type.includes("video")) {
          extensions.push("mp4", "webm", "ogg", "mov", "mkv");
          filterName += filterName ? ", Video" : "Video";
        }

        if (extensions.length > 0) {
          options.filters.push({
            name: filterName,
            extensions,
          });
        } else {
          // Non supported type, allow all files
          options.filters.push({
            name: type,
            extensions: ["*"],
          });
        }

        result = await dialog.showOpenDialog(options);

        if (result.canceled || result.filePaths.length === 0) {
          return null; // No file selected
        }

        return result.filePaths[0]; // Return the selected file path
      } catch (error) {
        logger.error(`Error in openFileDialog: ${error}`);
        return null;
      }
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
      // Check for existing files with the same name or name with a counter
      const filesInDir = fs.readdirSync(targetDir);
      for (const file of filesInDir) {
        logger.info(`Checking file: ${file}`);
        const fileExt = path.extname(file);
        const fileBaseName = path.basename(file, fileExt);

        // Match files with the same base name or base name with a counter
        const escapedBaseName = escapeRegExp(baseName);
        const baseNameRegex = new RegExp(
          `^${escapedBaseName}(\\(\\d+\\))?$`,
          "i"
        );
        if (
          baseNameRegex.test(fileBaseName) &&
          fileExt.toLowerCase() === ext.toLowerCase()
        ) {
          const existingFilePath = path.join(targetDir, file);
          logger.info(`Found matching base name file: ${existingFilePath}`);
          // Compare the two files to see if they are the same
          if (
            fs
              .readFileSync(sourcePath)
              .equals(fs.readFileSync(existingFilePath))
          ) {
            logger.info(`Matching file found: ${file}`);
            return file; // Return the matching file's name
          }
        }
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
  ipcMainHandle(
    "saveToBackgroundIDFile",
    async (
      id: string,
      sourcePath: string,
      saveFile: boolean
    ): Promise<string> => {
      logger.info(
        "SaveToBackgroundIDFile called with:",
        JSON.stringify({
          id,
          sourcePath,
          saveFile,
        })
      );
      const targetDir = await idToBackgroundFolder(id);

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
      // If path already from background directory just return it.
      if (sourcePath.startsWith(targetDir)) {
        logger.info(
          `Source ${sourcePath} already in target directory, skipping copy.`
        );
        return path.basename(sourcePath);
      }

      // Check for existing files with the same name or name with a counter
      const filesInDir = fs.readdirSync(targetDir);
      // Escape special regex characters in baseName
      const escapedBaseName = escapeRegExp(baseName);
      const baseNameRegex = new RegExp(
        `^${escapedBaseName}(\\(\\d+\\))?$`,
        "i"
      );
      for (const file of filesInDir) {
        const fileExt = path.extname(file);
        const fileBaseName = path.basename(file, fileExt);

        // Match files with the same base name or base name with a counter
        if (baseNameRegex.test(fileBaseName) && fileExt === ext) {
          const existingFilePath = path.join(targetDir, file);

          // Compare the two files to see if they are the same
          if (
            fs
              .readFileSync(sourcePath)
              .equals(fs.readFileSync(existingFilePath))
          ) {
            logger.info(`Matching file found: ${file}`);
            return file; // Return the matching file's name
          }
        }
      }

      // If saveFile is false, create a shortcut instead of copying
      if (!saveFile) {
        // Prevent creating duplicate shortcuts (search and return shortcut which points to the same file)
        const shortcutFiles = filesInDir.filter(
          (f) => path.extname(f).toLowerCase() === ".lnk"
        );
        for (const shortcutFile of shortcutFiles) {
          const shortcutPath = path.join(targetDir, shortcutFile);
          try {
            const resolved = resolveShortcut(shortcutPath);
            if (
              resolved &&
              path.resolve(resolved).toLowerCase() ===
                path.resolve(sourcePath).toLowerCase()
            ) {
              logger.info(
                `Found existing shortcut: ${shortcutFile} -> ${resolved}`
              );
              return shortcutFile;
            }
          } catch (e) {
            logger.warn(`Failed to resolve shortcut: ${shortcutPath}`, e);
          }
        }
        logger.info("savefile is false, creating a shortcut instead.");
        let shortcutName = `${baseName}.lnk`;
        let shortcutPath = path.join(targetDir, shortcutName);
        let counter = 1;
        // Ensure unique shortcut name
        while (fs.existsSync(shortcutPath)) {
          shortcutName = `${baseName}(${counter}).lnk`;
          shortcutPath = path.join(targetDir, shortcutName);
          counter++;
        }

        // Build the path to create_shortcut.exe
        const scriptsPath = getScriptsPath();
        const exePath = path.join(scriptsPath, "create_shortcut.exe");

        // Run the executable
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(exePath, [sourcePath, shortcutPath], {
            windowsHide: true,
          });

          let errorOutput = "";
          proc.stderr.on("data", (data) => {
            errorOutput += data.toString();
          });

          proc.on("close", (code) => {
            if (code === 0 && fs.existsSync(shortcutPath)) {
              logger.info(`Shortcut created at: ${shortcutPath}`);
              resolve();
            } else {
              openSmallWindow(
                "Failed to create shortcut",
                `Failed to create shortcut for: ${sourcePath}\nError: ${errorOutput || "Unknown error"}`
              );
              reject(new Error(errorOutput || "Failed to create shortcut"));
            }
          });
        });
        return shortcutName;
      }

      // No matching, so copy the file
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
        logger.info(`File saved to: ${targetPath}`);

        return localFileName;
      } catch (error) {
        logger.error("Failed to save file:", error);
        throw error;
      }
    }
  );

  // Handle log messages from the renderer process
  ipcMainHandle("logMessage", async (level, file, message) => {
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
    return true;
  });
  ipcMainHandle("logVideoMessage", async (level, file, message) => {
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
    return true;
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
          openSmallWindow(
            "No program",
            `No program path set for icon: ${icon.name}`,
            ["OK"]
          );
          return false;
        }

        const launchPath = icon.programLink;

        if (!fs.existsSync(launchPath)) {
          logger.warn(`Launch path does not exist: ${launchPath}`);
          openSmallWindow(
            "File not exist",
            `failed to launch ${launchPath} as it does not exist`,
            ["OK"]
          );
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
          logger.error(`No icon found at [${row}, ${col}]`);
          return false;
        }

        if (!icon.websiteLink) {
          logger.warn(`No websiteLink found for icon at [${row}, ${col}]`);
          openSmallWindow(
            "No website",
            `No website link set for icon: ${icon.name}`,
            ["Ok"]
          );
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

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return "directory";
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
      type: "image" | "programLink" | "background",
      filePath: string
    ): Promise<boolean> => {
      try {
        if (type === "background") {
          filePath = await idToBackgroundFolder(filePath);
          shell.openPath(filePath);
          logger.info(`Opened ${type} in Explorer: ${filePath}`);
          return true;
        }
        let resolvedPath = filePath;

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
      mainWindow?.focus();

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
        // Ensure updates is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid Icon updates object:", updates);
          return false;
        }

        // Notify the renderer process to update the preview
        if (mainWindow) {
          mainWindow.webContents.send("update-icon-preview", {
            row,
            col,
            updates, // Ensure this is the correct object
          });
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
  ipcMainHandle(
    "previewBackgroundUpdate",
    async (updates: Partial<SettingsData>): Promise<boolean> => {
      try {
        logger.info(
          "Received previewBackgroundUpdate with updates:",
          JSON.stringify(updates)
        );

        // Ensure updates is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid updates object:", updates);
          return false;
        }

        if (mainWindow) {
          mainWindow.webContents.send("update-background-preview", updates);
          logger.info(
            "Sent 'update-background-preview' event to renderer with data:",
            JSON.stringify(updates)
          );
        }

        return true;
      } catch (error) {
        logger.error("Error handling previewBackgroundUpdate:", error);
        return false;
      }
    }
  );
  ipcMainHandle(
    "previewGridUpdate",
    async (updates: Partial<SettingsData>): Promise<boolean> => {
      try {
        // Ensure updates is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid updates object:", updates);
          return false;
        }

        if (mainWindow) {
          mainWindow.webContents.send("update-grid-preview", updates);
        }

        return true;
      } catch (error) {
        logger.error("Error handling previewGridUpdate:", error);
        return false;
      }
    }
  );
  ipcMainHandle(
    "previewHeaderUpdate",
    async (updates: Partial<SettingsData>): Promise<boolean> => {
      try {
        // Ensure header is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid header object:", updates);
          return false;
        }

        if (mainWindow) {
          mainWindow.webContents.send("update-header-preview", updates);
        }

        return true;
      } catch (error) {
        logger.error("Error handling previewHeaderUpdate:", error);
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
    async (data: Partial<SettingsData>): Promise<boolean> => {
      logger.info("SaveSettingsData called with data:", JSON.stringify(data));
      const result = await saveSettingsData(data);
      mainWindow.webContents.send("reload-grid");
      updateHeader(mainWindow);
      return result;
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
  ipcMainHandle("convertToVideoFileUrl", async (filePath: string) => {
    try {
      // Check if the file exists and is a video
      if (!fs.existsSync(filePath)) {
        logger.warn(`Video file does not exist: ${filePath}`);
        return null;
      }
      // Check file extension
      const fileExt = path.extname(filePath).toLowerCase();
      const allowedExtensions = [".mp4", ".webm", ".mov", ".ogg", ".mkv"];

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
  ipcMainHandle("getBackgroundImagePath", async (filePath: string) => {
    try {
      // Check file extension
      const fileExt = path.extname(filePath).toLowerCase();
      const allowedExtensions = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".svg",
        ".webp",
        ".lnk",
        ".ico",
      ];

      if (!allowedExtensions.includes(fileExt)) {
        logger.warn(`Not a valid image file: ${filePath}`);
        return null;
      }

      let pathResult: string;

      // Check if the filePath is an absolute path
      if (path.isAbsolute(filePath)) {
        logger.info(`Using absolute file path: ${filePath}`);
        pathResult = getSafeFileUrl(filePath);
      } else {
        // Convert to a relative path within the backgrounds directory
        const pathRelative = path.join("/backgrounds", filePath);
        pathResult = getSafeFileUrl(pathRelative);
      }

      logger.info("Returning image URL:", pathResult);
      return pathResult;
    } catch (error) {
      logger.error(`Error converting path to image URL: ${error}`);
      return null;
    }
  });
  ipcMainHandle("reloadBackground", async () => {
    try {
      logger.info("Sending reload-background event to renderer...");
      mainWindow.webContents.send("reload-background");
      return true;
    } catch (error) {
      logger.error("Failed to send reload-background event:", error);
      return false;
    }
  });
  ipcMainHandle("reloadGrid", async () => {
    try {
      logger.info("Sending reload-grid event to renderer...");
      mainWindow.webContents.send("reload-grid");
      return true;
    } catch (error) {
      logger.error("Failed to send reload-grid event:", error);
      return false;
    }
  });
  ipcMainHandle("reloadHeader", async () => {
    try {
      logger.info("Sending reload-header event to renderer...");
      mainWindow.webContents.send("reload-header");
      return true;
    } catch (error) {
      logger.error("Failed to send reload-grid event:", error);
      return false;
    }
  });
  ipcMainHandle(
    "getVideoMetadata",
    async (filePath: string): Promise<VideoMetadata> => {
      try {
        logger.info(`Retrieving video metadata for: ${filePath}`);
        if (!fs.existsSync(filePath)) {
          logger.error(`File does not exist: ${filePath}`);
          throw new Error(`File does not exist: ${filePath}`);
        }

        return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
              logger.error(`Error retrieving video metadata: ${err.message}`);
              reject(err);
            } else {
              logger.info(`Retrieved video metadata for ${filePath}`);
              const formattedMetadata: VideoMetadata = {
                format: {
                  filename: metadata.format.filename || "",
                  duration: metadata.format.duration || 0,
                  size: metadata.format.size || 0,
                  bit_rate: metadata.format.bit_rate || 0,
                  format_name: metadata.format.format_name || "",
                  format_long_name: metadata.format.format_long_name || "",
                },
                streams: metadata.streams.map((stream) => ({
                  codec_name: stream.codec_name || "",
                  codec_type: stream.codec_type as "video" | "audio",
                  codec_tag_string: stream.codec_tag_string || "", // Include codec tag string
                  codec_tag: stream.codec_tag || "", // Include codec tag
                  width: stream.width,
                  height: stream.height,
                  duration: stream.duration
                    ? parseFloat(stream.duration)
                    : undefined, // Parse duration as a number
                  bit_rate: stream.bit_rate
                    ? parseInt(stream.bit_rate, 10)
                    : undefined, // Parse bit_rate as a number
                  sample_rate: stream.sample_rate,
                  channels: stream.channels,
                })),
              };
              resolve(formattedMetadata);
            }
          });
        });
      } catch (error) {
        logger.error(`Error in getVideoMetadata for ${filePath}: ${error}`);
        throw error;
      }
    }
  );

  ipcMainHandle(
    "generateIcon",
    async (
      row: number,
      col: number,
      filePath: string,
      webLink: string
    ): Promise<string[]> => {
      const savePath = path.join(getDataFolderPath(), `[${row},${col}]`);
      logger.info("savePath= ", savePath);
      return generateIcon(savePath, filePath, webLink);
    }
  );

  ipcMainHandle(
    "selectIconFromList",
    async (
      title: string,
      images: string[],
      row: number,
      col: number
    ): Promise<string> => {
      const ret = await openSelectIconWindow(title, images, row, col);
      if (ret === "Close") {
        //Closes without selecting an icon return empty string.
        return "";
      } else {
        return ret;
      }
    }
  );

  ipcMainHandle("resetAllIconsFontColor", async () => {
    return resetAllIconsFontColor();
  });

  ipcMainHandle("desktopSetShowIcons", async (showIcons: boolean) => {
    try {
      logger.info(`Setting showIcons to: ${showIcons}`);
      mainWindow?.webContents.send("set-show-icons", showIcons);
      return true;
    } catch (error) {
      logger.error("Error in desktopSetShowIcons:", error);
      return false;
    }
  });
  ipcMainHandle("getBackgroundIDs", async () => {
    try {
      const backgroundsFile = getBackgroundsJsonFilePath();
      const raw = await fs.promises.readFile(backgroundsFile, "utf-8");
      const { backgrounds } = JSON.parse(raw);
      return Object.keys(backgrounds);
    } catch (error) {
      logger.error("Failed to get background IDs:", error);
      return [];
    }
  });
  ipcMainHandle(
    "getBackgroundSummaries",
    async ({
      offset = 0,
      limit = 10,
      search = "",
      includeTags = [],
      excludeTags = [],
    }: GetBackgroundSummariesRequest = {}) => {
      const backgroundsFile = getBackgroundsJsonFilePath();

      const raw = await fs.promises.readFile(backgroundsFile, "utf-8");
      const { backgrounds } = JSON.parse(raw);

      let entries: [string, number][] = Object.entries(backgrounds)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .map(([id, value]) => [id, Number(value)]);

      // Apply search filter
      entries = await filterBackgroundEntries(
        entries,
        search,
        includeTags,
        excludeTags
      );

      const total = entries.length;
      entries = entries.slice(offset, offset + limit);

      const results = [];
      for (const [id] of entries) {
        let folderPath: string;
        let bgJsonPath: string;
        let iconPath = "";
        let bgFile = "";

        // Detect and resolve externalPath files
        const extMatch = id.match(/^ext::(\d+)::(.+)$/);
        if (extMatch) {
          const extIndex = Number(extMatch[1]);
          const folder = extMatch[2];
          const extBase = await getExternalPath(extIndex);
          if (extBase) {
            folderPath = path.join(extBase, folder);
            bgJsonPath = path.join(folderPath, "bg.json");
          } else {
            // fallback to backgrounds dir if external path not found
            const baseDir = getBackgroundFilePath();
            folderPath = path.join(baseDir, folder);
            bgJsonPath = path.join(folderPath, "bg.json");
          }
        } else {
          const baseDir = getBackgroundFilePath();
          folderPath = id.includes("/")
            ? path.join(baseDir, ...id.split("/"))
            : path.join(baseDir, id);
          bgJsonPath = path.join(folderPath, "bg.json");
        }

        try {
          const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
          const bg = JSON.parse(rawBg);

          if (bg.public?.icon) {
            iconPath = path.join(folderPath, bg.public.icon);
          }
          if (bg.public?.bgFile) {
            bgFile = path.join(folderPath, bg.public.bgFile);
          }
          results.push({
            id,
            name: bg.public?.name,
            bgFile: bgFile,
            description: bg.public?.description,
            iconPath: iconPath,
            tags: (bg.public?.tags ?? []).filter((t: string) =>
              PUBLIC_TAGS_FLAT.includes(t)
            ),
            localTags: (bg.local?.tags ?? []).filter((t: string) =>
              (getSetting("localTags") as LocalTag[]).some(
                (tag) => tag.name === t
              )
            ),
            localIndexed: bg.local?.indexed,
          });
        } catch (e) {
          logger.error(`Failed to read bg.json for ${id}:`, e);
          results.push({ id });
        }
      }

      return { results, total };
    }
  );
  ipcMainHandle(
    "getBackgroundPageForId",
    async ({
      id,
      pageSize = 10,
      search = "",
      includeTags = [],
      excludeTags = [],
    }: GetBackgroundPageForIdRequest) => {
      const backgroundsFile = getBackgroundsJsonFilePath();
      const raw = await fs.promises.readFile(backgroundsFile, "utf-8");
      const { backgrounds } = JSON.parse(raw);

      let entries: [string, number][] = Object.entries(backgrounds)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .map(([id, value]) => [id, Number(value)]);

      // Apply search filter
      entries = await filterBackgroundEntries(
        entries,
        search,
        includeTags,
        excludeTags
      );

      const idx = entries.findIndex(([bgId]) => bgId === id);
      const page = idx !== -1 ? Math.floor(idx / pageSize) : -1;

      // Optionally, return the summary for that ID if found
      let summary: BackgroundSummary | undefined;
      if (idx !== -1) {
        const baseDir = getBackgroundFilePath();
        const folderPath = id.includes("/") ? path.join(...id.split("/")) : id;
        const bgJsonPath = path.join(baseDir, folderPath, "bg.json");
        try {
          const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
          const bg = JSON.parse(rawBg);
          let iconPath = "";
          let bgFile = "";
          if (bg.public.icon) {
            iconPath = path.join(
              getBackgroundFilePath(),
              folderPath,
              bg.public.icon
            );
          }
          if (bg.public.bgFile) {
            bgFile = path.join(
              getBackgroundFilePath(),
              folderPath,
              bg.public.bgFile
            );
          }
          summary = {
            id,
            name: bg.public?.name,
            bgFile: bgFile,
            description: bg.public?.description,
            iconPath: iconPath,
            tags: (bg.public?.tags ?? []).filter(
              (
                t: string // Only return public tags.
              ) => PUBLIC_TAGS_FLAT.includes(t)
            ),
            localTags: bg.local?.tags ?? [],
          };
        } catch {
          summary = { id };
        }
      }

      return { page, summary };
    }
  );
  ipcMainHandle("idToFilePath", async (id: string) => {
    return idToBackgroundPath(id);
  });

  ipcMainHandle(
    "resolveShortcut",
    async (filePath: string): Promise<string> => {
      try {
        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          logger.warn(`File does not exist: ${filePath}`);
          return "";
        }
        filePath = resolveShortcut(filePath);
        return filePath;
      } catch (error) {
        logger.error(`Error resolving file path: ${error}`);
        return "";
      }
    }
  );

  ipcMainHandle(
    "openEditBackground",
    async (summary: BackgroundSummary): Promise<boolean> => {
      try {
        openEditBackground(summary);
        return true;
      } catch (error) {
        logger.error(`Error opening EditBackground window: ${error}`);
        return false;
      }
    }
  );
  ipcMainHandle(
    "saveBgJson",
    async (summary: BackgroundSummary): Promise<boolean> => {
      return saveBgJsonFile(summary);
    }
  );
  ipcMainHandle("deleteBackground", async (id: string): Promise<boolean> => {
    try {
      if (!id) throw new Error("Missing background id");
      const bgDir = await idToBackgroundFolder(id);

      // Send the entire background directory to the recycle bin
      if (fs.existsSync(bgDir)) {
        logger.info(bgDir);
        await shell.trashItem(bgDir);
        logger.info(`Moved background directory: ${bgDir} to recycle bin. `);
      }

      // Remove backgroundID from backgrounds.json
      const backgroundsFile = getBackgroundsJsonFilePath();
      const raw = await fs.promises.readFile(backgroundsFile, "utf-8");
      const data = JSON.parse(raw);
      if (data.backgrounds && typeof data.backgrounds === "object") {
        delete data.backgrounds[id];
      }
      await fs.promises.writeFile(
        backgroundsFile,
        JSON.stringify(data, null, 2),
        "utf-8"
      );
      logger.info(`Removed background ${id} from backgrounds.json`);

      return true;
    } catch (error) {
      logger.error(`Failed to delete background ${id}:`, error);
      return false;
    }
  });
  ipcMainHandle(
    "idToBackgroundFolder",
    async (id: string): Promise<string | null> => {
      return idToBackgroundFolder(id);
    }
  );
  ipcMainHandle("addLocalTag", async (tag: LocalTag): Promise<boolean> => {
    try {
      // Validate name: no spaces, must be lowercase, not in PUBLIC_TAGS or localTags
      if (!tag.name || typeof tag.name !== "string") {
        logger.warn("Invalid tag name:", tag.name);
        openSmallWindow(
          "Invalid Tag",
          "Tag name must be a non-empty string without spaces.",
          ["Okay"]
        );
        return false;
      }
      if (/\s/.test(tag.name)) {
        logger.warn("Tag name contains spaces:", tag.name);
        openSmallWindow("Invalid Tag", "Tag name cannot contain spaces.", [
          "Okay",
        ]);
        return false;
      }
      const name = tag.name.toLowerCase();

      // Check against PUBLIC_TAGS
      if (PUBLIC_TAGS_FLAT.map((t) => t.toLowerCase()).includes(name)) {
        logger.warn(`Attempted to add a public tag as a local tag: ${name}`);
        openSmallWindow(
          "Invalid Tag",
          "You cannot add a public tag as a local tag.",
          ["Okay"]
        );
        return false;
      }

      // Get current localTags (support both string[] and LocalTag[])
      let localTagsRaw = getSetting("localTags") as (string | LocalTag)[];
      if (!Array.isArray(localTagsRaw)) localTagsRaw = [];

      // Filter to only LocalTag objects
      const localTags: LocalTag[] = localTagsRaw
        .filter(
          (t): t is LocalTag =>
            typeof t === "object" && t !== null && "name" in t
        )
        .map((t) => ({ ...t, name: t.name.toLowerCase() }));

      // Check for duplicates in localTags
      const exists = localTags.some((t) => t.name === name);
      if (exists) {
        logger.warn(`Tag already exists: ${name}`);
        openSmallWindow(
          "Tag Already Exists",
          `The tag "${name}" already exists. Please choose a different name.`,
          ["Okay"]
        );
        return false;
      }

      localTags.push({ ...tag, name });
      addCategory(tag.category);

      await saveSettingsData({ localTags });
      return true;
    } catch (e) {
      logger.error("Failed to add local tag:", e);
      openSmallWindow(
        "Error Adding Tag",
        `An error occurred while adding the tag:\n ${e}`,
        ["Okay"]
      );
      return false;
    }
  });
  ipcMainHandle(
    "updateLocalTag",
    async (name: string, tag: LocalTag): Promise<boolean> => {
      try {
        let localTagsRaw = getSetting("localTags") as LocalTag[];
        if (!Array.isArray(localTagsRaw)) localTagsRaw = [];

        // Find the tag to update by the original name (case-insensitive)
        const idx = localTagsRaw.findIndex(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        );
        if (idx === -1) {
          logger.error(
            "Tag not found for update:",
            name + " attempted to save tag: " + tag
          );
          return false; // Tag not found
        }

        // Update the tag (allowing the name to change)
        localTagsRaw[idx] = { ...tag, name: tag.name.toLowerCase() };
        addCategory(tag.category);
        await saveSettingsData({ localTags: localTagsRaw });
        return true;
      } catch (e) {
        logger.error("Failed to update local tag:", e);
        return false;
      }
    }
  );
  ipcMainHandle("deleteLocalTag", async (name: string): Promise<boolean> => {
    try {
      let localTagsRaw = getSetting("localTags") as LocalTag[];
      if (!Array.isArray(localTagsRaw)) localTagsRaw = [];

      // Find the tag to delete by the original name (case-insensitive)
      const idx = localTagsRaw.findIndex(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      );
      if (idx === -1) {
        logger.error("Tag not found for deletion:", name);
        return false; // Tag not found
      }

      // Remove the tag
      localTagsRaw.splice(idx, 1);

      await saveSettingsData({ localTags: localTagsRaw });
      return true;
    } catch (e) {
      logger.error("Failed to delete local tag:", e);
      return false;
    }
  });
  ipcMainHandle("getTagCategories", async (): Promise<string[]> => {
    return getCategories();
  });
  ipcMainHandle(
    "renameCategory",
    async (oldName: string, newName: string): Promise<boolean> => {
      return renameCategory(oldName, newName);
    }
  );
  ipcMainHandle("deleteCategory", async (name: string): Promise<boolean> => {
    return deleteCategory(name);
  });
  ipcMainHandle("renameLocalTag", async (oldName: string, newName: string) => {
    return renameLocalTag(oldName, newName);
  });
  ipcMainHandle(
    "indexBackgrounds",
    async (options?: { newExternalPathAdded?: boolean }) => {
      return indexBackgrounds(options);
    }
  );
  ipcMainHandle(
    "moveToBackgroundFolder",
    async (id: string, targetLocation: string): Promise<string | null> => {
      return moveToBackgroundFolder(id, targetLocation);
    }
  );
}
