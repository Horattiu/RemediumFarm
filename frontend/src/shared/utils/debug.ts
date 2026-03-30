const DEBUG_LOGS_FALLBACK = false; // pune true temporar pentru debug rapid

export const DEBUG_LOGS =
  String(import.meta.env.VITE_DEBUG_LOGS ?? String(DEBUG_LOGS_FALLBACK)).toLowerCase() === "true";

export const debugLog = (...args: unknown[]): void => {
  if (!DEBUG_LOGS) return;
  console.log(...args);
};

export const debugWarn = (...args: unknown[]): void => {
  if (!DEBUG_LOGS) return;
  console.warn(...args);
};
