import { nativeTheme } from "electron";
import { createLoggerForFile } from "../logging.js";
import { getSetting } from "../settings.js";
import { showSmallWindow } from "../windows/subWindowManager.js";

const logger = createLoggerForFile("themeManager.ts");

const themes: Record<ThemeName, ThemeColors> = {
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
  system: {
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

let currentTheme: ThemeName = "dark";
let currentColors: ThemeColors = themes.dark;

export async function initializeThemeManager() {
  const theme = getSetting("theme") as ThemeName;
  const resolvedTheme = resolveThemeScheme(theme);
  currentTheme = resolvedTheme;
  currentColors = themes[resolvedTheme];
  logger.info(`Theme initialized: ${resolvedTheme}`);
  logger.info("current theme = " + currentTheme);
}

function resolveThemeScheme(theme: ThemeName): ThemeName {
  if (theme === "system") {
    try {
      const isDarkMode = nativeTheme.shouldUseDarkColors;
      theme = isDarkMode ? "dark" : "light";
      logger.info(`System theme detected: ${theme}`);
    } catch (error) {
      showSmallWindow(
        "Theme Detection Error",
        "Failed to detect system theme. Defaulting to dark mode.",
        ["OK"]
      );
      logger.warn(
        "Failed to detect system theme. Defaulting to dark mode. ",
        error
      );
      theme = "dark";
    }
  } else if (theme !== "dark" && theme !== "light") {
    logger.warn(`Unknown theme "${theme}" specified. Defaulting to dark mode.`);
    theme = "dark";
  }
  return theme;
}

export function getCurrentTheme(): ThemeName {
  return currentTheme;
}

export function getCurrentColors(): ThemeColors {
  return currentColors;
}

export function setTheme(theme: ThemeName): ThemeColors | null {
  theme = resolveThemeScheme(theme);
  currentTheme = theme;
  currentColors = themes[theme];
  //TODO save settings with new theme
  logger.info(`Theme changed to: ${theme}`);
  return currentColors;
}

export function updateThemeColor(
  colorKey: keyof ThemeColors,
  colorValue: string
) {
  currentColors[colorKey] = colorValue;
  logger.info(`Theme color updated: ${colorKey} = ${colorValue}`);
}
