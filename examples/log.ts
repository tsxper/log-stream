import { LOG_LEVEL_DEBUG, Logger } from '../src/index';

class A {
  prop = 'abc';
  constructor(public a: A[]) { }
}

export const log = (scope: string) => {
  const arr: A[] = [];
  const obj = new A(arr);
  arr.push(obj);
  const logger = new Logger(LOG_LEVEL_DEBUG, scope);
  logger.setDepth(1);
  logger.log('Circular refs', arr);
  logger.debug('Debug Message', {
    k1: 'string 1',
    a: {
      b: {
        c: { e: {} }
      },
    },
  });
  logger.log('Info Message');
  logger.warn('Unexpected input', { title: '$&^' });
  logger.log('hello world', [1, 2]);
  logger.error('Error Message', new Error('Invalid data'));
};
