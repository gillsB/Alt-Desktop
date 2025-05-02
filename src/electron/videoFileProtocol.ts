import { protocol } from "electron";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { URL } from "url";
import { createLoggerForFile } from "./logging.js";

const logger = createLoggerForFile("videoFileProtocol.ts");

// Cache to store open file handles
const fileHandleCache = new Map();

// Performance metrics
const performanceMetrics = {
  totalRequests: 0,
  rangeRequests: 0,
  fullRequests: 0,
  errors: 0,
  bytesSent: 0,
  requestDurations: [] as number[],
};

// Set higher buffer sizes for better performance with high framerate videos
const DEFAULT_BUFFER_SIZE = 2 * 1024 * 1024; // 2MB buffer (doubled from original)

/**
 * Registers a custom protocol specifically for video files
 * that allows access to files from their full path
 *
 * @param protocolName The name of the protocol (e.g., 'video-file' for video-file://)
 * @param options Configuration options for the protocol handler
 */
export function registerVideoFileProtocol(
  protocolName: string = "video-file",
  options = {
    bufferSize: DEFAULT_BUFFER_SIZE,
    logPerformance: true,
    cacheMaxAge: 3600, // 1 hour
    handleMaxAge: 5 * 60 * 1000, // 5 minutes
  }
) {
  // Clean up any stale file handles when registering
  cleanupFileHandles();

  // Set up periodic performance logging if enabled
  if (options.logPerformance) {
    setInterval(() => {
      // Only log metrics if there were valid video requests
      if (performanceMetrics.totalRequests > 0) {
        const avgDuration =
          performanceMetrics.requestDurations.length > 0
            ? performanceMetrics.requestDurations.reduce(
                (sum, duration) => sum + duration,
                0
              ) / performanceMetrics.requestDurations.length
            : 0;

        logger.info(
          "Video protocol performance metrics:",
          JSON.stringify({
            totalRequests: performanceMetrics.totalRequests,
            rangeRequests: performanceMetrics.rangeRequests,
            fullRequests: performanceMetrics.fullRequests,
            errors: performanceMetrics.errors,
            bytesSent: formatBytes(performanceMetrics.bytesSent),
            avgResponseTime: `${avgDuration.toFixed(2)}ms`,
            activeHandles: fileHandleCache.size,
          })
        );

        // Reset metrics after logging
        performanceMetrics.requestDurations = [];
      }
    }, 60000); // Log every minute
  }

  protocol.handle(protocolName, async (req) => {
    const requestStartTime = Date.now();
    performanceMetrics.totalRequests++;

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
        performanceMetrics.errors++;
        return new Response("Not Found", { status: 404 });
      }

      // Security check: File must be a valid video type
      const ext = path.extname(decodedPath).toLowerCase();
      const allowedExtensions = [".mp4", ".webm", ".mov", ".ogg"];
      if (!allowedExtensions.includes(ext)) {
        logger.warn(`Blocked non-video file request: "${decodedPath}"`);
        performanceMetrics.errors++;
        return new Response("Forbidden: Only video files are allowed", {
          status: 403,
        });
      }

      // Security check: File must be readable
      try {
        fs.accessSync(decodedPath, fs.constants.R_OK);
      } catch (error) {
        logger.warn(
          `No read permission for video file: "${decodedPath}", ${error}`
        );
        performanceMetrics.errors++;
        return new Response("Forbidden: No read permission", { status: 403 });
      }

      // Get file info
      const stat = fs.statSync(decodedPath);
      const fileSize = stat.size;

      // Get content type based on file extension
      let contentType = mime.lookup(ext) || "video/mp4";

      // Ensure proper content type for common video formats
      if (ext === ".mp4" || ext === ".m4v") contentType = "video/mp4";
      if (ext === ".webm") contentType = "video/webm";
      if (ext === ".mov") contentType = "video/quicktime";

      // Handle range requests
      const rangeHeader = req.headers.get("Range");

      // Add common headers for both range and non-range requests
      const commonHeaders = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": `public, max-age=${options.cacheMaxAge}`,
        Connection: "keep-alive",
        // Add additional headers to help with video streaming
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      };

      if (rangeHeader) {
        performanceMetrics.rangeRequests++;
        const ranges = parseRangeHeader(rangeHeader, fileSize);

        if (!ranges || ranges.length === 0) {
          // Invalid range request
          performanceMetrics.errors++;
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: {
              ...commonHeaders,
              "Content-Range": `bytes */${fileSize}`,
            },
          });
        }

        // We'll handle the first range only for simplicity
        const { start, end } = ranges[0];
        const chunkSize = end - start + 1;
        performanceMetrics.bytesSent += chunkSize;

        logger.info(`Serving range request: bytes=${start}-${end}/${fileSize}`);

        // Use high water mark for better buffering
        const stream = fs.createReadStream(decodedPath, {
          start,
          end,
          highWaterMark: options.bufferSize,
        });

        // Add to cache for potential cleanup later
        const cacheKey = `${decodedPath}-${start}-${end}`;
        fileHandleCache.set(cacheKey, { stream, timestamp: Date.now() });

        // Clean up on stream close
        stream.on("close", () => {
          fileHandleCache.delete(cacheKey);
        });

        // Handle stream errors
        stream.on("error", (err) => {
          logger.error(`Error reading file stream range: ${err.message}`);
          performanceMetrics.errors++;
          fileHandleCache.delete(cacheKey);
        });

        const response = new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            ...commonHeaders,
            "Content-Length": chunkSize.toString(),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          },
        });

        // Record metrics
        performanceMetrics.requestDurations.push(Date.now() - requestStartTime);
        return response;
      } else {
        // Non-range request - serve the entire file
        performanceMetrics.fullRequests++;
        performanceMetrics.bytesSent += fileSize;

        logger.info(`Serving full file: ${fileSize} bytes`);

        // Use high water mark for better buffering
        const fileStream = fs.createReadStream(decodedPath, {
          highWaterMark: options.bufferSize,
        });

        // Add to cache for potential cleanup later
        const cacheKey = `${decodedPath}-full`;
        fileHandleCache.set(cacheKey, {
          stream: fileStream,
          timestamp: Date.now(),
        });

        // Clean up on stream close
        fileStream.on("close", () => {
          fileHandleCache.delete(cacheKey);
        });

        // Handle stream errors
        fileStream.on("error", (err) => {
          logger.error(`Error reading file stream: ${err.message}`);
          performanceMetrics.errors++;
          fileHandleCache.delete(cacheKey);
        });

        const response = new Response(fileStream as unknown as ReadableStream, {
          status: 200,
          headers: {
            ...commonHeaders,
            "Content-Length": fileSize.toString(),
          },
        });

        // Record metrics
        performanceMetrics.requestDurations.push(Date.now() - requestStartTime);
        return response;
      }
    } catch (error) {
      logger.error(`Error handling video request: ${error}`);
      performanceMetrics.errors++;
      return new Response("Internal Server Error", { status: 500 });
    }
  });

  // Clean up file handles periodically
  const cleanupInterval = setInterval(
    () => cleanupFileHandles(false, options.handleMaxAge),
    60000
  ); // Every minute

  // Clean up on app exit
  process.on("exit", () => {
    clearInterval(cleanupInterval);
    cleanupFileHandles(true); // Force close all handles
  });

  logger.info(
    `Registered ${protocolName}:// protocol for video files with range support, file handle management, and ${formatBytes(options.bufferSize)} buffer size`
  );
}

