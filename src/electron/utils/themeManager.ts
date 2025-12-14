import { BrowserWindow, nativeTheme } from "electron";
import { createLoggerForFile } from "../logging.js";
import { getSetting } from "../settings.js";

// BinaryTheme used for dark/light themes only
// Contrast with global type ThemeName which also includes the "system" option
// Reason for this is Settings can set it to "system", but actual applied theme is always dark or light
type BinaryTheme = "dark" | "light";

const logger = createLoggerForFile("themeManager.ts");

const themes: Record<BinaryTheme, ThemeColors> = {
  dark: {
    primary: "#007bff",
    primaryHover: "#0056b3",
    primaryActive: "#003d82",

    bgPrimary: "#232323",
    bgSecondary: "#2c2c2c",
    bgTertiary: "#1a1a1a",
    bgHover: "#323232",

    textPrimary: "#ffffff",
    textSecondary: "#b0b0b0",
    textTertiary: "#808080",

    borderPrimary: "#292929",
    borderSecondary: "#3a3a3a",

    success: "#28a745",
    warning: "#ffc107",
    error: "#dc3545",
    info: "#17a2b8",

    highlightGreen: "#4caf50",
    highlightYellow: "#d29922",
  },
  light: {
    primary: "#0056b3",
    primaryHover: "#003d82",
    primaryActive: "#002454",

    bgPrimary: "#f5f5f5",
    bgSecondary: "#ffffff",
    bgTertiary: "#eeeeee",
    bgHover: "#e8e8e8",

    textPrimary: "#1a1a1a",
    textSecondary: "#555555",
    textTertiary: "#999999",

    borderPrimary: "#d0d0d0",
    borderSecondary: "#e0e0e0",

    success: "#28a745",
    warning: "#ff9800",
    error: "#dc3545",
    info: "#17a2b8",

    highlightGreen: "#4caf50",
    highlightYellow: "#f9a825",
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
