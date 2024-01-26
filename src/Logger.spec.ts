import { Duplex } from 'node:stream';
import { TextEncoderStream } from 'node:stream/web';
import { LOG_LEVEL_DEBUG, Logger, DEFAULT_FORMAT, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_NONE } from './index';

describe('Logger', () => {
  it('should log all for LOG_LEVEL_DEBUG', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const logger = new Logger(LOG_LEVEL_DEBUG)
      .setScope('test')
      .setDepth(2);

    const debugPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));;;
    logger.debug('debug', { o: { a: 1 } });
    const debugRes = JSON.parse((await debugPr).toString()) as DEFAULT_FORMAT;
    expect(debugRes).toMatchObject({ d: { o: { a: 1 } }, n: 'debug', s: 'test', l: LOG_LEVEL_DEBUG });
    expect(debugRes.t).toBeDefined();
    expect(debugRes.e).not.toBeDefined();


    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));;;
    logger.log('2');
    const infoRes = JSON.parse((await infoPr).toString()) as DEFAULT_FORMAT;
    expect(infoRes).toMatchObject({ n: '2', l: LOG_LEVEL_INFO, s: 'test' });
    expect(infoRes.d).not.toBeDefined();
    expect(infoRes.e).not.toBeDefined();

    const warnPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));;;
    logger.warn('test warn', { o: 'o' });
    const warnRes = JSON.parse((await warnPr).toString()) as DEFAULT_FORMAT;

    expect(warnRes).toMatchObject({ n: 'test warn', l: LOG_LEVEL_WARN, s: 'test', d: { o: 'o' } });
    expect(warnRes?.e).not.toBeDefined;

    const errPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));;
    logger.error('test error', new Error('3'));
    const errRes = JSON.parse((await errPr).toString()) as DEFAULT_FORMAT;

    expect(errRes).toMatchObject({ n: 'test error', l: LOG_LEVEL_ERROR, s: 'test' });
    expect(errRes?.e?.message).toBe('3');
    expect(errRes?.e?.name).toBe('Error');
    expect(errRes?.e?.stack).toBeDefined();
    expect(infoRes.d).not.toBeDefined();

    stream.destroy();
  });

  it('should handle data with circular refs', async () => {
    class A {
      constructor(public a: A[]) { }
    }
    const a: A[] = [];
    const obj = new A(a);
    a.push(obj);
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    const logger = new Logger(LOG_LEVEL_DEBUG, 'circular');
    Logger.replaceLogStreams(stream, stream);
    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));;
    logger.log('cycles', { a });
    const infoRes = JSON.parse((await infoPr).toString()) as DEFAULT_FORMAT;
    expect(infoRes?.d).toBe('{ a: <ref *1> [ A { a: [Circular *1] } ] }');
    expect(infoRes?.s).toBe('circular');
    expect(infoRes?.n).toBe('cycles');
    expect(infoRes?.e).not.toBeDefined();

    stream.destroy();
  });

  it('should output without colors when switched to visual format with colors disabled', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const logger = new Logger(LOG_LEVEL_DEBUG, 'VISUAL').setColors(false).setOutputFormat('visual');
    Logger.replaceLogStreams(stream, stream);
    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.log('test msg', [1]);
    const infoRes = (await infoPr).toString() as string;
    expect(infoRes).toMatch(/INFO \(VISUAL\): test msg \[[\n\s]+1[\n]\]/);

    stream.destroy();
  });

  it('should output with colors when switched to visual format', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const logger = new Logger(LOG_LEVEL_DEBUG, 'VISUAL').setOutputFormat('visual');
    Logger.replaceLogStreams(stream, stream);

    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.log('test msg');
    const infoRes = (await infoPr).toString() as string;
    expect(infoRes).toMatch(/[\x1B]\[32mINFO[\x1B]\[0m \(VISUAL\): [\x1B]\[36mtest msg[\x1B]\[0m/);

    const debugPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.debug('test msg');
    const debugRes = (await debugPr).toString() as string;
    expect(debugRes).toMatch(/[\x1B]\[34mDEBUG[\x1B]\[0m \(VISUAL\): [\x1B]\[36mtest msg[\x1B]\[0m/);

    const warnPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.warn('test msg');
    const warnRes = (await warnPr).toString() as string;
    expect(warnRes).toMatch(/[\x1B]\[33mWARN[\x1B]\[0m \(VISUAL\): [\x1B]\[36mtest msg[\x1B]\[0m/);

    const errPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.error('test msg', new Error(''));
    const errRes = (await errPr).toString() as string;
    expect(errRes).toMatch(/[\x1B]\[31mERROR[\x1B]\[0m \(VISUAL\): [\x1B]\[36mtest msg[\x1B]\[0m/);

    stream.destroy();
  });

  it('should clone new logger', async () => {
    const logger1 = new Logger(LOG_LEVEL_DEBUG, 'logger1');
    const logger2 = logger1.clone('logger2');
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger2.log('test msg');
    const infoRes = JSON.parse((await infoPr).toString()) as DEFAULT_FORMAT;
    expect(infoRes.s).toBe('logger2');

    stream.destroy();
  });

  it('should not log for LOG_LEVEL_NONE', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    new Logger(LOG_LEVEL_NONE, 'none').error('test msg', new Error(''));
    new Logger(LOG_LEVEL_INFO, 'info').log('info');
    const infoRes = JSON.parse((await infoPr).toString()) as DEFAULT_FORMAT;
    expect(infoRes.s).toBe('info');

    stream.destroy();
  });
});