/**
 * Cleans up stale file handles to prevent resource leaks
 * @param forceAll If true, closes all file handles regardless of age
 * @param maxAge Maximum age in milliseconds before a handle is considered stale
 */
function cleanupFileHandles(forceAll = false, maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  let closedCount = 0;

  for (const [key, { stream, timestamp }] of fileHandleCache.entries()) {
    if (forceAll || now - timestamp > maxAge) {
      try {
        stream.destroy();
        fileHandleCache.delete(key);
        closedCount++;
      } catch (error) {
        logger.error(`Error closing file handle: ${error}`);
        fileHandleCache.delete(key);
      }
    }
  }

  if (closedCount > 0) {
    logger.info(`Closed ${closedCount} stale file handles`);
  }
}

/**
 * Parse the range header to extract start and end bytes
 * @param rangeHeader The HTTP Range header value (e.g., "bytes=0-1023")
 * @param fileSize The total size of the file in bytes
 * @returns Array of range objects with start and end positions, or null if invalid
 */
function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number }[] | null {
  // Parse the range header (e.g., "bytes=0-1023,2048-4095")
  const matches = rangeHeader.match(/bytes=([0-9]*-[0-9]*(,[0-9]*-[0-9]*)*)/);

  if (!matches) {
    logger.warn(`Invalid range header format: ${rangeHeader}`);
    return null;
  }

  const rangesStr = matches[1].split(",");
  const ranges: { start: number; end: number }[] = [];

  for (const range of rangesStr) {
    const [startStr, endStr] = range.split("-");

    let start = startStr ? parseInt(startStr, 10) : 0;
    let end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    // Handle special case where range is like "bytes=-500" (last 500 bytes)
    if (startStr === "" && endStr) {
      start = Math.max(0, fileSize - parseInt(endStr, 10));
      end = fileSize - 1;
    }

    // Validate range
    if (
      isNaN(start) ||
      isNaN(end) ||
      start < 0 ||
      end >= fileSize ||
      start > end
    ) {
      logger.warn(
        `Invalid range values: start=${start}, end=${end}, fileSize=${fileSize}`
      );
      return null;
    }

    ranges.push({ start, end });
  }

  return ranges.length > 0 ? ranges : null;
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

/**
 * Format bytes to human readable string
 * @param bytes Number of bytes
 * @returns Human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
