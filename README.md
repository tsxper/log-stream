# Streams Logger

[![NPM Version](https://img.shields.io/npm/v/@tsxper/log-stream.svg?style=flat-square)](https://www.npmjs.com/package/@tsxper/log-stream)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![npm type definitions](https://img.shields.io/npm/types/@tsxper/log-stream)
[![NPM Downloads](https://img.shields.io/npm/dt/@tsxper/log-stream.svg?style=flat-square)](https://www.npmjs.com/package/@tsxper/log-stream)

*@tsxper/log-stream* is a TypeScript stream-based NodeJS logger.

Main features of the *@tsxper/log-stream* are:
- simplicity;
- small size;
- supporting 2 streams with exclusive stream for errors;
- back pressure support;
- "compact" and colored "visual" output formats;
- logging scopes;
- logging data structures for debugging;
- easy streams replacement;
- circular references safety;
- easy configuration spreading through cloning;

## Configuration

### Create Logger instance

```JavaScript
const logger = new Logger(LOG_LEVEL_INFO, 'my service');
```
This will create a new logger instance with a scope "my service" that will write all logs of all levels up to INFO (this excludes only DEBUG) into default "stdout" and "stderr" output streams.

### Output Formats

Currently 2 output formats are supported: "compact" (default) and "visual" (optional dependency)

#### Compact Format
![Compact Format](https://raw.githubusercontent.com/tsxper/log-stream/main/examples/compact.png)

Compact format contains a JSON string on a new line.
Compact format message decoded:
- t [required], time (ms);
- l [required], log level;
- s [required], scope;
- n [required], name (log message);
- d [optional], data;
- e [optional], error;

```JavaScript
const logger = new Logger(LOG_LEVEL_INFO, 'my service scope');
```

#### Visual Format
![Visual Format](https://raw.githubusercontent.com/tsxper/log-stream/main/examples/visual.png)

Install the visual formatter.
```bash
npm i @tsxper/log-stream-formatter-visual -D
```

See [tsxper/log-stream-formatter-visual](https://github.com/tsxper/log-stream-formatter-visual) docs on the GitHub for details.

```JavaScript
const logger = new Logger(LOG_LEVEL_INFO, 'my service scope');
```

### Log Levels
Possible log levels are:
- *LOG_LEVEL_NONE*, or 0, no logs are logged;
- *LOG_LEVEL_ERROR*, or 1, only "error" logs are logged;
- *LOG_LEVEL_WARN*, or 2, "error" and "warn" logs are logged;
- *LOG_LEVEL_INFO*, or 3, "error", "warn" and "info" logs will be logged;
- *LOG_LEVEL_DEBUG*, or 4, "error", "warn", "info" and "debug" logs will be logged;

```JavaScript
// JS example
logger.debug('debug message', [1, 2]);
logger.log('info message');
logger.warn('warn message');
logger.error('error message', new Error('error'));
```

```TypeScript
// TS interface
debug(name: string, data?: unknown): boolean;
log(name: string, data?: unknown): boolean;
warn(name: string, data?: unknown): boolean;
error(name: string, data: Error): boolean;
```

Each logging method returns a boolean "true" when a log message was successfully enqueued.

### Log Scopes
Log scope can be set in a constructor or later in *setScope()*

```TypeScript
constructor(logLevel?: LOG_LEVEL, scope?: string);
setScope(scope: string): this;
```

### Logging Objects
In "compact" output format all *data* objects are converted into JSON strings and are logged "as is".
In "visual" output format or when *data* objects contains circular refs, a "depth" parameter is applied
(by default depth=2).

```TypeScript
setDepth(depth: number): this;
```

**Circular Refs**.
In case passed *data* object contains circular refs, such object is converted into its string representation with denoted circular references.

### Log Streams
Two logs streams are supported: general logs stream and error log stream.
Default log stream for error logs is *process.stderr*.
Default log stream for general logs (all logs that are not errors) is *process.stdout*.

```TypeScript
// replace log streams
static replaceLogStreams(stdOut: NodeJS.WritableStream, stdErr: NodeJS.WritableStream): void;
```
Calling *Logger.replaceLogStreams()* will make all existing *Logger* instances write into the new streams.
> Note. Calling "Logger.replaceLogStreams()"" does not call "stream.destroy()" on previously used streams.

### Clone Logger
Cloning a logger instance makes easy to create a new logger with a new scope but existing settings (like formatter, depth).

```JavaScript
const logger2 = logger1.clone('new scope');
```

### Backpressure Support
At a peak usage, a stream can report that it is not ready to receive new data anymore.
In a meanwhile Logger can continue accepting new log messages and puts them into a buffer.
All new messages are buffering and will be sent into the stream as soon as the stream reports readiness ("drain" event) to receive new porting of data.

> Default buffer size (heigh watermark) is *100 000* items for both ("err" and "out") streams.
> This can be changed by calling "Logger.setBufferHeighWatermark(newNumber)".
> In case when backpressure event occurs, "Logger.getIsBackpressure(target)" call will return "true".

```TypeScript
type TARGET = 'err' | 'out';
static getIsBackpressure(target: TARGET): boolean;
```

### Formatters
Output format is configurable through setting custom formatting function.

```TypeScript
setFormatter(formatter: LOG_FORMATTER): this;
```
