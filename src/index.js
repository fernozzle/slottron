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
const webpack = require('webpack')
const path = require('path')
const ProgressBarPlugin =
  require('progress-bar-webpack-plugin')

const compiler = webpack({
  watch: true,
  cache: true,
  context: __dirname,
  entry: {client: './client/client.ts'},
  output: {
    path: path.join(__dirname, '../public'),
    filename: '[name].bundle.js'
  },
  resolve: {modules: ['node_modules']},
  plugins: [new ProgressBarPlugin()],
  module: {rules: [{
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/
  }]}
}, (err, stats) => {
  if (err) logger.error('Webpack:', err)
})
//*/
