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
    // Get the current background ID from settings
    const bgId = getSetting("background") as string;
    if (!bgId) return "default";
    const bgJson = await idToBgJson(bgId);
    if (bgJson && bgJson.local && bgJson.local.profile) {
      logger.info("Initializing renderer profile to:", bgJson.local.profile);
      rendererStates.profile = bgJson.local.profile;
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
    updates.profile = "default";
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
    return rendererStates[key];
  } else {
    logger.warn(`Renderer state key "${key}" does not exist.`);
    throw new Error(`Renderer state key "${key}" does not exist.`);
  }
}
