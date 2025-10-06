import { createLoggerForFile } from "../logging.js";
import { ensureProfileFolder } from "./util.js";

const logger = createLoggerForFile("rendererStates.ts");

let rendererStates: RendererStates = {
  showVideoControls: false,
  hideIcons: false,
  hideIconNames: false,
  profile: "default",
};

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
