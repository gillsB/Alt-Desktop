import fs from "fs";
import mime from "mime-types";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { getSetting } from "../settings.js";
import {
  getBackgroundFilePath,
  getExternalPath,
  resolveShortcut,
} from "./util.js";

const logger = createLoggerForFile("util.ts");

/**
 * Gets the actual background file path for an ID.
 * Supports external backgrounds and Resolves shortcuts.
 * @param id The ID of the background.
 * @returns Direct FilePath of the background ("bgFile")
 */
export const idToBackgroundPath = async (
  id: string
): Promise<string | null> => {
  try {
    const backgroundFolder = await idToBackgroundFolder(id);
    const bgJsonPath = await idToBgJsonPath(id);
    if (!fs.existsSync(bgJsonPath)) {
      logger.warn(`bg.json not found at ${bgJsonPath}`);
      return null;
    }
    const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
    const bg = JSON.parse(rawBg);
    if (bg.public && bg.public.bgFile) {
      return path.join(backgroundFolder, bg.public.bgFile);
    }
    return null;
  } catch (e) {
    logger.warn(`Failed to resolve filePath for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the type of the Background for an ID.
 * Supports external backgrounds and Resolves shortcuts.
 * @param id ID of background OR "" for current background
 * @returns File type of the background, either "image" or "video".
 */
export const idToBackgroundType = async (
  id: string
): Promise<"image" | "video"> => {
  try {
    if (id === "") {
      id = getSetting("background") as string;
    }
    const path = await idToBackgroundPath(id);
    if (path) {
      const truePath = resolveShortcut(path);
      if (!truePath) {
        logger.warn(`No valid path found for background id: ${id}`);
        return "image";
      }
      const fileType = mime.lookup(truePath) || "";
      if (fileType.startsWith("video")) {
        return "video";
      }
    }
    return "image";
  } catch (e) {
    logger.error(`Failed to get background type for id ${id}:`, e);
    return "image"; // Default to image on error
  }
};

/**
 * Gets the background folder path for an ID.
 * Supports external backgrounds with id format ext::<num>::<folder>
 */
export const idToBackgroundFolder = async (id: string) => {
  const extMatch = id.match(/^ext::(\d+)::(.+)$/);
  if (extMatch) {
    const extIndex = Number(extMatch[1]);
    const folder = extMatch[2];
    const extBase = await getExternalPath(extIndex);
    if (extBase) {
      return path.join(extBase, folder);
    }
  }
  const baseDir = getBackgroundFilePath();
  const folderPath = id.includes("/") ? path.join(...id.split("/")) : id;
  return path.join(baseDir, folderPath);
};

/**
 * Gets the path of the bg.json file for an ID.
 * Supports external backgrounds.
 */
export const idToBgJsonPath = async (id: string) => {
  const backgroundFolder = await idToBackgroundFolder(id);
  return path.join(backgroundFolder, "bg.json");
};

export const idToBackgroundVolume = async (
  id: string
): Promise<number | null> => {
  try {
    if (id === "") {
      id = getSetting("background") as string;
    }
    const bgJsonPath = await idToBgJsonPath(id);
    if (!fs.existsSync(bgJsonPath)) {
      logger.warn(`bg.json not found for background id: ${id}`);
      return null;
    }
    const raw = await fs.promises.readFile(bgJsonPath, "utf-8");
    const bg: BgJson = JSON.parse(raw);
    // Return local.volume if it exists, else null
    return bg?.local?.volume ?? null;
  } catch (e) {
    logger.error(`Failed to get background volume for id ${id}:`, e);
    return null;
  }
};
export const idToBackgroundName = async (
  id: string
): Promise<string | null> => {
  try {
    if (id === "") {
      id = getSetting("background") as string;
    }
    const bgJsonPath = await idToBgJsonPath(id);
    if (!fs.existsSync(bgJsonPath)) {
      logger.warn(`bg.json not found for background id: ${id}`);
      return null;
    }
    const raw = await fs.promises.readFile(bgJsonPath, "utf-8");
    const bg: BgJson = JSON.parse(raw);
    // Return local.volume if it exists, else null
    return bg?.public?.name ?? null;
  } catch (e) {
    logger.error(`Failed to get background volume for id ${id}:`, e);
    return null;
  }
};
