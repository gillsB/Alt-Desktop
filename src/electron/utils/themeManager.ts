import { BrowserWindow, nativeTheme } from "electron";
import { createLoggerForFile } from "../logging.js";
import { getSetting } from "../settings.js";

// BinaryTheme used for dark/light themes only
// Contrast with global type ThemeName which also includes the "system" option
// Reason for this is Settings can set it to "system", but actual applied theme is always dark or light
type BinaryTheme = "dark" | "light";

const logger = createLoggerForFile("themeManager.ts");

const themes: Record<BinaryTheme, ThemeColors> = {
  // Any edits in these require hard restart of program (vite doesn't reload .ts)
  dark: {
    primary: "0, 123, 255", // #007bff
    primaryLight: "51, 153, 255", // #3399ff
    primaryHover: "0, 86, 179", // #0056b3
    primaryDark: "0, 75, 160", // #004ba0
    primaryGray: "91, 120, 153", // #5b7899

    header: "26, 26, 26", // #1a1a1a"

    bgPrimary: "35, 35, 35", // #232323
    bgSecondary: "44, 44, 44", // #2c2c2c
    bgTertiary: "26, 26, 26", // #1a1a1a
    bgHover: "50 50 50", // #323232

    textArea: "18, 18, 18", // #121212
    textPrimary: "255, 255, 255", // #ffffff
    textSecondary: "176, 176, 176", // #b0b0b0
    textTertiary: "128, 128, 128", // #808080
    textButton: "255, 255, 255", // #ffffff

    borderPrimary: "41, 41, 41", // #292929
    borderSecondary: "224, 224, 224", // #e0e0e0

    success: "54, 209, 90", // #36d15a
    warning: "255, 193, 7", // #ffc107
    error: "220, 53, 69", // #dc3545
    info: "23, 162, 184", // #17a2b8

    highlightBox: "255, 0, 0", // #ff0000
    highlightOffset: "255, 87, 34", // #ff5722
    highlightOversized: "190, 137, 0", // #be8900
    highlightOffsetOversized: "158, 23, 13", // #9e170d
    highlightHover: "76, 175, 80", // #4caf50
    highlightSwap: "255, 255, 0", // #ffff00

    shadow: "0, 0, 0", // #000000
  },
  light: {
    primary: "0, 123, 255", // #007bff
    primaryLight: "51, 153, 255", // #3399ff
    primaryHover: "0, 86, 179", // #0056b3
    primaryDark: "0, 75, 160", // #004ba0
    primaryGray: "91, 120, 153", // #5b7899

    header: "238, 238, 238", // #eeeeee

    bgPrimary: "245, 245, 245", // #f5f5f5
    bgSecondary: "255, 255, 255", // #ffffff
    bgTertiary: "238, 238, 238", // #eeeeee
    bgHover: "232, 232, 232", // #e8e8e8

    textArea: "226, 226, 226", // #e2e2e2
    textPrimary: "26, 26, 26", // #1a1a1a
    textSecondary: "85, 85, 85", // #555555
    textTertiary: "153, 153, 153", // #999999
    textButton: "255, 255, 255", // #ffffff

    borderPrimary: "208, 208, 208", // #d0d0d0
    borderSecondary: "224, 224, 224", // #e0e0e0

    success: "54, 209, 90", // #36d15a
    warning: "255, 152, 0", // #ff9800
    error: "220, 53, 69", // #dc3545
    info: "23, 162, 184", // #17a2b8

    highlightBox: "255, 0, 0", // #ff0000
    highlightOffset: "255, 87, 34", // #ff5722
    highlightOversized: "190, 137, 0", // #be8900
    highlightOffsetOversized: "158, 23, 13", // #9e170d
    highlightHover: "76, 175, 80", // #4caf50
    highlightSwap: "249, 168, 37", // #f9a825

    shadow: "0, 0, 0", // #000000
  },
};

let currentPreference: ThemeName = "system";
let currentTheme: BinaryTheme = "dark";
let currentColors: ThemeColors = themes[currentTheme];

function getSystemTheme(): BinaryTheme {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function broadcastThemeUpdate() {
  const colors = getCurrentColors();
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("theme-updated", colors);
    } catch (err) {
      logger.warn("Failed to send theme-updated to a window:", err);
    }
  }
}

export async function initializeThemeManager() {
  const saved = (await getSetting("theme")) as ThemeName | undefined;
  currentPreference = saved ?? "system";
  currentTheme =
    currentPreference === "system" ? getSystemTheme() : currentPreference;
  currentColors = themes[currentTheme];
  logger.info(
    `Theme initialized: preference=${currentPreference}, resolved=${currentTheme}`
  );

  // Listen for OS theme changes only if preference === "system"
  nativeTheme.on("updated", () => {
    if (currentPreference === "system") {
      currentTheme = getSystemTheme();
      currentColors = themes[currentTheme];
      logger.info(`System theme changed, applying: ${currentTheme}`);
      broadcastThemeUpdate();
    }
  });
}

export function getCurrentTheme(): BinaryTheme {
  return currentTheme;
}

export function getCurrentColors(): ThemeColors {
  return currentColors;
}

export function setTheme(pref: ThemeName): ThemeColors | null {
  if (pref !== "system" && pref !== "dark" && pref !== "light") {
    logger.warn(`Invalid theme preference: ${pref}`);
    return null;
  }

  currentPreference = pref;
  currentTheme = pref === "system" ? getSystemTheme() : pref;
  currentColors = themes[currentTheme];

  logger.info(`Theme preference set: ${pref} -> resolved ${currentTheme}`);
  broadcastThemeUpdate();
  return currentColors;
}

export function updateThemeColor(
  colorKey: keyof ThemeColors,
  colorValue: string
) {
  currentColors[colorKey] = colorValue;
  logger.info(`Theme color updated: ${colorKey} = ${colorValue}`);
  broadcastThemeUpdate();
}
