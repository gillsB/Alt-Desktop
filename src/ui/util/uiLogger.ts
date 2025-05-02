export const createLogger = (file: string) => {
  // Define allowed log levels explicitly
  type LogLevel = "log" | "info" | "warn" | "error" | "debug";

  const logToConsole = (level: LogLevel, ...args: unknown[]) => {
    const prefix = `[${file}]`;

    if (args.length === 1) {
      console[level](prefix, args[0]); // Log single object properly
    } else {
      console[level](prefix, ...args); // Spread multiple arguments
    }
  };

  return {
    info: (...args: unknown[]) => {
      logToConsole("info", ...args);
      window.electron.logMessage("info", file, JSON.stringify(args));
    },
    warn: (...args: unknown[]) => {
      logToConsole("warn", ...args);
      window.electron.logMessage("warn", file, JSON.stringify(args));
    },
    error: (...args: unknown[]) => {
      logToConsole("error", ...args);
      window.electron.logMessage("error", file, JSON.stringify(args));
    },
    debug: (...args: unknown[]) => {
      logToConsole("debug", ...args);
      window.electron.logMessage("debug", file, JSON.stringify(args));
    },
  };
};

export const createVideoLogger = (file: string) => {
  // Define allowed log levels explicitly
  type LogLevel = "log" | "info" | "warn" | "error" | "debug";

  const logToConsole = (level: LogLevel, ...args: unknown[]) => {
    const prefix = `[${file}]`;

    if (args.length === 1) {
      console[level](prefix, args[0]); // Log single object properly
    } else {
      console[level](prefix, ...args); // Spread multiple arguments
    }
  };

  return {
    info: (...args: unknown[]) => {
      logToConsole("info", ...args);
      window.electron.logVideoMessage("info", file, JSON.stringify(args));
    },
    warn: (...args: unknown[]) => {
      logToConsole("warn", ...args);
      window.electron.logVideoMessage("warn", file, JSON.stringify(args));
    },
    error: (...args: unknown[]) => {
      logToConsole("error", ...args);
      window.electron.logVideoMessage("error", file, JSON.stringify(args));
    },
    debug: (...args: unknown[]) => {
      logToConsole("debug", ...args);
      window.electron.logVideoMessage("debug", file, JSON.stringify(args));
    },
  };
};
