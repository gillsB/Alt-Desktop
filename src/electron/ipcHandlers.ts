import { spawn } from "child_process";
import { BrowserWindow, dialog, screen, shell } from "electron";
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
  getLocalCategories,
  getSetting,
  renameCategory,
  renameLocalTag,
  saveSettingsData,
} from "./settings.js";
import {
  bgPathToResolution,
  bgPathToVideoMetadata,
} from "./utils/bgPathToInfo.js";
import { generateIcon } from "./utils/generateIcon.js";
import {
  idToBackgroundFileType,
  idToBackgroundName,
  idToBackgroundPath,
  idToBackgroundVolume,
  idToBgJson,
  idToBgJsonPath,
  idToDescription,
  idToFolderPath,
  idToIconPath,
  idToIndexed,
  idToLocalTags,
  idToProfile,
  idToTags,
} from "./utils/idToInfo.js";
import {
  getRendererState,
  getRendererStates,
  setRendererStates,
} from "./utils/rendererStates.js";
import { safeSpawn } from "./utils/safeSpawn.js";
import {
  changeBackgroundDirectory,
  deleteIconData,
  ensureFileExists,
  ensureProfileFolder,
  ensureUniqueIconId,
  escapeRegExp,
  filterBackgroundEntries,
  getAppDataPath,
  getBackgroundFilePath,
  getBackgroundsJsonFilePath,
  getBasePath,
  getBgJsonFile,
  getDesktopIcon,
  getDesktopUniqueFiles,
  getIconsFolderPath,
  getLogsFolderPath,
  getProfileJsonPath,
  getProfiles,
  getProfilesPath,
  getSelectedProfilePath,
  getSettingsFilePath,
  importIconsFromDesktop,
  indexBackgrounds,
  ipcMainHandle,
  ipcMainOn,
  moveDesktopIcon,
  resetAllIconsFontColor,
  resolveShortcut,
  saveBgJsonFile,
  saveIconData,
  saveImageToIconFolder,
  setSmallWindowDevtoolsEnabled,
  setSubWindowDevtoolsEnabled,
  swapDesktopIcons,
  updateHeader,
} from "./utils/util.js";
import { getVideoFileUrl } from "./videoFileProtocol.js";
import { openBackgroundSelectWindow } from "./windows/backgroundSelectWindow.js";
import { openDesktopProfileWindow } from "./windows/desktopProfile.js";
import { openEditBackground } from "./windows/editBackgroundWindow.js";
import { openEditIconWindow } from "./windows/editIconWindow.js";
import { openSettingsWindow } from "./windows/settingsWindow.js";
import {
  closeActiveSubWindow,
  getActiveSubWindow,
  openSelectIconWindow,
  pendingSmallWindowResponses,
  showSmallWindow,
} from "./windows/subWindowManager.js";

ffmpeg.setFfprobePath(ffprobeStatic.path);

const logger = createLoggerForFile("ipcHandlers.ts");
const PUBLIC_TAGS_FLAT = PUBLIC_TAG_CATEGORIES.flatMap((cat) => cat.tags);

const infoHandlers = {
  bgJsonFilePath: idToBgJsonPath,
  bgJson: idToBgJson,
  folderPath: idToFolderPath,
  fileType: idToBackgroundFileType,
  name: idToBackgroundName,
  backgroundPath: idToBackgroundPath,
  iconPath: idToIconPath,
  description: idToDescription,
  tags: idToTags,
  localVolume: idToBackgroundVolume, // Sometimes referred to as local volume (same as volume).
  volume: idToBackgroundVolume,
  localTags: idToLocalTags,
  localIndexed: idToIndexed,
  indexed: idToIndexed,
  profile: idToProfile,
} as const;

const bgPathToInfoHandlers = {
  resolution: bgPathToResolution,
} as const;

