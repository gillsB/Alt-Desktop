import { protocol, shell } from "electron";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { URL } from "url";
import { getAppDataPath } from "./filesetup.js";
import { getAssetPath } from "./pathResolver.js";

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
  protocol.handle(protocolName, async (req) => {
    try {
      const requestedUrl = new URL(req.url);
      const requestedPath = decodeURIComponent(requestedUrl.pathname).replace(
        /^\//,
        ""
      );

      const appDataBasePath = path.join(getAppDataPath());

      // Resolve the full path, ensuring it stays within the AppData directory
      let fullPath = path.resolve(appDataBasePath, requestedPath);

      // Security check: Ensure the requested path is within the AppData directory
      if (!fullPath.startsWith(appDataBasePath)) {
        console.error(
          "Security violation: Attempted to access file outside AppData directory:",
          fullPath
        );
        return new Response("Forbidden", { status: 403 });
      }

      // Resolve .lnk files if applicable
      fullPath = resolveShortcut(fullPath);

      // Check if the resolved file exists
      if (!fs.existsSync(fullPath)) {
        // File does not exist, use handler.
        return fileNotExist(fullPath);
      }

      // Read the file content for existing files
      const fileContent = fs.readFileSync(fullPath);
      return new Response(fileContent, {
        status: 200,
        headers: {
          "Content-Type": mime.lookup(fullPath) || "application/octet-stream",
        },
      });
    } catch (error) {
      console.error("Error in safe file protocol:", error);
      return new Response("Internal Server Error", { status: 500 });
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

/**
 * Handles the case when a requested file doesn't exist.
 * Returns a fallback image path "src/assets/unknown.png" if it's an image file; otherwise, returns a 404 error.
 * @param fullPath The full path of the requested file.
 * @returns The fallback response for a non-existent file.
 */
function fileNotExist(fullPath: string) {
  const mimeType = mime.lookup(fullPath);

  // Check if the requested file is an image
  if (mimeType && mimeType.startsWith("image/")) {
    console.error("File not found:", fullPath);
    console.error("Returning unknown.png instead.");

    const fallbackImagePath = path.join(getAssetPath(), "unknown.png");

    // Read the fallback image and return as a Response
    const fileContent = fs.readFileSync(fallbackImagePath);
    return new Response(fileContent, {
      status: 200,
      headers: {
        "Content-Type":
          mime.lookup(fallbackImagePath) || "application/octet-stream",
      },
    });
  } else {
    console.error("File not found:", fullPath);
    return new Response("Not Found", { status: 404 });
  }
}
