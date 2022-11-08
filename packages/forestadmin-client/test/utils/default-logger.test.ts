import defaultLogger from '../../src/utils/default-logger';

describe('defaultLogger', () => {
  it.each(['Debug', 'INFO', 'Warn', 'ERROR'])('should log at the right level', level => {
    const logger = jest.spyOn(console, level.toLowerCase() as 'info').mockImplementation();
    defaultLogger(level, 'foo');
    expect(logger).toHaveBeenCalledWith('foo');
    logger.mockRestore();
  });

  it('should log as a debug message when the level is not known', () => {
    const logger = jest.spyOn(console, 'debug').mockImplementation();
    defaultLogger('foo', 'bar');
    expect(logger).toHaveBeenCalledWith('bar');
    logger.mockRestore();
  });
});
