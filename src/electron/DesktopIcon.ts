// Default values for a DesktopIcon
export const DEFAULT_DESKTOP_ICON: DesktopIcon = {
  row: -1,
  col: -1,
  name: "",
  image: "",
  fontColor: "white",
  launchDefault: "program",
};

// Utility function to get a default DesktopIcon with specific row and col
export function getDefaultDesktopIcon(row: number, col: number): DesktopIcon {
  return {
    ...DEFAULT_DESKTOP_ICON,
    row,
    col,
  };
}
