import { Console } from 'console';
import util from 'util';

export const LOG_LEVEL_NONE = 0;
export const LOG_LEVEL_ERROR = 1;
export const LOG_LEVEL_WARN = 2;
export const LOG_LEVEL_INFO = 3;
export const LOG_LEVEL_DEBUG = 4;

export type LOG_LEVEL = typeof LOG_LEVEL_NONE | typeof LOG_LEVEL_ERROR | typeof LOG_LEVEL_INFO | typeof LOG_LEVEL_WARN | typeof LOG_LEVEL_DEBUG;
export type LOG_FORMATTER = (name: string, scope: string, level: LOG_LEVEL, data?: unknown) => string;
export type OUTPUT_FORMAT = 'compact' | 'visual';
export type DEFAULT_FORMAT = {
  t: number;
  l: LOG_LEVEL;
  s: string;
  n: string;
  d?: unknown;
  e?: Error;
};

export class Logger {
  protected scope: string;
  protected logLevel: LOG_LEVEL;
  protected logDebug: boolean;
  protected logInfo: boolean;
  protected logWarn: boolean;
  protected logError: boolean;
  protected colors = true;
  protected depth = 2;
  protected outputFormat: OUTPUT_FORMAT = 'compact';
  protected logLevelsMap = {
    [LOG_LEVEL_NONE]: '',
    [LOG_LEVEL_ERROR]: 'ERROR',
    [LOG_LEVEL_INFO]: 'INFO',
    [LOG_LEVEL_WARN]: 'WARN',
    [LOG_LEVEL_DEBUG]: 'DEBUG',
  };
  protected formatterCompact: LOG_FORMATTER;
  protected formatterVisual: LOG_FORMATTER;
  protected static logger: Console;

  constructor(logLevel: LOG_LEVEL = LOG_LEVEL_NONE, scope: string = '') {
    this.scope = scope;
    this.logLevel = logLevel;
    this.logError = logLevel >= LOG_LEVEL_ERROR;
    this.logWarn = logLevel >= LOG_LEVEL_WARN;
    this.logInfo = logLevel >= LOG_LEVEL_INFO;
    this.logDebug = logLevel >= LOG_LEVEL_DEBUG;
    this.formatterCompact = this.defaultFormatterCompact.bind(this);
    this.formatterVisual = this.defaultFormatterVisual.bind(this);
    if (!Logger.logger) Logger.logger = new Console(process.stdout, process.stderr);
  }

  static replaceLogStreams(stdOut: NodeJS.WritableStream, stdErr: NodeJS.WritableStream): void {
    Logger.logger = new Console(stdOut, stdErr);
  }

  setFormatterCompact(formatter: LOG_FORMATTER): this {
    this.formatterCompact = formatter;
    return this;
  }

  setFormatterVisual(formatter: LOG_FORMATTER): this {
    this.formatterVisual = formatter;
    return this;
  }

  setOutputFormat(format: OUTPUT_FORMAT): this {
    this.outputFormat = format;
    return this;
  }

  setColors(useColors: boolean): this {
    this.colors = useColors;
    return this;
  }

  setScope(scope: string): this {
    this.scope = scope;
    return this;
  }

  clone(scope: string): Logger {
    return new Logger(this.logLevel, scope)
      .setOutputFormat(this.outputFormat)
      .setFormatterCompact(this.formatterCompact)
      .setFormatterVisual(this.formatterVisual)
      .setColors(this.colors);
  }

  debug(name: string, data?: unknown): void {
    this.logDebug && Logger.logger.log(this.format(name, LOG_LEVEL_DEBUG, data));
  }

  log(name: string, data?: unknown): void {
    this.logInfo && Logger.logger.log(this.format(name, LOG_LEVEL_INFO, data));
  }

  warn(name: string, data?: unknown): void {
    this.logWarn && Logger.logger.log(this.format(name, LOG_LEVEL_WARN, data));
  }

  error(name: string, data: Error): void {
    this.logError && Logger.logger.error(this.format(name, LOG_LEVEL_ERROR, data));
  }

  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }

  protected dataToErr(data?: unknown): Error | null {
    const err = data instanceof Error ? {
      name: data.name,
      message: data.message,
      stack: data.stack,
    } : null;
    return err;
  }

  protected defaultFormatterCompact(name: string, scope: string, level: LOG_LEVEL, data?: unknown): string {
    const err = this.dataToErr(data);
    const input = err ?? data;
    const isCircular = util.format('%j', input) === '[Circular]';
    const payload = isCircular ? util.formatWithOptions({ depth: this.depth }, '%O', input) : input;
    const msg: DEFAULT_FORMAT = {
      t: new Date().getTime(),
      l: level,
      s: scope,
      n: name,
      ... (err ? { e: err } : { d: payload }),
    };
    return util.format('%j', msg);
  }

  protected defaultFormatterVisual(name: string, scope: string, level: LOG_LEVEL, data?: unknown): string {
    const err = this.dataToErr(data);
    let logLevelC = this.logLevelsMap[level];
    let titleC = name;
    const formats: string[] = ['%s', '%s', '(%s):', '%s'];
    if (data) {
      formats.push('%O');
    }
    if (this.colors) {
      if (level === LOG_LEVEL_DEBUG) {
        logLevelC = this.wrapInBlue(logLevelC);
      } else if (level === LOG_LEVEL_INFO) {
        logLevelC = this.wrapInGreen(logLevelC);
      } else if (level === LOG_LEVEL_WARN) {
        logLevelC = this.wrapInYellow(logLevelC);
      } else if (level === LOG_LEVEL_ERROR) {
        logLevelC = this.wrapInRed(logLevelC);
      }
      titleC = this.wrapInCyan(titleC);
    }
    const params = [new Date().toISOString(), logLevelC, scope, titleC, err || data].filter((v) => v !== undefined);
    return util.formatWithOptions({ compact: false, depth: this.depth }, formats.join(' '), ...params);
  }

  protected wrapInRed(str: string): string {
    const redCode = 31;
    return this.wrapInColor(redCode, str);
  }

  protected wrapInYellow(str: string): string {
    const redCode = 33;
    return this.wrapInColor(redCode, str);
  }

  protected wrapInGreen(str: string): string {
    const greenCode = 32;
    return this.wrapInColor(greenCode, str);
  }

  protected wrapInBlue(str: string): string {
    const blueCode = 34;
    return this.wrapInColor(blueCode, str);
  }

  protected wrapInCyan(str: string): string {
    const cyanCode = 36;
    return this.wrapInColor(cyanCode, str);
  }

  protected wrapInColor(color: number, str: string): string {
    return `\x1b[${color}m${str}\x1b[0m`;
  }

  protected format(name: string, level: LOG_LEVEL, data?: unknown): string {
    const formatter = this.outputFormat === 'compact' ? this.formatterCompact : this.formatterVisual;
    return formatter(name, this.scope, level, data);
  }
}
