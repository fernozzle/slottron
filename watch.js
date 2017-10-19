
const webpack = require('webpack')
const path = require('path')
const ProgressBarPlugin =
  require('progress-bar-webpack-plugin')
const nodeExternals = require('webpack-node-externals')

const config = {
  watch: true,
  cache: true,
  context: path.join(__dirname, 'src'),
  resolve: {
    extensions: ['.ts', '.js', '.json'],
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
}

const compiler = webpack([
  {
    name: 'client',
    entry: './client/client.ts',
    target: 'web',
    output: {
      path: path.join(__dirname, 'public'),
      filename: 'client.bundle.js'
    },
    ...config
  },
  {
    name: 'server',
    entry: './server.ts',
    target: 'node',
    externals: [nodeExternals()],
    output: {
      path: path.join(__dirname, 'public'),
      filename: 'server.bundle.js'
    },
    ...config
  }
], (err, stats) => {
  if (err) logger.error('Webpack:', err)
})