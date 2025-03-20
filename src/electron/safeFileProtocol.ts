import { protocol, shell } from "electron";
import fs from "fs";
import path from "path";
import { URL } from "url";
import { getAppDataPath } from "./filesetup.js";

/**
 * Resolves a Windows shortcut (.lnk) to its actual target path.
 * @param filePath The path to the .lnk file
 * @returns The resolved target path or the original path if not a shortcut
 */
function resolveShortcut(filePath: string): string {
  if (process.platform === "win32" && filePath.endsWith(".lnk")) {
    try {
      const shortcut = shell.readShortcutLink(filePath);
      return shortcut.target;
    } catch (error) {
      console.error("Failed to resolve shortcut:", error);
      return filePath; // Fall back to original path if resolution fails
    }
  }
  return filePath;
}

/**
 * Registers a custom protocol that safely serves files only from the AppData directory,
 * resolving .lnk shortcuts if encountered.
 * @param protocolName The name of the protocol (e.g., 'appdata-file' for appdata-file://)
 */
export function registerSafeFileProtocol(
  protocolName: string = "appdata-file"
) {
  protocol.registerFileProtocol(protocolName, (request, callback) => {
    try {
      // Parse the URL
      const url = new URL(request.url);

      // Remove leading slash and decode the pathname
      const requestedPath = decodeURIComponent(url.pathname).replace(/^\//, "");

      // Get the base AppData path
      const appDataBasePath = path.join(getAppDataPath());

      // Resolve the full path, ensuring it stays within the AppData directory
      let fullPath = path.resolve(appDataBasePath, requestedPath);

      // Security check: Ensure the requested path is within the AppData directory
      if (!fullPath.startsWith(appDataBasePath)) {
        console.error(
          "Security violation: Attempted to access file outside AppData directory:",
          fullPath
        );
        return callback({ error: 403 }); // Forbidden
      }

      // Resolve .lnk files if applicable
      fullPath = resolveShortcut(fullPath);

      // Check if the resolved file exists
      if (!fs.existsSync(fullPath)) {
        console.error("File not found:", fullPath);
        return callback({ error: 404 }); // Not Found
      }

      // Return the resolved file path
      return callback({ path: fullPath });
    } catch (error) {
      console.error("Error in safe file protocol:", error);
      return callback({ error: 500 }); // Internal Server Error
    }
  });

  console.log(`Registered ${protocolName}:// protocol`);
}

/**
 * Converts a relative path to a safe file URL
 * @param relativePath Path relative to the AppData directory
 * @param protocolName The protocol name (should match what was registered)
 * @returns A URL string using the safe file protocol
 */
export function getSafeFileUrl(
  relativePath: string,
  protocolName: string = "appdata-file"
): string {
  // Normalize path separators and ensure no leading slash
  const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\//, "");
  return `${protocolName}://${normalizedPath}`;
}
