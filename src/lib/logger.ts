/**
 * Structured logger for critical events — production observability.
 * Logs are kept in a circular buffer and accessible via window.__sarelliLogs()
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
}

const MAX_BUFFER = 200;
const buffer: LogEntry[] = [];

function push(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    data,
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const prefix = `[Sarelli:${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, event, data ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, event, data ?? '');
  } else {
    console.log(prefix, event, data ?? '');
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => push('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => push('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => push('error', event, data),

  /** Get all buffered logs (for debugging in production via console) */
  getAll: (): readonly LogEntry[] => [...buffer],
};

// Expose globally for production debugging
if (typeof window !== 'undefined') {
  (window as any).__sarelliLogs = () => logger.getAll();
}
