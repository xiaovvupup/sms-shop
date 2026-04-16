type LogLevel = "INFO" | "WARN" | "ERROR";

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ?? {})
  };
  if (level === "ERROR") {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(payload));
    return;
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write("INFO", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("WARN", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    write("ERROR", message, context)
};
