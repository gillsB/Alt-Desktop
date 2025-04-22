import { createLogger } from "./uiLogger";

const logger = createLogger("rendererUtil.ts");

/**
 * Displays a small window with a title, message, and buttons.
 *
 * @param {string} title - The title of the small window.
 * @param {string} message - The message to display in the small window.
 * @param {string[]} buttons - The buttons to display in the small window.
 * @returns {Promise<string>} A promise that resolves with the button text clicked by the user.
 */
export async function showSmallWindow(
  title: string,
  message: string,
  buttons: string[] = ["Okay"]
): Promise<string> {
  try {
    const result = await window.electron.showSmallWindow(
      title,
      message,
      buttons
    );
    return result;
  } catch (error) {
    logger.error("Failed to show small window:", error);
    return "Error";
  }
}
