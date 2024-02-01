import util from 'util';
import { EOL } from 'os';

export const LOG_LEVEL_NONE = 0;
export const LOG_LEVEL_ERROR = 1;
export const LOG_LEVEL_WARN = 2;
export const LOG_LEVEL_INFO = 3;
export const LOG_LEVEL_DEBUG = 4;

export type LOG_LEVEL = typeof LOG_LEVEL_NONE | typeof LOG_LEVEL_ERROR | typeof LOG_LEVEL_INFO | typeof LOG_LEVEL_WARN | typeof LOG_LEVEL_DEBUG;
type EPOCH_MS = number;
export type LOG_FORMATTER = (ts: EPOCH_MS, name: string, scope: string, level: LOG_LEVEL, data?: unknown) => string;
export type DEFAULT_FORMAT = {
  t: number;
  l: LOG_LEVEL;
  s: string;
  n: string;
  d?: unknown;
  e?: Error;
};

type TARGET = 'err' | 'out';

type BUF_RECORD = {
  target: TARGET;
  data: string;
};

export class Logger {
  protected scope: string;
  protected logLevel: LOG_LEVEL;
  protected logDebug: boolean;
  protected logInfo: boolean;
  protected logWarn: boolean;
  protected logError: boolean;
  protected depth = 2;
  protected logLevelsMap = {
    [LOG_LEVEL_NONE]: '',
    [LOG_LEVEL_ERROR]: 'ERROR',
    [LOG_LEVEL_INFO]: 'INFO',
    [LOG_LEVEL_WARN]: 'WARN',
    [LOG_LEVEL_DEBUG]: 'DEBUG',
  };
  protected formatter: LOG_FORMATTER;
  protected static stdout: NodeJS.WritableStream;
  protected static stderr: NodeJS.WritableStream;
  protected static buffer: Record<TARGET, BUF_RECORD[]> = {
    'err': [],
    'out': [],
  };
  protected static bufferHeighWatermark = 100000;
  protected static isBackpressure: Record<TARGET, boolean> = {
    'err': false,
    'out': false,
  };

  constructor(logLevel: LOG_LEVEL = LOG_LEVEL_NONE, scope: string = '') {
    this.scope = scope;
    this.logLevel = logLevel;
    this.logError = logLevel >= LOG_LEVEL_ERROR;
    this.logWarn = logLevel >= LOG_LEVEL_WARN;
    this.logInfo = logLevel >= LOG_LEVEL_INFO;
    this.logDebug = logLevel >= LOG_LEVEL_DEBUG;
    this.formatter = this.defaultFormatter.bind(this);
  }

  static replaceLogStreams(stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): void {
    Logger.stdout = stdout;
    Logger.stderr = stderr;
  }

  static setBufferHeighWatermark(mark: number): void {
    Logger.bufferHeighWatermark = mark;
  }

  static getIsBackpressure(target: TARGET): boolean {
    return Logger.isBackpressure[target] === true;
  }

  static getBufferSize(): number {
    return Logger.buffer.err.length + Logger.buffer.out.length;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }

  setFormatter(formatter: LOG_FORMATTER): this {
    this.formatter = formatter;
    return this;
  }

  setScope(scope: string): this {
    this.scope = scope;
    return this;
  }

  clone(scope: string): Logger {
    return new Logger(this.logLevel, scope)
      .setDepth(this.depth)
      .setFormatter(this.formatter);
  }

  debug(name: string, data?: unknown): boolean {
    return this.logDebug && this.pushLog({ data: this.format(name, LOG_LEVEL_DEBUG, data), target: 'out' });
  }

  log(name: string, data?: unknown): boolean {
    return this.logInfo && this.pushLog({ data: this.format(name, LOG_LEVEL_INFO, data), target: 'out' });
  }

  warn(name: string, data?: unknown): boolean {
    return this.logWarn && this.pushLog({ data: this.format(name, LOG_LEVEL_WARN, data), target: 'out' });
  }

  error(name: string, data: Error): boolean {
    return this.logError && this.pushLog({ data: this.format(name, LOG_LEVEL_ERROR, data), target: 'err' });
  }

  protected pushLog(entry: BUF_RECORD): boolean {
    const len = Logger.getBufferSize();
    const isSpace = len < Logger.bufferHeighWatermark;
    if (!isSpace) {
      return false;
    }
    Logger.buffer[entry.target].push(entry);
    Logger.restart();
    return true;
  }

  protected static restart(): void {
    Logger.write(Logger.buffer.err, 'err');
    Logger.write(Logger.buffer.out, 'out');
  }

  protected static write(buffer: BUF_RECORD[], target: TARGET): boolean {
    if (Logger.isBackpressure[target]) {
      return false;
    }
    const stream = target === 'err' ? Logger.stderr : Logger.stdout;
    do {
      const record = buffer.shift();
      if (!record) break;
      const res = stream.write(`${record.data}${EOL}`);
      if (!res) {
        Logger.isBackpressure[target] = true;
        stream.once('drain', () => {
          Logger.isBackpressure[target] = false;
          Logger.restart();
        });
        break;
      }
    } while (buffer.length > 0);
    return Logger.isBackpressure[target] === false;
  }

  protected dataToErr(data?: unknown): Error | null {
    const err = data instanceof Error ? {
      name: data.name,
      message: data.message,
      stack: data.stack,
    } : null;
    return err;
  }

  protected defaultFormatter(ts: number, name: string, scope: string, level: LOG_LEVEL, data?: unknown): string {
    const err = this.dataToErr(data);
    const input = err ?? data;
    const isCircular = util.format('%j', input) === '[Circular]';
    const payload = isCircular ? util.formatWithOptions({ depth: this.depth }, '%O', input) : input;
    const msg: DEFAULT_FORMAT = {
      t: ts,
      l: level,
      s: scope,
      n: name,
      ... (err ? { e: err } : { d: payload }),
    };
    return util.format('%j', msg);
  }

  protected format(name: string, level: LOG_LEVEL, data?: unknown): string {
    const formatter = this.formatter;
    return formatter(new Date().getTime(), name, this.scope, level, data);
  }
}
