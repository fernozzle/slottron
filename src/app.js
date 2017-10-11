const path = require('path');
const favicon = require('serve-favicon');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');

const feathers = require('feathers');
const configuration = require('feathers-configuration');
const hooks = require('feathers-hooks');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');

const handler = require('feathers-errors/handler');
const notFound = require('feathers-errors/not-found');

const middleware = require('./middleware');
const services = require('./services');
const appHooks = require('./app.hooks');

const files = require('./files')

const app = feathers();

// Load app configuration
app.configure(configuration());
// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
/*
 * serve-favicon is a middleware that intercepts
 * requests to '/favicon.ico' and sends the icon
 */
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', feathers.static(app.get('public')));

app.configure(files)
/*
app.use('/files', (req, res, next) => {
  console.log('req', req)
  res.statusCode = req.method === 'OPTIONS' ? 200 : 405
  res.setHeader('Allow', 'GET, HEAD, OPTIONS')
  res.setHeader('Content-Length', '0')
  res.end()
  return
})
*/

// Set up Plugins and providers
app.configure(hooks());
app.configure(rest());
app.configure(socketio());

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
// Set up our services (see `services/index.js`)
app.configure(services);
// Configure a middleware for 404s and the error handler
app.use(notFound());
app.use(handler());

app.hooks(appHooks);

module.exports = app;

/*
 * my turn binch
 */

const find = require('find')
const fs = require('fs')
const chokidar = require('chokidar')
const xs = require('xstream').default
const delay = require('xstream/extra/delay').default

const fileWatch = require('./file-watch').default

const items = app.service('/items')

console.log(` = = = = = =                    = = = = = = `)
console.log(`= = = = = = =   it's my turn   = = = = = = =`)
console.log(` = = = = = =                    = = = = = = `)

app.set('SL-root', './myProjjie')
app.set('SL-steps', [
  {pattern: 'dir/story-<mood>.txt'},
  {pattern: 'story-<mood>.txt'},
])

const watcher = chokidar.watch('.', {
  cwd: app.get('SL-root'),
  ignoreInitial: false
})
const fileChange$ = xs.create({
  start: l => watcher
    .on('add', path => l.next({type: 'add', path}))
    .on('change', path => {})
    .on('unlink', path => l.next({type: 'remove', path})),
  stop: () => {}
})

const itemsReq$ = fileWatch({fileChange$, watcher, steps: app.get('SL-steps')})

itemsReq$.addListener({
  next: item => {
    console.log('itemsReq$', item)
    const {type, step, path} = item
    if (type === 'add') {
      items.create({step, path})
    } else if (type === 'remove') {
      items.remove(null, {query: {path}})
    }
  },
  error: e => console.error('itemsReq$', e),
  complete: () => console.log('itemsReq$ complete')
})
