import { protocol } from "electron";
import fs from "fs";
import path from "path";
import { URL } from "url";
import { createLoggerForFile } from "./logging.js";
import { getAssetPath } from "./pathResolver.js";
import { getAppDataPath, getMimeType, resolveShortcut } from "./utils/util.js";

const logger = createLoggerForFile("safeFileProtocol.ts");

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
      const hostname = requestedUrl.hostname;

      // Deliberate special case to return the fallback unknown.svg image.
      if (requestedUrl.pathname === "/unknown" || hostname === "unknown") {
        logger.info("Requested path is 'unknown', returning unknown image.");
        return getUnknownImageResponse();
      }

      let fullPath: string;

      // Check if this is a Windows drive path
      if (hostname && hostname.length === 1 && /^[a-zA-Z]$/.test(hostname)) {
        // This is a Windows absolute path
        // Reconstruct the full path and properly decode it
        const pathPart = decodeURIComponent(requestedUrl.pathname);
        fullPath = `${hostname}:${pathPart}`;
      } else {
        // Normal path handling for relative paths
        let relativePath = decodeURIComponent(requestedUrl.pathname);
        // Remove leading slash if present
        relativePath = relativePath.startsWith("/")
          ? relativePath.substring(1)
          : relativePath;

        // Resolve the full path relative to the AppData directory
        const appDataBasePath: string = path.join(getAppDataPath());
        fullPath = path.resolve(appDataBasePath, relativePath);
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
      return new Response(new Uint8Array(fileContent), {
        status: 200,
        headers: {
          "Content-Type": getMimeType(fullPath) || "application/octet-stream",
        },
      });
    } catch (error) {
      logger.error(`Error handling request: ${error}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  });

  logger.info(`Registered ${protocolName}:// protocol`);
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
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return `${protocolName}://${normalizedPath}`;
}

/**
 * Handles the case when a requested file doesn't exist.
 * Returns a fallback image path "src/assets/unknown.svg" if it's an image file; otherwise, returns a 404 error.
 * @param fullPath The full path of the requested file.
 * @returns The fallback response for a non-existent file.
 */
function fileNotExist(fullPath: string, reason?: string) {
  if (reason) {
    logger.warn(
      "Returning as: File not Found due to reason: ",
      reason,
      " fullPath:",
      fullPath
    );
  } else {
    logger.warn("File not found:", fullPath);
  }

  // Check if the requested file is an image based on the MIME type or fallback to unknown.svg
  const mimeType = getMimeType(fullPath);
  if (!mimeType || mimeType.startsWith("image/")) {
    return getUnknownImageResponse();
  } else {
    logger.error("File not found and not an image:", fullPath);
    return new Response("Not Found", { status: 404 });
  }
}

/**
 * Returns the fallback image "unknown.svg" as a Response with status 200.
 * @returns A Response containing the unknown.svg file.
 */
export function getUnknownImageResponse(): Response {
  const fallbackImagePath = path.join(getAssetPath(), "unknown.svg");
  try {
    const fileContent = fs.readFileSync(fallbackImagePath);
    return new Response(new Uint8Array(fileContent), {
      status: 200,
      headers: {
        "Content-Type":
          getMimeType(fallbackImagePath) || "application/octet-stream",
      },
    });
  } catch (error) {
    logger.error(`Failed to read unknown.svg: ${error}`);
    return new Response("Internal Server Error", { status: 500 });
  }
}
