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

import {run} from '@cycle/run'
import Collection from './collection'
import xs from 'xstream'
import {makeFeathersDriver, FeathersRequestStream} from './feathers-driver'

import * as fs from 'fs'
const chokidar = require('chokidar')
import delay from 'xstream/extra/delay'
import fileWatch from './file-watch'

const items = app.service('/items')
const projects = app.service('/projects')

console.log(` = = = = = =                    = = = = = = `)
console.log(`= = = = = = =   it's my turn   = = = = = = =`)
console.log(` = = = = = =                    = = = = = = `)

app.set('SL-steps', [
  {pattern: 'dir/story-<mood>.txt'},
  {pattern: 'story-<mood>.txt'},
])

run(function main(sources) {
  return {}
}, {})

/*
const newProject$ = xs.merge(
  xs.fromPromise(projects.find())
    .map(({data}) => xs.fromArray(data)).flatten(),
  xs.create({
    start: listener => projects.on('created', item => listener.next(item)),
    stop: () => {}
  })
)
newProject$.addListener({next(project) {
  console.log('a project', project)

  items.remove(null, {query: {project}})

  const watcher = chokidar.watch('.', {
    cwd: project.path,
    ignoreInitial: false,
    alwaysStat: true
  })
  const fileChange$ = xs.create({
    start: l => watcher
      .on('add', (path, {size, ctime: date}) => l.next({type: 'add', path, size, date}))
      .on('change', (path, {size, ctime: date}) => l.next({type: 'update', path, size, date}))
      .on('unlink', path => l.next({type: 'remove', path})),
    stop: () => {}
  })

  const itemsReq$ = fileWatch({fileChange$, watcher, steps: app.get('SL-steps')})

  itemsReq$.addListener({
    next: item => {
      if (item.activity) {
        console.log('/group-activity/', item)
        return
      }
      const {type, path, isReal, group, step} = item
      console.log('/items/', {type, path, isReal, group})
      if (type === 'add' || type === 'update') {
        items.create({step, path, isReal, group})
      } else if (type === 'update') {
        items.patch(null, {step, path, isReal, group}, {query: {path}})
      } else if (type === 'remove') {
        items.remove(null, {query: {path}})
      }
    },
    error: e => console.error('itemsReq$ ERROR', e),
    complete: () => console.log('itemsReq$ complete')
  })
}})

*/