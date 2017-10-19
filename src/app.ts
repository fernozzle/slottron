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

const feathersDriver = makeFeathersDriver<{
  'items/': {project: string, path: string, isReal: boolean, group: string, id: any},
  'projects/': {createdAt: string, path: string, _id: string}
}>(app)

const feathersSource = (false as true) && feathersDriver(null) /* Ha */
function main(sources : {Feathers: typeof feathersSource}) {
  const {Feathers} = sources

  const initialProjectRequest$ = xs.of({service: 'projects/', method: 'find'})
  const projectRequest$ =
  Feathers.response({method: 'find', service: 'projects/'}).flatten()
  .map(({data: initialProjects}) => {

    console.log('got initial projects!', initialProjects)

    const projectAdded$ = xs.merge(
      xs.fromArray(initialProjects),
      Feathers.listen({service: 'projects/', type: 'created'})
    ).map(x => ({datum: x}))

    function ProjectItem(sources: any) {
      const {datum: {path, _id: project}} = sources

      console.log('Just heard about a new project!', sources.datum)

      const remove$ = Feathers.listen({service: 'projects/', type: 'removed'})
        .filter(x => x._id === project)

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
      const itemsReq$ = fileWatch({fileChange$, watcher, steps: app.get('SL-steps')})

      const request$ = xs.merge(
        xs.of({
          method: 'remove', // clear project's items
          id: null as any,
          params: {query: {project}}
        }),
        itemsReq$.filter((x: any) => !x.activity)
        .map((x: any) => {
          const {type, step, path, isReal, group} = x
          if (type === 'remove') return {
            method: 'remove',
            id: null as any,
            params: {query: {project}}
          }
          return {
            method: 'create',
            data: {project, step, path, isReal, group}
          }
        })
      ).map((x: any) => ({service: 'items/', ...x}))

      return {remove$, Feathers: request$}
    }
    const projectItems$ = Collection(
      ProjectItem, null, projectAdded$,
      (sinks: any) => sinks.remove$,
      (sources: any) => sources.datum.path
    )

    const request$ = Collection.merge(projectItems$, (item: any) => item.Feathers)
    return request$ as xs<any>
  }).flatten()

  return {Feathers: xs.merge(initialProjectRequest$, projectRequest$)}
}

run(main, {Feathers: feathersDriver})

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