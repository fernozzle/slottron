const webpack = require('webpack')
const path = require('path')
const ProgressBarPlugin =
  require('progress-bar-webpack-plugin')
const nodeExternals = require('webpack-node-externals')

const ENV = process.env.NODE_ENV

const config = {
  watch: true,
  cache: true,
  //context: path.join(__dirname, 'src'),
  resolve: {
    extensions: ['.ts', '.js', '.json', '.sass'],
    modules: ['node_modules']
  },
  plugins: [],
  module: {rules: [{
    test: /\.[tj]sx?$/,
    use: {
      loader: 'ts-loader',
      options: {entryFileIsJs: true}
    },
    exclude: /node_modules/
  }]}
}

module.exports = [
  {...config,
    name: 'client',
    entry: (ENV === 'production'
      ? ['./src/client/client.ts']
      : [
        'webpack-dev-server/client?http://localhost:8080',
        './src/client/client.ts'
      ]
    ),
    target: 'web',
    module: {rules: [
      ...config.module.rules,
      {
        test: /\.sass$/,
        loaders: ['style-loader', 'css-loader', 'sass-loader']
      }
    ]},
    plugins: [...config.plugins, ...(ENV === 'production'
      ? [new webpack.optimize.UglifyJSPlugin({minimize: true})]
      : [new webpack.HotModuleReplacementPlugin()]
    )],
    devServer: {
      historyApiFallback: true,
      contentBase: './',
      hot: true
    },
    output: {
      path: path.join(__dirname, 'public'),
      filename: 'client.bundle.js'
    }
  },
  {
    name: 'server',
    entry: './src/server.ts',
    target: 'node',
    externals: [nodeExternals()],
    output: {
      path: path.join(__dirname, 'public'),
      filename: 'server.bundle.js'
    },
    ...config
  }
]
