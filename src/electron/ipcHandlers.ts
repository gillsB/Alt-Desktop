import fs from "fs";
import path from "path";
import { getAppDataPath } from "./appDataSetup.js";
import { DesktopIcon } from "./DesktopIcon.js";
import { ensureFileExists, ipcMainHandle, ipcMainOn } from "./util.js";

export function registerIpcHandlers(mainWindow: Electron.BrowserWindow) {
  ipcMainHandle("getDesktopIconData", async (): Promise<DesktopIconData> => {
    const directoryPath = path.join(getAppDataPath(), "desktop");
    const filePath = path.join(directoryPath, "desktopIcons.json");

    console.log("Resolved File Path:", filePath);

    try {
      // Read JSON file
      const data = fs.readFileSync(filePath, "utf-8");
      console.log("Read file contents:", data);
      const parsedData: DesktopIconData = JSON.parse(data);

      if (parsedData.icons) {
        parsedData.icons = parsedData.icons.map((icon) => {
          console.log(icon.image);
          return icon;
        });
      }

      return parsedData;
    } catch (error) {
      console.error("Error reading or creating JSON file:", error);
      return { icons: [] }; // Return default if error
    }
  });

  ipcMainOn("sendHeaderAction", (payload) => {
    switch (payload) {
      case "MINIMIZE":
        mainWindow.minimize();
        break;
      case "MAXIMIZE":
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case "CLOSE":
        mainWindow.close();
        break;
      case "SHOW_DEVTOOLS":
        mainWindow.webContents.openDevTools();
        break;
    }
  });

  ipcMainOn(
    "sendSubWindowAction",
    (payload: { action: "EDIT_ICON"; icon: DesktopIcon }) => {
      switch (payload.action) {
        case "EDIT_ICON":
          console.log(payload.icon);
          break;
      }
    }
  );

  ipcMainHandle(
    "ensureDataFolder",
    async (row: number, col: number): Promise<boolean> => {
      try {
        const basePath = getAppDataPath();
        const dataFolderPath = path.join(basePath, "data");
        const fullPath = path.join(dataFolderPath, `[${row},${col}]`);

        if (!fs.existsSync(fullPath)) {
          console.log(
            `Data folder [${row},${col}] does not exist, creating:`,
            fullPath
          );
          fs.mkdirSync(fullPath, { recursive: true });
          console.log(`Data folder [${row},${col}] created successfully.`);
        } else {
          console.log(`Data folder [${row},${col}] already exists:`, fullPath);
        }

        // Ensure Data file exists
        return ensureFileExists(fullPath, { icons: [] });
      } catch (error) {
        console.error(`Error ensuring Data folder [${row},${col}]:`, error);
        return false;
      }
    }
  );

  ipcMainHandle("setIconData", async (icon: DesktopIcon): Promise<boolean> => {
    try {
      const { row, col } = icon; // Extract row and col from the icon object
      const directoryPath = path.join(getAppDataPath(), "desktop");
      const filePath = path.join(directoryPath, "desktopIcons.json");

      console.log(`Updating icon at [${row},${col}] in ${filePath}`);
      let desktopData: DesktopIconData = { icons: [] };

      // Ensure file exists
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        desktopData = JSON.parse(data);
      }

      // Find existing icon or add new one
      const existingIndex = desktopData.icons.findIndex(
        (i) => i.row === row && i.col === col
      );

      if (existingIndex !== -1) {
        // Update existing icon
        desktopData.icons[existingIndex] = icon;
      } else {
        // Add new icon
        desktopData.icons.push(icon);
      }

      // Write back updated JSON
      fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2));

      console.log(`Successfully updated icon at [${row},${col}]`);
      return true;
    } catch (error) {
      console.error(`Error updating icon at [${icon.row},${icon.col}]:`, error);
      return false;
    }
  });
}
