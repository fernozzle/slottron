const logger = require('winston')
const app = require('./app')

const port = app.get('port')
const server = app.listen(port)

process.on('unhandledRejection', (reason, p) =>
  logger.error('Unhandled rejection:', p, reason)
)

server.on('listening', () =>
  logger.info(
    `Feathers application started on ` +
    `http://${app.get('host')}:${port}`
  )
)

// Now it's time for webpack watch

//*
//*/
