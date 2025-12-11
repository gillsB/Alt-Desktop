import { createLoggerForFile } from "../logging.js";
import { getSetting } from "../settings.js";
import { idToBgJson } from "./idToInfo.js";
import { ensureProfileFolder } from "./util.js";

const logger = createLoggerForFile("rendererStates.ts");

let rendererStates: RendererStates = {
  showVideoControls: false,
  hideIcons: false,
  hideIconNames: false,
  profile: "default", // will be updated below
};
// Fetch saved background's profile to update "profile" state before renderers use it.
// So when renderers are created they have the correct profile from the start. (prevents default profile flicker)
export async function initializeRendererStatesProfile() {
  try {
    const bgId = getSetting("background") as string;
    if (!bgId) {
      logger.warn("No background ID found, defaulting to 'default' profile.");
      return;
    }

    const bgJson = await idToBgJson(bgId);
    if (bgJson && bgJson.local && bgJson.local.profile) {
      logger.info("Initializing renderer profile to:", bgJson.local.profile);
      rendererStates.profile = bgJson.local.profile;
    } else {
      logger.warn(
        "Background JSON or profile not found, defaulting to 'default' profile."
      );
    }
  } catch (e) {
    logger.error(
      `Failed to get default profile from background (setting to "default"): ${e}`
    );
  }
}

export async function getRendererStates(): Promise<RendererStates> {
  return rendererStates;
}
export function setRendererStates(updates: Partial<RendererStates>) {
  if (updates.profile === "") {
    updates.profile = (getSetting("noBgDesktopProfile") as string) || "default";
  }
  rendererStates = { ...rendererStates, ...updates };
  logger.info("Renderer states updated:", JSON.stringify(rendererStates));
  // Ensure profile actually exists
  if (updates.profile) {
    ensureProfileFolder(updates.profile);
  }
}

export async function getRendererState<T extends keyof RendererStates>(
  key: T
): Promise<RendererStates[T]> {
  if (key in rendererStates) {
    logger.info(
      `Getting renderer state for key "${key}":`,
      rendererStates[key]
    );
    return rendererStates[key];
  } else {
    logger.warn(`Renderer state key "${key}" does not exist.`);
    throw new Error(`Renderer state key "${key}" does not exist.`);
  }
}
