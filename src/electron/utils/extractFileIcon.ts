import { spawn } from "child_process";
import followRedirects from "follow-redirects";
import fs from "fs";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { getScriptsPath } from "../pathResolver.js";
import { getAppDataPath, resolveShortcut } from "../util.js";

const logger = createLoggerForFile("extractFileIcon.ts");
type FileType = "exe" | "default";
const https = followRedirects.https;

export const extractFileIcon = async (
  filePath: string,
  webLink: string
): Promise<string[]> => {
  try {
    filePath = resolveShortcut(filePath);
    logger.info(`Extracting file icon for: ${filePath}, ${webLink}`);

    // Collect all found file paths
    const foundPaths: string[] = [];

    const targetDir = getAppDataPath();
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (webLink) {
      if (!/^https?:\/\//i.test(webLink)) {
        webLink = `https://${webLink}`;
        logger.info(`Formatted website link to: ${webLink}`);
      }
      const faviconPath = await fetchAndSaveFavicon(webLink, targetDir);
      if (faviconPath) foundPaths.push(faviconPath);
    }

    // Verify that the file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`File does not exist: ${filePath}`);
      return foundPaths;
    }

    let fileType: FileType;
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === ".exe") {
      fileType = "exe";
    } else {
      fileType = "default";
    }

    // Check for .ico files in the same folder as filePath and copy them to targetDir
    const folder = path.dirname(filePath);
    const icoFiles = fs
      .readdirSync(folder)
      .filter((f) => path.extname(f).toLowerCase() === ".ico");
    icoFiles.forEach((icoFile) => {
      const icoSource = path.join(folder, icoFile);
      const icoTarget = path.join(targetDir, icoFile);
      fs.copyFileSync(icoSource, icoTarget);
      logger.info(`Copied .ico file from ${icoSource} to ${icoTarget}`);
      foundPaths.push(icoTarget);
    });

    const iconSize = 256;
    const iconFileName = `${path.basename(filePath, path.extname(filePath))}.png`;
    const outputPath = path.join(targetDir, iconFileName);

    // Get Icon from python script.
    logger.info(`Falling back to Python executable for: ${filePath}`);
    const executablePath = path.join(getScriptsPath(), "file_to_image.exe");

    return await new Promise<string[]>((resolve) => {
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
          foundPaths.push(outputPath);
        } else {
          logger.warn(`Executable failed with code ${code}`);
        }
        resolve(foundPaths);
      });
    });
  } catch (error) {
    logger.error(`Error during icon extraction: ${error}`);
    return [];
  }
};

async function fetchAndSaveFavicon(
  url: string,
  targetDir: string,
  size: number = 256
): Promise<string | null> {
  try {
    const { hostname } = new URL(url);
    const baseName = hostname.replace(/^www\./, "").replace(/\./g, "_");
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
    logger.info(faviconUrl);
    const fileName = `favicon_${baseName}.png`;
    const savePath = path.join(targetDir, fileName);

    await new Promise<void>((resolve, reject) => {
      https
        .get(faviconUrl, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to get favicon: ${res.statusCode}`));
            return;
          }
          const fileStream = fs.createWriteStream(savePath);
          res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });
          fileStream.on("error", reject);
        })
        .on("error", reject);
    });

    logger.info(`Favicon downloaded from Google API: ${savePath}`);
    return savePath;
  } catch (err) {
    logger.warn(`Failed to download favicon from Google API: ${err}`);
    return null;
  }
}
