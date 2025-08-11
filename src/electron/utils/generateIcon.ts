import { execSync, spawn } from "child_process";
import followRedirects from "follow-redirects";
import fs from "fs";
import os from "os";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { getScriptsPath } from "../pathResolver.js";
import { resolveShortcut } from "./util.js";

const logger = createLoggerForFile("generateIcon.ts");
type FileType = "exe" | "default";
const https = followRedirects.https;

export const generateIcon = async (
  savePath: string,
  programLink: string,
  webLink: string
): Promise<string[]> => {
  try {
    programLink = resolveShortcut(programLink);
    logger.info(`directory for save path: ${savePath} `);
    logger.info(`Extracting file icons for: ${programLink}, ${webLink}`);

    // Collect all found file paths
    const foundPaths: string[] = [];

    const targetDir = savePath;
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
    if (!fs.existsSync(programLink)) {
      logger.warn(`File does not exist: ${programLink}`);
      return foundPaths;
    }

    let fileType: FileType;
    const fileExtension = path.extname(programLink).toLowerCase();

    if (fileExtension === ".exe" || fileExtension === ".url") {
      fileType = "exe";
    } else {
      fileType = "default";
    }

    // Check for .ico files in the same folder as programLink and copy them to targetDir
    const folder = path.dirname(programLink);
    const icoFiles = fs
      .readdirSync(folder)
      .filter((f) => path.extname(f).toLowerCase() === ".ico");
    icoFiles.forEach((icoFile) => {
      const icoSource = path.join(folder, icoFile);
      logger.info(`Found .ico file ${icoSource}`);
      foundPaths.push(icoSource);
    });

    const iconSize = 256;
    const iconFileName = `${path.basename(programLink, path.extname(programLink))}.png`;
    const outputPath = path.join(targetDir, iconFileName);

    // Get Icon from python script.
    logger.info(`Falling back to executables for: ${programLink}`);

    return await new Promise<string[]>((resolve) => {
      let process;
      if (fileType === "exe") {
        logger.info(
          `running python for exe: ${programLink}, ${outputPath}, ${iconSize.toString()}`
        );
        process = spawn(path.join(getScriptsPath(), "exe_to_image.exe"), [
          programLink,
          outputPath,
          iconSize.toString(),
        ]);
      } else {
        logger.info(
          `running rust for default file: ${programLink}, ${outputPath}, ${iconSize.toString()}`
        );
        process = spawn(path.join(getScriptsPath(), "file_to_image.exe"), [
          programLink,
          outputPath,
          iconSize.toString(),
        ]);
      }

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
          foundPaths.push(iconFileName);
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
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_]/g, "");
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
    logger.info(faviconUrl);
    const fileName = `favicon_${sanitizedBaseName}.png`;
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
    // Fallback: try to get browser icon
    const browserIcon = await browserIconToImage(targetDir, size);
    if (browserIcon) {
      logger.info(`Returned browser icon as fallback: ${browserIcon}`);
      return browserIcon;
    }
    return null;
  }
}

async function browserIconToImage(
  targetDir: string,
  iconSize: number = 256
): Promise<string | null> {
  const browserPath = getDefaultBrowserPath();
  if (!browserPath) return null;

  const iconFileName = `browser_icon.png`;
  const outputPath = path.join(targetDir, iconFileName);

  const executablePath = path.join(getScriptsPath(), "exe_to_image.exe");
  return await new Promise<string | null>((resolve) => {
    const process = spawn(executablePath, [
      browserPath,
      outputPath,
      iconSize.toString(),
    ]);

    process.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        logger.info(`Browser icon extracted and saved to: ${outputPath}`);
        resolve(outputPath);
      } else {
        logger.warn(`Failed to extract browser icon`);
        resolve(null);
      }
    });
  });
}

function getDefaultBrowserPath(): string | null {
  if (os.platform() !== "win32") return null;
  try {
    // Get ProgId for http
    const progId = execSync(
      `reg query "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId`
    )
      .toString()
      .match(/ProgId\s+REG_SZ\s+([^\s]+)/)?.[1];
    if (!progId) return null;

    // Get command for ProgId
    const command = execSync(
      `reg query "HKCR\\${progId}\\shell\\open\\command" /ve`
    )
      .toString()
      .match(/REG_SZ\s+([^\r\n]+)/)?.[1];
    if (!command) return null;

    // Extract path in quotes
    const match = command.match(/"([^"]+)"/);
    return match ? match[1] : null;
  } catch (e) {
    logger.warn("Could not determine default browser: " + e);
    return null;
  }
}
