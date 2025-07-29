import fs from "fs";
import mime from "mime-types";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { idToBackgroundFolder, idToBgJson, resolveShortcut } from "./util.js";

const logger = createLoggerForFile("util.ts");

/**
 * Gets the actual background file for an ID.
 * Supports external backgrounds.
 * @param id The ID of the background.
 * @returns Direct FilePath of the background ("bgFile")
 */
export const idToBackgroundPath = async (
  id: string
): Promise<string | null> => {
  try {
    const backgroundFolder = await idToBackgroundFolder(id);
    const bgJsonPath = await idToBgJson(id);
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

export const idToBackgroundType = async (
  id: string
): Promise<"image" | "video"> => {
  try {
    const path = await idToBackgroundPath(id);
    if (path) {
      const truePath = await resolveShortcut(path);
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
