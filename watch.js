
const webpack = require('webpack')
const path = require('path')
const ProgressBarPlugin =
  require('progress-bar-webpack-plugin')

const compiler = webpack({
  watch: true,
  cache: true,
  context: path.join(__dirname, 'src'),
  entry: {
    client: './client/client.ts',
    server: './server.ts'
  },
  output: {
    path: path.join(__dirname, 'public'),
    filename: '[name].bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    modules: ['node_modules']
  },
  plugins: [new ProgressBarPlugin()],
  module: {rules: [{
    test: /\.[tj]sx?$/,
    use: {
      loader: 'ts-loader',
      options: {entryFileIsJs: true}
    },
    exclude: /node_modules/
  }]}
}, (err, stats) => {
  if (err) logger.error('Webpack:', err)
})