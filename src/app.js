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

const root = './myProjjie'
const items = app.service('/items')

console.log(` = = = = = =                    = = = = = = `)
console.log(`= = = = = = =   it's my turn   = = = = = = =`)
console.log(` = = = = = =                    = = = = = = `)

const steps = [
  {pattern: 'dir/story-<mood>.txt'},
  {pattern: 'story-<mood>.txt'},
]

const watcher = chokidar.watch('.', {
  cwd: root, ignoreInitial: false
})
const fileChange$ = xs.create({
  start: l => watcher
    .on('add', path => l.next({type: 'add', path}))
    .on('change', path => {})
    .on('unlink', path => l.next({type: 'remove', path})),
  stop: () => {}
})

fileChange$.addListener({})
const doy$ = fileWatch({fileChange$, watcher, steps})
doy$.addListener({
  next: x => console.log('doy', x),
  error: e => console.error('doyerror', e),
  complete: () => console.log('doyover')
})

/*
// Fetch entries
items.find().then(results => {
  console.log('Items:', results)
})

// Listen for events
items.on('created', datum => {
  console.log('Item added:', datum)
})

// Create entries
find.file(/story/, root, files => {
  console.log('FILES', files)
  Promise.all(files.map(name => new Promise((res, rej) => {
    const fn = path.relative(root, name)
    fs.stat(path.join(root, fn), (err, stats) => {
      if (err) rej(err)
      res({id: fn, time: stats.mtime})
    })
  }))).then(entries => items.create(entries))
})
*/

