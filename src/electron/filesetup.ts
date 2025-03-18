import fs from "fs";
import path from "path";

export const getAppDataPath = (): string => {
  const appDataPath = process.env.APPDATA;
  if (!appDataPath) {
    throw new Error("APPDATA environment variable is not set.");
  }
  return path.join(appDataPath, "AltDesktop");
};

const ensureFileExists = (filePath: string, defaultData: object) => {
  if (!fs.existsSync(filePath)) {
    console.log("File does not exist, creating:", filePath);
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf-8");
    console.log("File created successfully.");
  } else {
    console.log("File already exists:", filePath);
  }
};

export const ensureAppDataFiles = () => {
  try {
    const basePath = getAppDataPath();
    const desktopPath = path.join(basePath, "desktop");
    const iconsFolderPath = path.join(basePath, "icons");
    const desktopIconsFilePath = path.join(desktopPath, "desktopIcons.json");

    // Ensure directories exist
    if (!fs.existsSync(desktopPath)) {
      console.log("Directory does not exist, creating:", desktopPath);
      fs.mkdirSync(desktopPath, { recursive: true });
      console.log("Directory created successfully.");
    } else {
      console.log("Directory already exists:", desktopPath);
    }

    if (!fs.existsSync(iconsFolderPath)) {
      console.log("Icons folder does not exist, creating:", iconsFolderPath);
      fs.mkdirSync(iconsFolderPath, { recursive: true });
      console.log("Icons folder created successfully.");
    } else {
      console.log("Icons folder already exists:", iconsFolderPath);
    }

    // Ensure desktopIcons.json exists
    ensureFileExists(desktopIconsFilePath, { icons: [] });
  } catch (error) {
    console.error("Error ensuring AppData files:", error);
  }
};
