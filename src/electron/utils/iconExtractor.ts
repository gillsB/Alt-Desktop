import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { getAppDataPath } from "../util.js";

const execFilePromise = util.promisify(execFile);

export async function extractIcon(filePath: string): Promise<string | null> {
  const fileName = `${path.basename(filePath, path.extname(filePath))}`;
  const outputPath = path.join(getAppDataPath(), `${fileName}.png`);

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    // Use different extraction methods based on platform
    if (process.platform === "win32") {
      return await extractIconWindows(filePath, outputPath);
    } else {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
  } catch (error) {
    console.error("Error extracting icon:", error);
    return null;
  }
}

async function extractIconWindows(
  filePath: string,
  outputPath: string
): Promise<string | null> {
  const psScript = `
    Add-Type -AssemblyName System.Drawing
    
    # Get the associated icon
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${filePath.replace(/'/g, "''")}')
    
    # Get the largest size
    $bestSize = $icon.Height
    
    # If icon has multiple sizes, find the largest one
    if ($icon.GetType().GetProperty('GetFrameCount')) {
      $sizes = $icon.GetFrameCount([System.Drawing.Icon+IconDimension]::Both)
      $bestSize = 0
      $bestBitmap = $null
      
      for ($i = 0; $i -lt $sizes; $i++) {
        $frameIcon = $icon.GetFrameByIndex($i)
        if ($frameIcon.Height -gt $bestSize) {
          $bestSize = $frameIcon.Height
          $bestBitmap = $frameIcon.ToBitmap()
        }
      }
      
      if ($bestBitmap) {
        $bestBitmap.Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
      } else {
        $icon.ToBitmap().Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
      }
    } else {
      # Only one size available
      $icon.ToBitmap().Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
    }
  `;

  await execFilePromise("powershell", ["-Command", psScript]);

  // Verify the file was created
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }
  return null;
}