export function registerIpcHandlers(mainWindow: Electron.BrowserWindow) {
  ipcMainHandle(
    "getDesktopIconData",
    async (profile?: string): Promise<DesktopIconData> => {
      let filePath = "";
      // If specifically called with profile, return profile iconData
      if (profile) {
        filePath = getProfileJsonPath(profile);
      } else {
        // Fetch current rendererState profile
        const rendererProfile = await getRendererState("profile");
        if (!rendererProfile) {
          logger.warn(
            "Profile not found, either no bg selected or no profile set."
          );
          // No rendererState profile then return empty DesktopIconData
          setRendererStates({ profile: "default" });
          filePath = getProfileJsonPath("default");
        } else {
          filePath = getProfileJsonPath(rendererProfile);
        }
      }

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
    }
  );

  ipcMainHandle(
    "getDesktopIcon",
    async (id: string): Promise<DesktopIcon | null> => {
      return getDesktopIcon(id);
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
    (payload: { action: SubWindowAction; title: string }) => {
      logger.info(`sendSubWindowAction with title: ${payload.title}`);
      switch (payload.action) {
        case "CLOSE_SUBWINDOW":
          logger.info(`SubWindowAction CLOSE_SUBWINDOW`);
          mainWindow.focus();
          closeActiveSubWindow();
          if (mainWindow) {
            mainWindow.webContents.send("hide-highlight");
            mainWindow.webContents.send("subwindow-closed", payload.title);
            logger.info("Sent 'hide-highlight' message to renderer.");
          }
          break;
      }
    }
  );

  ipcMainHandle(
    "ensureProfileFolder",
    async (profile: string, copyFromProfile?: string): Promise<boolean> => {
      return ensureProfileFolder(profile, copyFromProfile);
    }
  );

  ipcMainHandle(
    "ensureDataFolder",
    async (profile: string, id: string): Promise<boolean> => {
      try {
        const fullPath = path.join(getIconsFolderPath(profile), id);

        if (!fs.existsSync(fullPath)) {
          logger.info(
            `Data folder ${id} does not exist, creating: ${fullPath}`
          );
          fs.mkdirSync(fullPath, { recursive: true });
          logger.info(`Data folder ${id} created successfully.`);
        }

        // Ensure Data file exists
        return ensureFileExists(fullPath, { icons: [] });
      } catch (error) {
        logger.error(`Error ensuring Data folder ${id}: ${error}`);
        return false;
      }
    }
  );

  ipcMainHandle(
    "ensureUniqueIconId",
    async (profile: string, name: string): Promise<string | null> => {
      return ensureUniqueIconId(profile, name);
    }
  );

  ipcMainHandle("saveIconData", async (icon: DesktopIcon): Promise<boolean> => {
    return saveIconData(icon);
  });

  ipcMainHandle(
    "renameID",
    async (oldId: string, newId: string): Promise<boolean> => {
      try {
        const profilesPath = getProfilesPath();
        const profileFolders = fs
          .readdirSync(profilesPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        let changed = false;

        for (const folder of profileFolders) {
          const profileJsonPath = path.join(
            profilesPath,
            folder,
            "profile.json"
          );
          if (fs.existsSync(profileJsonPath)) {
            try {
              const data = fs.readFileSync(profileJsonPath, "utf-8");
              const parsed: DesktopIconData = JSON.parse(data);

              let updated = false;
              if (Array.isArray(parsed.icons)) {
                for (const icon of parsed.icons) {
                  if (icon.id === oldId) {
                    icon.id = newId;
                    updated = true;
                    changed = true;
                  }
                }
              }

              if (updated) {
                fs.writeFileSync(
                  profileJsonPath,
                  JSON.stringify(parsed, null, 2),
                  "utf-8"
                );
                logger.info(
                  `Updated icon id in ${profileJsonPath}: ${oldId} -> ${newId}`
                );
              }
            } catch (err) {
              logger.error(`Failed to update ${profileJsonPath}: ${err}`);
            }
          }
        }

        return changed;
      } catch (error) {
        logger.error(`Failed to rename icon id in profiles: ${error}`);
        return false;
      }
    }
  );

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

  ipcMainHandle("reloadIcon", async (id: string): Promise<boolean> => {
    const filePath = await getSelectedProfilePath();
    logger.info("reloadIcon filePath = ", filePath);

    try {
      // Read JSON file
      const data = fs.readFileSync(filePath, "utf-8");
      const parsedData: DesktopIconData = JSON.parse(data);

      // Find the icon with the specified row and col
      const icon = parsedData.icons.find((icon) => icon.id === id);

      // Notify the renderer process to reload the icon
      if (mainWindow) {
        logger.info(`Sending reload request to renderer for icon ${id}`);
        mainWindow.webContents.send("reload-icon", { id, icon });
      }

      if (icon) {
        logger.info(`Reloaded icon: ${id}: ${JSON.stringify(icon)}`);

        return true;
      } else {
        logger.warn(
          `No icon found with id: ${id} to reload. (sent null response)`
        );
        return false; // Icon not found
      }
    } catch (error) {
      logger.error(`Error reloading icon: ${id} : ${error}`);
      return false; // Error occurred
    }
  });

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
    "openBackgroundSelect",
    async (id?: string): Promise<boolean> => {
      try {
        if (id) logger.info("called openBackgroundSelect with ID: ", id);
        logger.info(`ipcMainHandle openBackgroundSelect called`);
        if (id) {
          openBackgroundSelectWindow(id);
        } else {
          openBackgroundSelectWindow();
        }

        return true;
      } catch (error) {
        logger.error(`Error opening settings window: ${error}`);
        return false;
      }
    }
  );

  ipcMainHandle(
    "editIcon",
    async (id: string, row: number, col: number): Promise<boolean> => {
      try {
        logger.info(`ipcMainHandle editIcon called with ${id}`);
        openEditIconWindow(id, row, col);
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

        if (type === "folder") {
          options.properties = ["openDirectory"];
        } else {
          options.properties = ["openFile"];
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
            // All files
            options.filters.push({
              name: "All Files",
              extensions: ["*"],
            });

            // Stupidest trick ever adding "*" filter resolves all shortcuts (.lnks) to their targets.
            // But adding all other extensions via wildcard doesn't....
            // Its important especially for program path to get shortcuts as they might have saved command args (looking at you discord)...
            options.filters.push({
              name: "All Files",
              extensions: [
                ...[..."abcdefghijklmnopqrstuvwxyz"].map(
                  // append a* b* c* ... z* to extensions
                  (letter) => `${letter}*`
                ),
                ...[..."0123456789"].map((number) => `${number}*`), // append 0* 1* ... 9* to extensions
              ],
            });
          }
        }

        result = await dialog.showOpenDialog(options);
        logger.info(`File dialog result: ${JSON.stringify(result)}`);

        if (result.canceled || result.filePaths.length === 0) {
          return null; // No file selected
        }

        return result.filePaths[0]; // Return the selected file or folder path
      } catch (error) {
        logger.error(`Error in openFileDialog: ${error}`);
        return null;
      }
    }
  );

  ipcMainHandle(
    "saveImageToIconFolder",
    async (
      sourcePath: string,
      profile: string,
      id: string
    ): Promise<string> => {
      try {
        return saveImageToIconFolder(sourcePath, profile, id);
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
      const targetDir = await idToFolderPath(id);

      const ext = path.extname(sourcePath);
      const baseName = path.basename(sourcePath, ext);

      // Verify that the source file exists
      if (!fs.existsSync(sourcePath)) {
        logger.error(`SaveToBgIDFileSource file does not exist: ${sourcePath}`);
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
              showSmallWindow(
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
        const stat = fs.statSync(sourcePath);
        const totalSize = stat.size;
        let copied = 0;
        let currentProgress = 0;

        const win = BrowserWindow.getAllWindows()[0];

        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(sourcePath);
          const writeStream = fs.createWriteStream(targetPath);

          readStream.on("data", (chunk) => {
            copied += chunk.length;
            const newProgress = Math.round((copied / totalSize) * 100);
            if (win && newProgress > currentProgress) {
              win.webContents.send("background-file-progress", {
                progress: Math.round((copied / totalSize) * 100),
                done: copied >= totalSize,
              });
              currentProgress = newProgress;
            }
          });

          readStream.on("error", reject);
          writeStream.on("error", reject);

          writeStream.on("finish", () => {
            if (win) {
              win.webContents.send("background-file-progress", {
                progress: 100,
                done: true,
              });
            }
            resolve();
          });

          readStream.pipe(writeStream);
        });

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

  ipcMainHandle("launchProgram", async (id: string): Promise<boolean> => {
    const filePath = await getSelectedProfilePath();

    try {
      const data = fs.readFileSync(filePath, "utf-8");
      const parsedData: DesktopIconData = JSON.parse(data);

      const icon = parsedData.icons.find((icon) => icon.id === id);

      if (!icon) {
        logger.warn(`No icon found: ${id}`);
        return false;
      }

      if (!icon.programLink) {
        logger.warn(`No programLink found for icon: ${id}`);
        showSmallWindow(
          "No program",
          `No program path set for icon: ${id} name: ${icon.name}`,
          ["OK"]
        );
        return false;
      }

      const launchPath = icon.programLink;

      if (!fs.existsSync(launchPath)) {
        logger.warn(`Launch path does not exist: ${launchPath}`);
        showSmallWindow(
          "File not exist",
          `failed to launch ${launchPath} as it does not exist`,
          ["OK"]
        );
        return false;
      }

      logger.info(`Launching program: ${launchPath}`);

      return safeSpawn(icon.programLink, icon.args || []);
    } catch (error) {
      logger.error(`Error in launchProgram: ${error}`);
      return false;
    }
  });
  ipcMainHandle("launchWebsite", async (id: string): Promise<boolean> => {
    const filePath = await getSelectedProfilePath();

    try {
      const data = fs.readFileSync(filePath, "utf-8");
      const parsedData: DesktopIconData = JSON.parse(data);

      const icon = parsedData.icons.find((icon) => icon.id === id);

      if (!icon) {
        logger.error(`No icon found: ${id}`);
        return false;
      }

      if (!icon.websiteLink) {
        logger.warn(`No websiteLink found for icon: ${icon.id}`);
        showSmallWindow(
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
  });

  ipcMainHandle("getFileType", async (filePath: string): Promise<string> => {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn(`getFileType: File does not exist: ${filePath}`);
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
    async (profile: string, id: string): Promise<boolean> => {
      const filePath = await getSelectedProfilePath();

      try {
        logger.info(`Deleting icon ${id} from ${filePath}`);

        // Ensure the file exists
        if (!fs.existsSync(filePath)) {
          logger.warn(`File not found: ${filePath}`);
          return false;
        }

        // Read the JSON file
        const data = fs.readFileSync(filePath, "utf-8");
        const desktopData: DesktopIconData = JSON.parse(data);

        // Filter out the icon with the matching row and col
        const updatedIcons = desktopData.icons.filter((icon) => icon.id !== id);

        if (updatedIcons.length === desktopData.icons.length) {
          logger.warn(`No icon found to delete.`);
          return false; // No icon was deleted
        }

        // Update the JSON data
        desktopData.icons = updatedIcons;

        // Write the updated JSON back to the file
        fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2));
        logger.info(`Successfully deleted icon: ${id}`);

        try {
          const profilesPath = getProfilesPath();
          const profileFolders = fs
            .readdirSync(profilesPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

          for (const folder of profileFolders) {
            // Skip current profile
            if (folder === profile) continue;
            const profileJsonPath = path.join(
              profilesPath,
              folder,
              "profile.json"
            );
            if (fs.existsSync(profileJsonPath)) {
              try {
                const data = fs.readFileSync(profileJsonPath, "utf-8");
                const parsed: DesktopIconData = JSON.parse(data);
                if (Array.isArray(parsed.icons)) {
                  if (parsed.icons.some((icon) => icon.id === id)) {
                    logger.info(
                      `icon found in profile: ${folder}, keeping data folder`
                    );
                    return true; // Early return if found in another profile
                  }
                }
              } catch (err) {
                logger.error(
                  `Failed to read or parse ${profileJsonPath}: ${err}`
                );
              }
            }
          }

          // Icon is unique to this profile, delete its data folder
          await deleteIconData(profile, id);
          logger.info(
            `Icon ${id} was unique to profile ${profile}, deleted its data folder.`
          );
        } catch (err) {
          logger.error(`Error checking icon usage in other profiles: ${err}`);
        }

        return true;
      } catch (error) {
        logger.error(`Error deleting icon ${id}: ${error}`);
        return false;
      }
    }
  );

  ipcMainHandle(
    "deleteIconData",
    async (profile: string, id: string): Promise<boolean> => {
      return deleteIconData(profile, id);
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
          filePath = await idToFolderPath(filePath);
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
          logger.warn(`OpenInExplorer File does not exist: ${resolvedPath}`);

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

        // Call showSmallWindow and wait for the button clicked
        const buttonClicked = await showSmallWindow(title, message, buttons);

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
    async (id: string, updates: Partial<DesktopIcon>): Promise<boolean> => {
      try {
        // Ensure updates is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid Icon updates object:", updates);
          return false;
        }

        // Notify the renderer process to update the preview
        if (mainWindow) {
          mainWindow.webContents.send("update-icon-preview", {
            id,
            updates, // Ensure this is the correct object
          });
        }

        return true;
      } catch (error) {
        logger.error(
          `Error handling previewIconUpdate for icon ${id}: ${error}`
        );
        return false;
      }
    }
  );
  ipcMainHandle(
    "previewBackgroundUpdate",
    async (updates: Partial<PreviewBackgroundUpdate>): Promise<boolean> => {
      try {
        // Ensure updates is not null or undefined
        if (!updates || typeof updates !== "object") {
          logger.error("Invalid updates object:", updates);
          return false;
        }

        if (mainWindow) {
          mainWindow.webContents.send("preview-background-update", updates);
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

      // Specific keys which require a reload of the grid
      const gridReloadKeys = [
        "background",
        "defaultFontSize",
        "defaultIconSize",
        "defaultFontColor",
        "newBackgroundID",
      ] as const;

      const gridShouldReload = gridReloadKeys.some((key) => key in data);

      if (gridShouldReload) {
        mainWindow.webContents.send("reload-grid");
        updateHeader(mainWindow);
      }

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
        return bgPathToVideoMetadata(filePath);
      } catch (error) {
        logger.error(`Error in getVideoMetadata for ${filePath}: ${error}`);
        throw error;
      }
    }
  );

  ipcMainHandle(
    "generateIcon",
    async (
      profile: string,
      id: string,
      filePath: string,
      webLink: string
    ): Promise<string[]> => {
      const savePath = path.join(getIconsFolderPath(profile), `${id}`);
      logger.info("savePath= ", savePath);
      return generateIcon(savePath, filePath, webLink);
    }
  );

  ipcMainHandle(
    "selectIconFromList",
    async (
      title: string,
      profile: string,
      images: string[],
      id: string,
      row: number,
      col: number
    ): Promise<string> => {
      const ret = await openSelectIconWindow(
        title,
        profile,
        images,
        id,
        row,
        col
      );
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
        try {
          const bgJson = await idToBgJson(id);

          if (!bgJson) {
            logger.error(`Failed to read bg.json for ${id}`);
            results.push({ id });
            continue;
          }

          // Resolve icon and bgFile paths manually (saves two file reads compared to idToIconPath/idToBgFilePath)
          const folderPath = await idToFolderPath(id);
          let iconPath = null;
          let bgFile = null;
          if (bgJson.public?.icon) {
            iconPath = path.join(folderPath, bgJson.public?.icon || "");
          } else {
            logger.warn(`No icon specified in bg.json for ${id}`);
          }
          if (bgJson.public?.bgFile) {
            bgFile = path.join(folderPath, bgJson.public?.bgFile || "");
          } else {
            logger.warn(`No bgFile specified in bg.json for ${id}`);
          }

          results.push({
            id,
            name: bgJson.public?.name,
            bgFile: bgFile || undefined,
            description: bgJson.public?.description,
            iconPath: iconPath || undefined,
            tags: (bgJson.public?.tags ?? []).filter((t: string) =>
              PUBLIC_TAGS_FLAT.includes(t)
            ),
            localProfile: bgJson.local?.profile,
            localTags: (bgJson.local?.tags ?? []).filter((t: string) =>
              (getSetting("localTags") as LocalTag[]).some(
                (tag) => tag.name === t
              )
            ),
            localIndexed: bgJson.local?.indexed,
            localVolume: bgJson.local?.volume,
          });
        } catch (e) {
          logger.error(`Failed to process background ${id}:`, e);
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

  ipcMainHandle(
    "resolveShortcut",
    async (filePath: string): Promise<string> => {
      try {
        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          logger.warn(`resolveShortcut: File does not exist: ${filePath}`);
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
  ipcMainHandle("getBgJson", async (id: string): Promise<BgJson | null> => {
    return await getBgJsonFile(id);
  });
  ipcMainHandle(
    "saveBgJson",
    async (summary: BackgroundSummary): Promise<boolean> => {
      return saveBgJsonFile(summary);
    }
  );
  ipcMainHandle("deleteBackground", async (id: string): Promise<boolean> => {
    try {
      if (!id) throw new Error("Missing background id");
      const bgDir = await idToFolderPath(id);

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
  ipcMainHandle("addLocalTag", async (tag: LocalTag): Promise<boolean> => {
    try {
      // Validate name: no spaces, must be lowercase, not in PUBLIC_TAGS or localTags
      if (!tag.name || typeof tag.name !== "string") {
        logger.warn("Invalid tag name:", tag.name);
        showSmallWindow(
          "Invalid Tag",
          "Tag name must be a non-empty string without spaces.",
          ["Okay"]
        );
        return false;
      }
      if (/\s/.test(tag.name)) {
        logger.warn("Tag name contains spaces:", tag.name);
        showSmallWindow("Invalid Tag", "Tag name cannot contain spaces.", [
          "Okay",
        ]);
        return false;
      }
      const name = tag.name.toLowerCase();

      // Check against PUBLIC_TAGS
      if (PUBLIC_TAGS_FLAT.map((t) => t.toLowerCase()).includes(name)) {
        logger.warn(`Attempted to add a public tag as a local tag: ${name}`);
        showSmallWindow(
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
        showSmallWindow(
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
      showSmallWindow(
        "Error Adding Tag",
        `An error occurred while adding the tag:\n ${e}`,
        ["Okay"]
      );
      return false;
    }
  });
  // TODO compare this to renameTag, this seems to allow renaming, but would not update the bg.jsons
  // of the backgrounds that have this tag.
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
  ipcMainHandle("getLocalCategories", async (): Promise<string[]> => {
    return getLocalCategories();
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
    async (options?: {
      newExternalPathAdded?: boolean;
    }): Promise<[number, number]> => {
      return await indexBackgrounds(options);
    }
  );
  ipcMainHandle(
    "changeBackgroundDirectory",
    async (id: string, targetLocation: string): Promise<string | null> => {
      return changeBackgroundDirectory(id, targetLocation);
    }
  );
  ipcMainHandle("getBaseFilePaths", async (name?: string): Promise<string> => {
    if (!name) {
      return getBasePath();
    }
    const normalizedName = name.toLowerCase().replace(/\s+/g, "");
    switch (normalizedName) {
      case "profilespath":
        return getProfilesPath();
      case "iconsfolderpath":
        return getIconsFolderPath((await getRendererState("profile")) || "");
      case "logsfolderpath":
        return getLogsFolderPath();
      case "settingsfilepath":
        return getSettingsFilePath();
      case "backgroundfilepath":
        return getBackgroundFilePath();
      case "backgroundsjsonfilepath":
        return getBackgroundsJsonFilePath();
    }
    logger.warn("getBaseFilePaths, returning empty due to name = " + name);
    return "";
  });
  ipcMainHandle("getProfiles", async (): Promise<string[]> => {
    return getProfiles();
  });
  ipcMainHandle("setRendererStates", (updates: Partial<RendererStates>) => {
    if (updates) {
      setRendererStates(updates);
      logger.info("renderer states updated:", JSON.stringify(updates));

      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("renderer-state-updated", updates);
      }
      return true;
    }
    return false;
  });
  ipcMainHandle("getRendererStates", (): Promise<RendererStates> => {
    return getRendererStates();
  });
  ipcMainHandle(
    "getInfoFromID",
    async <K extends InfoKey>(
      id: string,
      type: K
    ): Promise<IDInfo[K] | null> => {
      const handler = infoHandlers[type as keyof typeof infoHandlers];

      if (handler) {
        return (await handler(id)) as IDInfo[K];
      }
      logger.warn(`No handler found for type: ${type}`);

      return null;
    }
  );
  ipcMainHandle(
    "getInfoFromBgPath",
    async <K extends PathKey>(
      bgPath: string,
      type: K
    ): Promise<PathInfo[K] | null> => {
      bgPath = resolveShortcut(bgPath); // Ensure bgPath is not a shortcut (.lnk)
      const handler =
        bgPathToInfoHandlers[type as keyof typeof bgPathToInfoHandlers];

      if (handler) {
        return (await handler(bgPath)) as PathInfo[K];
      }
      logger.warn(`No handler found for type: ${type}`);

      return null;
    }
  );
  ipcMainHandle(
    "renameDataFolder",
    async (
      profile: string,
      oldFolder: string,
      newFolder: string
    ): Promise<boolean> => {
      try {
        const dataFolder = getIconsFolderPath(profile);
        const oldPath = path.join(dataFolder, oldFolder);
        const newPath = path.join(dataFolder, newFolder);

        if (!fs.existsSync(oldPath)) {
          logger.error(
            `renameDataFolder: Old folder does not exist: ${oldPath}`
          );
          return false;
        }
        if (fs.existsSync(newPath)) {
          logger.error(
            `renameDataFolder: New folder already exists: ${newPath}`
          );
          return false;
        }

        fs.renameSync(oldPath, newPath);
        logger.info(`Renamed data folder: ${oldPath} -> ${newPath}`);
        return true;
      } catch (error) {
        logger.error(`Failed to rename data folder: ${error}`);
        return false;
      }
    }
  );
  ipcMainHandle(
    "moveDesktopIcon",
    async (
      id: string,
      newRow: number,
      newCol: number,
      offsetReset?: boolean
    ): Promise<boolean> => {
      if (offsetReset) {
        return await moveDesktopIcon(id, newRow, newCol, offsetReset);
      }
      return await moveDesktopIcon(id, newRow, newCol);
    }
  );
  ipcMainHandle(
    "swapDesktopIcons",
    async (id1: string, id2: string): Promise<boolean> => {
      return await swapDesktopIcons(id1, id2);
    }
  );
  ipcMainHandle(
    "editIconOffsetUpdate",
    async (offsetX: number, offsetY: number): Promise<boolean> => {
      const subWindow = getActiveSubWindow();
      if (subWindow) {
        subWindow.webContents.send("edit-icon-offset-update", {
          offsetX,
          offsetY,
        });
        return true;
      }
      return false;
    }
  );
  ipcMainHandle("openDesktopProfile", async (): Promise<boolean> => {
    try {
      logger.info("called openDesktopProfile");
      openDesktopProfileWindow();
      return true;
    } catch (error) {
      logger.error(`Error opening settings window: ${error}`);
      return false;
    }
  });

  ipcMainHandle("importIconsFromDesktop", async (): Promise<boolean> => {
    logger.info("called importIconsFromDesktop");
    const profile = await getRendererState("profile");
    // Do not import if no profile returned from getRendererState
    if (!profile) {
      logger.error("No profile set in renderer state, cannot import icons.");
      showSmallWindow("Error Importing Icons", "No profile is set.", ["Okay"]);
      return false;
    }
    return await importIconsFromDesktop(mainWindow, profile);
  });
  ipcMainHandle(
    "getDesktopUniqueFiles",
    async (profile: string): Promise<desktopFile[]> => {
      return await getDesktopUniqueFiles(profile);
    }
  );
}
