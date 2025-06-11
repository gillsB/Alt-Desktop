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
/**
 *
 * @param p - The path to check.
 * @returns {boolean} - True if the path is absolute, false otherwise.
 */
export function isAbsolutePath(p: string) {
  // Windows absolute: starts with X:\ or X:/, or UNC \\server\share
  if (/^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p)) return true;
  // Unix absolute: starts with /
  if (p.startsWith("/")) return true;
  return false;
}

/**
 *
 * @param filePath full file path or partial path
 * @returns file name (not full file path) without extensions.
 */
export function fileNameNoExt(filePath: string) {
  const fileName = filePath.split(/[\\/]/).pop() || "";
  return fileName.replace(/\.[^/.]+$/, "");
}

export function parseAdvancedSearch(search: string) {
  const addTags: string[] = [];
  const removeTags: string[] = [];
  const searchTerms: string[] = [];

  // Split by spaces
  const parts = search.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (const part of parts) {
    if (part.startsWith("-tag:")) {
      removeTags.push(part.slice(5));
    } else if (part.startsWith("tag:")) {
      addTags.push(part.slice(4));
    } else {
      searchTerms.push(part);
    }
  }

  return {
    addTags,
    removeTags,
    searchTerms,
  };
}
