// A hook that logs service method before, after and error
const logger = require('winston');

module.exports = function () {
  return function (hook) {
    let message = `${hook.path} ${hook.method.toUpperCase()} ''''''''''''''''''''''''''''''''''''''''''''''''
    `;

    if (hook.type === 'error') {
      message += `: ${hook.error.message}`;
    }

    logger.info(message);
    logger.info('   hook.data', hook.data);
    logger.info('   hook.params', hook.params);

    if (hook.result) {
      logger.debug('hook.result', hook.result);
    }

    if (hook.error) {
      logger.error(hook.error);
    }
  };
};
