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

const logger = createLoggerForFile("idToInfo.ts");

/**
 * Gets the path of the bg.json file for an ID.
 * Supports external backgrounds.
 */
export const idToBgJsonPath = async (id: string) => {
  const backgroundFolder = await idToFolderPath(id);
  return path.join(backgroundFolder, "bg.json");
};

/**
 * Gets the BgJson type (from bg.json) for an ID.
 * @param id
 * @returns BgJson typed object or null if not found.
 */
export const idToBgJson = async (id: string): Promise<BgJson | null> => {
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
    // Return bj.json if it exists, else null
    return bg;
  } catch (e) {
    logger.error(`Failed to get background volume for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the background folder path for an ID. (contains bg.json, icon, background/lnk file)
 * Supports external backgrounds with id format ext::<num>::<folder>
 */
export const idToFolderPath = async (id: string) => {
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
 * Gets the type of the Background for an ID.
 * Supports external backgrounds and Resolves shortcuts.
 * @param id ID of background OR "" for current background
 * @returns File type of the background, either "image" or "video".
 */
export const idToBackgroundFileType = async (
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
 * Gets the background name for an ID.
 * @param id
 * @returns name of the background or null if not found.
 */
export const idToBackgroundName = async (
  id: string
): Promise<string | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (!bgJson || !bgJson.public || !bgJson.public.name) {
      logger.warn(`No name found in bg.json for id: ${id}`);
      return null;
    }
    return bgJson.public.name;
  } catch (e) {
    logger.error(`Failed to get name for id ${id}:`, e);
    return null;
  }
};

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
    const bgJson = await idToBgJson(id);
    let basePath = "";
    let truePath = "";

    if (!bgJson || !bgJson.public || !bgJson.public.icon) {
      logger.warn(`No icon path found in bg.json for id: ${id}`);
      return null;
    }
    const backgroundFolder = await idToFolderPath(id);
    if (bgJson.public && bgJson.public.bgFile) {
      basePath = path.join(backgroundFolder, bgJson.public.bgFile);
      if (basePath) {
        truePath = resolveShortcut(basePath);
        if (truePath) {
          return truePath;
        }
      }
    }
    logger.warn(
      `Could not resolve background path: ${id}, basePath: ${basePath}, truePath: ${truePath}`
    );
    return null;
  } catch (e) {
    logger.warn(`Failed to resolve filePath for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the full icon path for an ID.
 * @param id
 * @returns Full path for the icon or null if not found.
 */
export const idToIconPath = async (id: string): Promise<string | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (!bgJson || !bgJson.public || !bgJson.public.icon) {
      logger.warn(`No icon path found in bg.json for id: ${id}`);
      return null;
    }
    const iconPath = bgJson.public.icon;
    const backgroundFolder = await idToFolderPath(id);

    return path.join(backgroundFolder, iconPath);
  } catch (e) {
    logger.error(`Failed to get icon path for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the description for an ID.
 * @param id
 * @returns Description or null if not found.
 */
export const idToDescription = async (id: string): Promise<string | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (!bgJson || !bgJson.public || !bgJson.public.description) {
      logger.warn(`No description found in bg.json for id: ${id}`);
      return null;
    }
    return bgJson.public.description;
  } catch (e) {
    logger.error(`Failed to get description for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the public tags for an ID.
 * @param id
 * @returns Public tags array or null if not found.
 */
export const idToTags = async (id: string): Promise<string[] | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (!bgJson || !bgJson.public || !bgJson.public.tags) {
      logger.warn(`No tags found in bg.json for id: ${id}`);
      return null;
    }
    return bgJson.public.tags;
  } catch (e) {
    logger.error(`Failed to get tags for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the background volume for an ID.
 * @param id
 * @returns number | null - Volume level (0-100) or null if not set.
 */
export const idToBackgroundVolume = async (
  id: string
): Promise<number | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (
      !bgJson ||
      !bgJson.local ||
      typeof bgJson.local.volume !== "number" ||
      isNaN(bgJson.local.volume)
    ) {
      logger.warn(`No local volume found in bg.json for id: ${id}`);
      return null;
    }
    return bgJson.local.volume;
  } catch (e) {
    logger.error(`Failed to get local volume for id ${id}:`, e);
    return null;
  }
};

/**
 * Gets the local tags for an ID.
 * @param id
 * @returns Local tags array or null if not found.
 */
export const idToLocalTags = async (id: string): Promise<string[] | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (!bgJson || !bgJson.local || !bgJson.local.tags) {
      logger.warn(`No local tags found in bg.json for id: ${id}`);
      return null;
    }
    return bgJson.local.tags;
  } catch (e) {
    logger.error(`Failed to get local tags for id ${id}:`, e);
    return null;
  }
};
/**
 * Gets the local indexed time for an ID.
 * @param id
 * @returns Local indexed time or null if not found.
 */
export const idToIndexed = async (id: string): Promise<number | null> => {
  try {
    const bgJson = await idToBgJson(id);
    if (!bgJson || !bgJson.local || !bgJson.local.indexed) {
      logger.warn(`No local indexed time found in bg.json for id: ${id}`);
      return null;
    }
    return bgJson.local.indexed;
  } catch (e) {
    logger.error(`Failed to get local indexed time for id ${id}:`, e);
    return null;
  }
};
