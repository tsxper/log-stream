import { LOG_LEVEL_DEBUG, Logger } from '../src';
import { log } from './log';
import { FormatterVisual } from '@tsxper/log-stream-formatter-visual';

const logger = new Logger(LOG_LEVEL_DEBUG, 'expanded');
const visual = new FormatterVisual();
logger.setFormatter(visual.formatter.bind(visual));
log(logger);
