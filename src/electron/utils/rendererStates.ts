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
