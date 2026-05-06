interface LogEntry {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

const MAX_LOGS = 500;

class Logger {
  private logs: LogEntry[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.logs = [];
    this.info('Logger initialized');
  }

  info(message: string, data?: unknown): void {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.addLog('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.addLog('error', message, data);
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  private addLog(level: LogEntry['level'], message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    if (data !== undefined) {
      entry.data = data;
    }
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }
  }
}

export const logger = new Logger();
