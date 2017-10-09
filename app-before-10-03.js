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
const pattern = require('./pattern')

const root = './myProjjie'
const items = app.service('/items')

console.log(` = = = = = =                    = = = = = = `)
console.log(`= = = = = = =   it's my turn   = = = = = = =`)
console.log(` = = = = = =                    = = = = = = `)

const steps = [
    { // new keyword; branch
      pattern: 'person-name-{id}.txt'
    },
    { // same keywords; 1-to-1
      pattern: 'person-coolname-{id}.txt'
    },
      { // new keyword; branch
        pattern: 'person-trait-{id}-{traitId}.txt'
      },
    { // missing keyword; collapse
      pattern: 'person-summary-{id}.txt'
    },
  { // missing keyword; collapse
    pattern: 'roster.txt'
  }
]

// On server-startup, take full inventory of items
const allItems = new Map()
let inItems = new Map([['./', {}]])
steps.forEach((step, i) => {
  if (i > 0) return

  const curPat = pattern.parse(step.pattern)

  const buckets = new Map() // Map<string, string[]>
  for (const name of inItems.keys()) {
    const oldVars = (i > 0)
      ? pattern.read(pattern.parse(steps[i - 1].pattern), name)

    const newName = pattern.render(curPat, oldVars)
    if (!buckets.has(newName)) buckets.set(newName, [])
    buckets.get(newName).push(name)
  }

  const outItems = new Map()
  for (const [target, sources] of buckets) {
    outItems.set(target, {
      dirty: false,
      outdated: false,
      sources
    })
  }
  console.log('SOME ITEMS', outItems)

  for (const kv of outItems) allItems.set(...kv)
  inItems = outItems
})

function runItemsThroughStep(items, fromStep, toStep) {
}
function changesMadeRunningItemsThroughStep(items, fromStep, toStep) {
}

const watchSources = new Set()
function addLink(target, source, step, isPlaceholder = false) {
  //service.patch(null, {query: {target}, fileExists: true})
  service.find({query: {target, source}}).then(results => {
    if (results.length > 0) return;

    service.create({target, source})
    if (watchSources.has(source) && !isPlaceholder) {
      const oldCount = watchSources.get(source)
      if (oldCount === 0) removeLink('temp', step, true)
      watchSources.set(source, oldCount + 1)
    }

    if (step.next.expands) { // Gotta search & watch
      watchSources.set(target, 0)
      const children = searchFSForChildren()
      for (const child of children) {
        addLink(child, target, step.next)
      }
      if (children.length === 0) addLink('temp', target, step.next, true)
    } else {
      addLink(step.next.transform(target), target, step.next)
    }
  })
}
function removeLink(target, source, step, isPlaceholder = false) {
  //service.patch(null, {query: {target}, fileExists: false})

  if (step.expands) { // This was a listing
    const oldCount = watchSources.get(source)
    if (oldCount !== undefined && !isPlaceholder) {
      watchSources.set(source, oldCount - 1)
      if (oldCount === 1) addLink('temp', source, step, true)
    }

    service.remove(null, {query: {target}})
    service.find({query: {source: target}}).then(children => {
      for (const child in children) removeLink(child, step.next)
    })
    if (step.next.expands) watchSources.delete(target)
  }

}

chokidar.on('fileAdded', file => {
})

/** ** ******************************************** ** **/
/** **                                              ** **/
/** ** UGH IT'S DISGUSTINGLY MINDBENDINGLY STATEFUL ** **/
/** **                                              ** **/
/** ** ******************************************** ** **/

// chokidar's ignoreOfficial isn't useful: what if a
// resulting file is discovered before its parent
function render({fileChange$}) {
  return pairwise(parsedSteps).reduce(
    ({allChange$, stepChange$}, [prevStep, step]) => {

    // First we collapse into groups...

    const queryChange$ = stepChange$.fold(
      ({map}, {type, path}) => {

      const vars = readPath(path, prevStep)
      const query = renderPath(vars, step)

      // Add/remove from buckets
      let change = null
      if (type === 'add') {
        change = {type: 'addSource', query, path}
        if (!map.has(query)) { // Make a new bucket
          map.set(query, new Set())
          change = {type: 'add', query, path}
        }
        map.get(query).add(path)
      } else {
        change = {type: 'removeSource', query, path}
        map.get(query).delete(path)
        if (sources.size === 0) {
          map.delete(query) // Remove empty bucket
          change = {type: 'remove', query}
        }
      }
      return {map, change}
    }, {map: new Map(), change: null})

    dbRowChange$ = queryChange$

    listingChange$ = queryChange$.filter(
      x => x.change.type === 'add'
    ).reduce((dict, {change: {type, query}}) => {
      return dict.set(query, handleQuery(
        query,
        searchFSforFiles(query),
        fileChange$.filter(x => queryMatches(x, query)),
        queryChange$.filter(x => (
          x.change.type === 'remove' &&
          x.change.query === query
        ).map(x => null)
      ))
    }, new Map())
    .map(dict => xs.merge(dict.values())).flatten()


    return Object.keys(items).map(name => {
      const vars = parseStep(name, prevStep)
      return step.expands
        ? findFSmatches(vars, step)
        : xs.of(makePlaceholder(vars, step))
    })
  }, {'./': []}) // filename: array of sources
}

// This is where we handle the one placeholder file
function handleQuery(query, search$, change$, remove$) {
  const dummySet = new Set([renderDummy(query)])
  return xs.merge(
    xs.merge(search$, change$, remove$)
      .fold((items, {type, path}) => {
        if (type === 'add') return new Set(items).add(path)
        return new Set(items).delete(path)
      }, new Set())
      .endWhen(remove$),
    remove$.mapTo(null).take(1)
  ).map(set => set ? (set.size ? set : dummySet) : new Set())
  .compose(pairwise)
  .map(([pathsOld, pathsNew]) => {
    const emit = [], paths = new Set(pathsNew)
    for (const path of paths) {
      if (pathsOld.has(path)) {
        paths.delete(path)
        pathsOld.delete(path)
      } else {
        emit.push({type: 'add', path})
      }
    }
    emit.push(...pathsOld.map(path => {type: 'remove', path}))
    return xs.from(emit)
  }).flatten()
}

function findFSmatches(name, {vars, fixeds}) {
  const matches = []
  return matches.length > 0 ? matches : '
}
function pairwise(array) {
  return array.slice(1).map((x, i) => [array[i - 1], x])
}

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

