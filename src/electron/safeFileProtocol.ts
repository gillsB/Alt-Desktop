import { protocol } from "electron";
import fs from "fs";
import path from "path";
import { URL } from "url";
import { getAppDataPath } from "./filesetup.js";

/**
 * Registers a custom protocol that safely serves files only from the AppData directory
 * @param protocolName The name of the protocol (e.g., 'appdata-file' for appdata-file://)
 */
export function registerSafeFileProtocol(
  protocolName: string = "appdata-file"
) {
  // Register the protocol
  protocol.registerFileProtocol(protocolName, (request, callback) => {
    try {
      // Parse the URL
      const url = new URL(request.url);

      // Remove leading slash and decode the pathname
      const requestedPath = decodeURIComponent(url.pathname).replace(/^\//, "");

      // Get the base AppData path
      const appDataBasePath = path.join(getAppDataPath());

      // Resolve the full path, ensuring it stays within the AppData directory
      const fullPath = path.resolve(appDataBasePath, requestedPath);

      // Security check: Ensure the requested path is within the AppData directory
      if (!fullPath.startsWith(appDataBasePath)) {
        console.error(
          "Security violation: Attempted to access file outside AppData directory:",
          fullPath
        );
        return callback({ error: 403 }); // Forbidden
      }

      // Check if the file exists
      if (!fs.existsSync(fullPath)) {
        console.error("File not found:", fullPath);
        return callback({ error: 404 }); // Not Found
      }

      // Return the file
      return callback({ path: fullPath });
    } catch (error) {
      console.error("Error in safe file protocol:", error);
      return callback({ error: 500 }); // Internal Server Error
    }
  });

  console.log(`Registered ${protocolName}:// protocol for safe file access`);
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
