// Default values for a DesktopIcon
export const DEFAULT_DESKTOP_ICON: DesktopIcon = {
  id: "",
  row: -1,
  col: -1,
  name: "",
  image: "",
  fontColor: "",
  launchDefault: "program",
};

// Utility function to get a default DesktopIcon with specific row and col
export function getDefaultDesktopIcon(
  id: string,
  row: number,
  col: number
): DesktopIcon {
  return {
    ...DEFAULT_DESKTOP_ICON,
    id,
    row,
    col,
  };
}
