import { useEffect } from "react";
import { applyThemeVars } from "../util/theme";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("useThemeListener.tsx");

export default function useThemeListener() {
  useEffect(() => {
    // initial load
    (async () => {
      try {
        const colors = await window.electron.getThemeColors();
        if (colors) applyThemeVars(colors);
      } catch (e) {
        logger.error("Failed to load initial theme colors:", e);
      }
    })();

    const handler = (...args: unknown[]) => {
      const colors = args[1] as Record<string, unknown> | undefined;
      if (colors && typeof colors === "object") applyThemeVars(colors);
    };

    window.electron.on("theme-updated", handler);
    return () => {
      window.electron.off("theme-updated", handler);
    };
  }, []);
}
