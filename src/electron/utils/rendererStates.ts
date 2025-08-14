import { createLoggerForFile } from "../logging.js";

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
  rendererStates = { ...rendererStates, ...updates };
  logger.info("Renderer states updated:", JSON.stringify(rendererStates));
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
