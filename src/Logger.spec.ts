import { Duplex } from 'node:stream';
import { TextEncoderStream } from 'node:stream/web';
import { LOG_LEVEL_DEBUG, Logger, DEFAULT_FORMAT, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_NONE, LOG_LEVEL } from './index';

describe('Logger', () => {
  it('should handle slashes', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    Logger.setDoubleSlashes(true);
    const logger = new Logger(LOG_LEVEL_DEBUG);
    const pr1 = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.debug('line1\nline2');
    const res1 = JSON.parse((await pr1).toString()) as DEFAULT_FORMAT;
    expect(res1.n).toBe('line1\\nline2');
    
    Logger.setDoubleSlashes(false);
    const pr2 = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.debug('line1\nline2');
    const res2 = JSON.parse((await pr2).toString()) as DEFAULT_FORMAT;
    expect(res2.n).toBe('line1\nline2');

    stream.destroy();
  });

  it('should log all for LOG_LEVEL_DEBUG', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const logger = new Logger(LOG_LEVEL_DEBUG)
      .setScope('test')
      .setDepth(2);

    const debugPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.debug('debug', { o: { a: 1 } });
    const debugRes = JSON.parse((await debugPr).toString()) as DEFAULT_FORMAT;
    expect(debugRes).toMatchObject({ d: { o: { a: 1 } }, n: 'debug', s: 'test', l: LOG_LEVEL_DEBUG });
    expect(debugRes.t).toBeDefined();
    expect(debugRes.e).not.toBeDefined();


    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.log('2');
    const infoRes = JSON.parse((await infoPr).toString()) as DEFAULT_FORMAT;
    expect(infoRes).toMatchObject({ n: '2', l: LOG_LEVEL_INFO, s: 'test' });
    expect(infoRes.d).not.toBeDefined();
    expect(infoRes.e).not.toBeDefined();

    const warnPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.warn('test warn', { o: 'o' });
    const warnRes = JSON.parse((await warnPr).toString()) as DEFAULT_FORMAT;

    expect(warnRes).toMatchObject({ n: 'test warn', l: LOG_LEVEL_WARN, s: 'test', d: { o: 'o' } });
    expect(warnRes?.e).not.toBeDefined;

    const errPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.error('test error', new Error('3'));
    const errRes = JSON.parse((await errPr).toString()) as DEFAULT_FORMAT;

    expect(errRes).toMatchObject({ n: 'test error', l: LOG_LEVEL_ERROR, s: 'test' });
    expect(errRes?.e?.message).toBe('3');
    expect(errRes?.e?.name).toBe('Error');
    expect(errRes?.e?.stack).toBeDefined();
    expect(infoRes.d).not.toBeDefined();

    expect(Logger.getIsBackpressure('out')).toBe(false);
    expect(Logger.getIsBackpressure('err')).toBe(false);
    expect(Logger.getBufferSize()).toBe(0);

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
    const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
    logger.log('cycles', { a });
    const infoRes = JSON.parse((await infoPr).toString()) as DEFAULT_FORMAT;
    expect(infoRes?.d).toBe('{ a: <ref *1> [ A { a: [Circular *1] } ] }');
    expect(infoRes?.s).toBe('circular');
    expect(infoRes?.n).toBe('cycles');
    expect(infoRes?.e).not.toBeDefined();

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

  it('should handle backpressure', async () => {
    const streamText = new TextEncoderStream();
    const stream = Duplex.from(streamText);
    Logger.replaceLogStreams(stream, stream);
    const maxSize = 2;
    Logger.setBufferHeighWatermark(maxSize);
    const logger = new Logger(LOG_LEVEL_DEBUG, 'test');

    expect(logger.debug('pass1')).toBe(true);
    expect(logger.debug('pass2')).toBe(true);
    expect(logger.debug('pass3')).toBe(true);
    expect(Logger.getBufferSize()).toBe(0);

    const originWrite = stream.write;
    const writeMock = jest.fn(() => false);

    // stream write returns "false"
    stream.write = writeMock;
    expect(logger.debug('ok1')).toBe(true);
    expect(Logger.getBufferSize()).toBe(0);
    expect(logger.log('ok2')).toBe(true);
    expect(Logger.getBufferSize()).toBe(1);
    expect(logger.log('ok3')).toBe(true);
    expect(Logger.getBufferSize()).toBe(maxSize);
    expect(logger.warn('fail1')).toBe(false); // buffer overflow
    expect(Logger.getBufferSize()).toBe(maxSize);
    expect(logger.error('fail2', new Error(''))).toBe(false); // buffer overflow
    expect(Logger.getBufferSize()).toBe(maxSize);
    expect(writeMock.mock.calls).toHaveLength(1);
    expect(Logger.getIsBackpressure('out')).toBe(true);
    expect(Logger.getIsBackpressure('err')).toBe(false);

    stream.write = originWrite;
    let events = 0;
    const buffPr = new Promise<DEFAULT_FORMAT>((resolve) => stream.on('data', (d: Buffer) => {
      const res = JSON.parse(d.toString()) as DEFAULT_FORMAT;
      if (res.n.indexOf('ok') !== 0) return;
      events += 1;
      if (events === maxSize) resolve(res);
    }));
    stream.emit('drain');
    const buffRes = await buffPr;
    expect(buffRes.n).toBe('ok3');
    expect(Logger.getBufferSize()).toBe(0);
    expect(Logger.getIsBackpressure('out')).toBe(false);
    expect(Logger.getIsBackpressure('err')).toBe(false);
    stream.destroy();
  });
});

it('should change message format', async () => {
  const streamText = new TextEncoderStream();
  const stream = Duplex.from(streamText);
  Logger.replaceLogStreams(stream, stream);
  const logger = new Logger(LOG_LEVEL_INFO, 'test');
  logger.setFormatter((ts: number, name: string, scope: string, level: LOG_LEVEL, data?: unknown) => {
    return 'abc';
  });
  const infoPr = new Promise<Buffer>((resolve) => stream.once('data', (d) => resolve(d)));
  logger.log('test', null);
  const infoRes = (await infoPr).toString().trim();
  expect(infoRes).toBe('abc');
  stream.destroy();
});
