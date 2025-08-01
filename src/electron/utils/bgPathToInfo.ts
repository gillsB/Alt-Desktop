import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { createLoggerForFile } from "../logging.js";

const logger = createLoggerForFile("bgPathToInfo.ts");

export const bgPathToVideoMetadata = async (
  filePath: string
): Promise<VideoMetadata> => {
  try {
    logger.info(`Retrieving video metadata for: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      logger.error(`File does not exist: ${filePath}`);
      throw new Error(`File does not exist: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error(`Error retrieving video metadata: ${err.message}`);
          reject(err);
        } else {
          logger.info(`Retrieved video metadata for ${filePath}`);
          const formattedMetadata: VideoMetadata = {
            format: {
              filename: metadata.format.filename || "",
              duration: metadata.format.duration || 0,
              size: metadata.format.size || 0,
              bit_rate: metadata.format.bit_rate || 0,
              format_name: metadata.format.format_name || "",
              format_long_name: metadata.format.format_long_name || "",
            },
            streams: metadata.streams.map((stream) => ({
              codec_name: stream.codec_name || "",
              codec_type: stream.codec_type as "video" | "audio",
              codec_tag_string: stream.codec_tag_string || "", // Include codec tag string
              codec_tag: stream.codec_tag || "", // Include codec tag
              width: stream.width,
              height: stream.height,
              duration: stream.duration
                ? parseFloat(stream.duration)
                : undefined, // Parse duration as a number
              bit_rate: stream.bit_rate
                ? parseInt(stream.bit_rate, 10)
                : undefined, // Parse bit_rate as a number
              sample_rate: stream.sample_rate,
              channels: stream.channels,
            })),
          };
          resolve(formattedMetadata);
        }
      });
    });
  } catch (error) {
    logger.error(`Error in getVideoMetadata for ${filePath}: ${error}`);
    throw error;
  }
};
