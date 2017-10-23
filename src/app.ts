import * as path from 'path'
const favicon = require('serve-favicon');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');

import * as feathers from 'feathers'
const configuration = require('feathers-configuration');
import * as hooks from 'feathers-hooks'
import * as rest from 'feathers-rest'
import * as socketio from 'feathers-socketio'

import * as handler from 'feathers-errors/handler'
import * as notFound from 'feathers-errors/not-found'

import * as middleware from './middleware'
import * as services from './services'
import * as appHooks from './app.hooks'

import * as files from './files'

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
import {SlottronModels, primaryKey} from './common'

import * as fs from 'fs'
const chokidar = require('chokidar')
import {EventEmitter} from 'events'
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

const feathersDriver = makeFeathersDriver<SlottronModels>(app)
const feathersSource = (false as true) && feathersDriver(null) /* Ha */

function main(sources : {Feathers: typeof feathersSource}) {
  const {Feathers} = sources

  function ItemComponent(sources: any) {
    const {Item, service} = sources
    const request$ = Item.state$.map(item => {
      const {path, [primaryKey]: project} = item

      const watcher = chokidar.watch('.', {
        cwd: path, ignoreInitial: false, alwaysStat: true
      }) as EventEmitter

      const fileChange$ = xs.create({
        start: l => watcher
          .on('add', (path, {size, ctime: date}) => l.next({type: 'add', path, size, date}))
          .on('change', (path, {size, ctime: date}) => l.next({type: 'update', path, size, date}))
          .on('unlink', path => l.next({type: 'remove', path})),
        stop: () => {}
      })

      const event$ = fileWatch({fileChange$, watcher, steps: app.get('SL-steps')})
      const changeRequest$ = event$.filter(
        (x: any) => !x.activity
      ).map((x: any) => {
        const {type, step, path, isReal, group} = x
        const id = `${project}.${path}`
        if (type === 'remove') return { method: 'remove', id }
        return { method: 'create', data: {
          [primaryKey]: id, project, step, path, isReal, group} }
      })
      const clearRequest$ = xs.of({
        method: 'remove',
        id: null, // clear project's items
        params: {query: {project}}
      })

      return xs.merge(clearRequest$, changeRequest$)
        .map((x: any) => ({service: 'items/', ...x}))
    }).flatten()
    return {Feathers: request$}
  }

  return Feathers.collectionStream({
    service: 'projects/',
    query: null,
    item: ItemComponent,
    collectSinks: instances => ({
      Feathers: instances.pickMerge('Feathers')
    })
  })(sources)
}

run(main, {Feathers: feathersDriver})
