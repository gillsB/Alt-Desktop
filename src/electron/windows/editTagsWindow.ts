import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";
import { createLoggerForFile } from "../logging.js";
import { getPreloadPath, getUIPath } from "../pathResolver.js";
import {
  getMainWindow,
  isDev,
  subWindowDevtoolsEnabled,
} from "../utils/util.js";
import { getActiveSubWindow } from "../windows/subWindowManager.js";

const logger = createLoggerForFile("editTagsWindow.ts");

export let editTagsWindows: CustomBrowserWindow[] = [];

export function openEditTagsWindow() {
  const activeSubWindow = getActiveSubWindow();
  const mainWindow = getMainWindow();
  const options = {
    width: 600,
    height: 500,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    backgroundColor: "#00000000",
    parent: activeSubWindow ?? mainWindow ?? undefined, // Prefer parent to be sub window if possible.
    show: false,
    skipTaskbar: true,
    modal: false,
    title: "Edit Tags",
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: true,
    },
  };

  // Create a new window (not singleton)
  const editTagsWindow = new BrowserWindow(options) as CustomBrowserWindow;
  editTagsWindow.customTitle = "Edit Tags";
  editTagsWindows.push(editTagsWindow);

  let editTagsUrl: string;
  if (isDev()) {
    editTagsUrl = `http://localhost:5123/#/edit-tags`;
    editTagsWindow.loadURL(editTagsUrl);
  } else {
    editTagsUrl = pathToFileURL(getUIPath()).toString() + "#/edit-tags";
    editTagsWindow.loadFile(getUIPath(), { hash: "edit-tags" });
  }

  editTagsWindow.once("ready-to-show", () => {
    editTagsWindow.show();
    if (isDev() && subWindowDevtoolsEnabled()) {
      editTagsWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  editTagsWindow.on("closed", () => {
    editTagsWindows = editTagsWindows.filter((w) => w !== editTagsWindow);
  });

  logger.info(`Created Edit Tags window with URL: ${editTagsUrl}`);

  return editTagsWindow;
}
