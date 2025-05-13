import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { getScriptsPath } from "../pathResolver.js";
import { getAppDataPath, resolveShortcut } from "../util.js";

const logger = createLoggerForFile("extractFileIcon.ts");
type FileType = "exe" | "default";

export const extractFileIcon = async (
  filePath: string
): Promise<string | null> => {
  try {
    filePath = resolveShortcut(filePath);
    logger.info(`Extracting file icon for: ${filePath}`);

    // Verify that the file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`File does not exist: ${filePath}`);
      return null;
    }

    let fileType: FileType;
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === ".exe") {
      fileType = "exe";
    } else {
      fileType = "default";
    }

    const targetDir = getAppDataPath();
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const folder = path.dirname(filePath);
    const icoFiles = fs
      .readdirSync(folder)
      .filter((f) => path.extname(f).toLowerCase() === ".ico");
    if (icoFiles.length > 0) {
      const icoSource = path.join(folder, icoFiles[0]);
      const icoTarget = path.join(targetDir, icoFiles[0]);
      fs.copyFileSync(icoSource, icoTarget);
      logger.info(`Copied .ico file from ${icoSource} to ${icoTarget}`);
    }

    const iconSize = 256;
    const iconFileName = `${path.basename(filePath, path.extname(filePath))}.png`;
    const outputPath = path.join(targetDir, iconFileName);

    // Get Icon from python script.
    logger.info(`Falling back to Python executable for: ${filePath}`);
    const executablePath = path.join(getScriptsPath(), "file_to_image.exe");

    return await new Promise<string | null>((resolve) => {
      logger.info(
        `Args for exec: ${fileType}, ${filePath}, ${outputPath}, ${iconSize.toString()}`
      );
      const process = spawn(executablePath, [
        fileType,
        filePath,
        outputPath,
        iconSize.toString(),
      ]);

      process.stdout.on("data", (data) => {
        logger.info(`Executable stdout: ${data.toString().trim()}`);
      });

      process.stderr.on("data", (data) => {
        logger.error(`Executable stderr: ${data.toString().trim()}`);
      });

      process.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          logger.info(
            `Icon successfully extracted and saved to: ${outputPath}`
          );
          resolve(outputPath);
        } else {
          logger.warn(`Executable failed with code ${code}`);
          resolve(null);
        }
      });
    });
  } catch (error) {
    logger.error(`Error during icon extraction: ${error}`);
    return null;
  }
};
