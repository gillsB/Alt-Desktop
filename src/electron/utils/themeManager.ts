import { createLoggerForFile } from "../logging.js";

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
  const theme = "dark"; //TODO make this load from settings
  if (theme && (theme === "dark" || theme === "light")) {
    currentTheme = theme as ThemeName;
    currentColors = themes[currentTheme];
    logger.info(`Theme initialized: ${currentTheme}`);
  }
}

export function getCurrentTheme(): ThemeName {
  return currentTheme;
}

export function getCurrentColors(): ThemeColors {
  return currentColors;
}

export function setTheme(theme: ThemeName): ThemeColors | null {
  if (theme !== "dark" && theme !== "light") {
    logger.warn(`Invalid theme: ${theme}`);
    return null;
  }

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
