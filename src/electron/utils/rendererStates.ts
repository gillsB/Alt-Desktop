import { createLoggerForFile } from "../logging.js";

const logger = createLoggerForFile("rendererStates.ts");

let rendererStates: RendererStates = {
  showVideoControls: false,
  testValue: "default",
};

export function getRendererStates(): RendererStates {
  return rendererStates;
}

export function setRendererStates(updates: Partial<RendererStates>) {
  rendererStates = { ...rendererStates, ...updates };
  logger.info("Renderer states updated:", JSON.stringify(rendererStates));
}
