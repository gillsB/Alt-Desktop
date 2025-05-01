import { protocol } from "electron";
import fs from "fs";
import mime from "mime-types";
import { URL } from "url";
import { createLoggerForFile } from "./logging.js";

const logger = createLoggerForFile("videoFileProtocol.ts");

/**
 * Registers a custom protocol specifically for video files
 * that allows access to files from their full path while
 * implementing security checks.
 *
 * @param protocolName The name of the protocol (e.g., 'video-file' for video-file://)
 */
export function registerVideoFileProtocol(protocolName: string = "video-file") {
  protocol.handle(protocolName, async (req) => {
    try {
      const requestedUrl = new URL(req.url);
      logger.info(
        `Parsed URL - hostname: "${requestedUrl.hostname}", pathname: "${requestedUrl.pathname}"`
      );

      // Decode the URL and normalize the path
      let decodedPath = decodeURIComponent(requestedUrl.pathname);

      // Handle Windows paths with drive letters
      if (process.platform === "win32") {
        if (requestedUrl.hostname) {
          const driveLetter = decodeURIComponent(requestedUrl.hostname); // e.g., "C"
          decodedPath = `${driveLetter}:${decodedPath}`;
        }
        decodedPath = decodedPath.replace(/\//g, "\\"); // Convert forward slashes to backslashes
      }

      logger.info(`Final resolved path: "${decodedPath}"`);

      // Security check: File must exist
      if (!fs.existsSync(decodedPath)) {
        logger.warn(`Video file not found: "${decodedPath}"`);
        return new Response("Not Found", { status: 404 });
      }

      // Security check: File must be readable
      try {
        fs.accessSync(decodedPath, fs.constants.R_OK);
      } catch (error) {
        logger.warn(
          `No read permission for video file: "${decodedPath}", ${error}`
        );
        return new Response("Forbidden: No read permission", { status: 403 });
      }

      // Stream the file
      const fileStream = fs.createReadStream(decodedPath);

      // Handle stream errors
      fileStream.on("error", (err) => {
        logger.error(`Error reading file stream: ${err.message}`);
      });

      logger.info(`Successfully streaming video file: "${decodedPath}"`);

      // Return the video file with appropriate MIME type
      const contentType = mime.lookup(decodedPath) || "video/mp4";
      return new Response(fileStream as unknown as ReadableStream, {
        status: 200,
        headers: {
          "Content-Type": contentType,
        },
      });
    } catch (error) {
      logger.error(`Error handling video request: ${error}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  });

  logger.info(`Registered ${protocolName}:// protocol for video files`);
}

/**
 * Converts a full file path to a video file URL
 * @param filePath Full path to the video file
 * @param protocolName The protocol name (should match what was registered)
 * @returns A URL string using the video file protocol
 */
export function getVideoFileUrl(
  filePath: string,
  protocolName: string = "video-file"
): string {
  logger.info(`Converting file path to URL: "${filePath}"`);
  let result = "";

  if (process.platform === "win32") {
    // For Windows paths with drive letters (e.g., C:/path)
    const match = filePath.match(/^([a-zA-Z]:)([\\/].*)$/);
    if (match) {
      const [, driveLetter, pathPart] = match;
      // Use the drive letter WITHOUT the colon as the hostname
      // Make sure the path starts with a slash
      let normalizedPath = pathPart.replace(/\\/g, "/");
      if (!normalizedPath.startsWith("/")) {
        normalizedPath = "/" + normalizedPath;
      }
      // FIXED: Remove the colon from the hostname part
      result = `${protocolName}://${driveLetter}${normalizedPath}`;
      logger.info(`Converted Windows path with drive letter to: "${result}"`);
      return result;
    }
  }

  // For non-Windows paths or Windows paths without drive letters
  let normalizedPath = filePath.replace(/\\/g, "/");

  // Ensure the path starts with a slash
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = "/" + normalizedPath;
  }

  // Return the formatted video file URL
  result = `${protocolName}://${normalizedPath}`;
  logger.info(`Converted path to: "${result}"`);
  return result;
}
