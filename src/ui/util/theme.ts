export function applyThemeVars(themeColors: unknown) {
  const root = document.documentElement;
  if (!themeColors || typeof themeColors !== "object") return;
  Object.entries(themeColors as Record<string, unknown>).forEach(([k, v]) => {
    // transform key 'bgPrimary' -> '--color-bgPrimary'
    if (v == null) return;
    root.style.setProperty(`--color-${k}`, String(v));
  });
}

export async function initTheme() {
  try {
    const themeColors = await window.electron.getThemeColors();
    if (themeColors) {
      applyThemeVars(themeColors);
    }
  } catch (err) {
    console.warn("Failed to load theme colors:", err);
  }
}
