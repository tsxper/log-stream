import { LOG_LEVEL_DEBUG, Logger } from '../src';
import { log } from './log';

const logger = new Logger(LOG_LEVEL_DEBUG, 'compact');
log(logger);
