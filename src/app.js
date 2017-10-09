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
const pathModule = require('path')
const chokidar = require('chokidar')
const xs = require('xstream').default
const delay = require('xstream/extra/delay').default
const pairwise = require('xstream/extra/pairwise').default

const pattern = require('./pattern')

const root = './myProjjie'
const items = app.service('/items')

console.log(` = = = = = =                    = = = = = = `)
console.log(`= = = = = = =   it's my turn   = = = = = = =`)
console.log(` = = = = = =                    = = = = = = `)

const rootCaptureStep = {pattern: '<*>'} // There's only 1 everything
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
const doy$ = render({fileChange$, watcher})
doy$.addListener({
  next: x => console.log('doy', x),
  error: e => console.error('doyerror', e),
  complete: () => console.log('doyover')
})


function render({fileChange$, watcher}) {
  return arrayPairwise([rootCaptureStep, ...steps]).reduce(
    ({allChange$, stepChange$}, [prevStep, step], i) => {

    // First we collapse into groups...

    const queryChange$ = stepChange$.fold(
      ({map}, {type, path}) => {

      const vars = pattern.read(pattern.parse(prevStep.pattern), path)
      const query = pattern.render(pattern.parse(step.pattern), vars)

      // Add/remove from buckets
      let change = null
      if (type === 'add') {
        change = {type: 'addSource', query, path}
        if (!map.has(query)) { // Make a new bucket
          map.set(query, {
            set: new Set(),
            parsed: pattern.parse(query)
          })
          change = {type: 'add', query, path}
        }
        map.get(query).set.add(path)
      } else {
        change = {type: 'removeSource', query, path}
        const sources = map.get(query).set
        sources.delete(path)
        if (sources.size === 0) {
          map.delete(query) // Remove empty bucket
          change = {type: 'remove', query}
        }
      }
      return {map, change}
    }, {map: new Map(), change: null}).drop(1) // Don't emit seed

    dbRowChange$ = queryChange$

    // ...Then we expand by searching/listening

    listingChange$ = queryChange$.filter(
      x => x.change.type === 'add' // A unique query appears!
    ).fold((streamsMap, {map, change: {type, query}}) => {
      const parsed = map.get(query).parsed
      const remove$ = queryChange$.filter(x => (
        x.change.type === 'remove' &&
        x.change.query === query
      )).take(1)

      const isSmart = (parsed.varNames.length > 0)
      const queryEvent$ = isSmart
        // Branch. This query is but a portal to whatever files exist
        ? trackCollection({parsed, remove$, change$: xs.merge(
          querySearch(parsed, watcher),
          fileChange$.filter(queryMatches(parsed))
        )})
        // No branching. This query IS the file!
        : remove$.map(x => x.change)
          .startWith({type: 'add', path: query})

      /*
      const oldC = queryEvent$._c.bind(queryEvent$)
      queryEvent$._c = () => (console.log('COMPLETING', query), oldC())
      */

      return streamsMap.set(query, queryEvent$)
    }, new Map())
    .compose(gather)

    return {
      allChange$: xs.merge(allChange$, listingChange$.map(x => {
        return Object.assign({_step: i}, x)
      })),
      stepChange$: listingChange$
    }
  }, {
      allChange$: xs.never(),
      //stepChange$: xs.never().startWith({type: 'add', path: './'})
      stepChange$: xs.merge(
        xs.of({type: 'add', path: './'}), xs.never()
      ).compose(delay(1000))
  }).allChange$
}

function queryMatches(parsedPattern) {
  return change => {
    try {
      pattern.read(parsedPattern, change.path)
      return true
    } catch (e) {}
    return false
  }
}
function querySearch(parsedPattern, watcher) {
  const listings = Object.entries(watcher.getWatched())
  const matchingPaths = []
  for (const [dir, files] of listings) {
    for (const file of files) {
      const path = pathModule.join(dir, file)
      try {
        pattern.read(parsedPattern, path)
        matchingPaths.push(path)
      } catch (e) {}
    }
  }
  return xs.from(matchingPaths).map(path => ({type: 'add', path}))
}

// This is where we handle the one placeholder file
// WHY DOES THIS FUNCTION RETURN A COMPLETING STREAM
function trackCollection({parsed, change$, remove$}) {
  const dummySet = new Set([pattern.renderDummy(parsed)])

  const pathSet$ = change$.fold((paths, {type, path}) => {
    const set = new Set(paths)
    if (type === 'add') return set.add(path)
    set.delete(path)
    return set
  }, new Set())

  const stream$ = xs.merge(
    pathSet$.endWhen(remove$), remove$.mapTo(null)

    //xs.never() // STREAM$ ENDS PREMATURELY WITHOUT THIS
               // FIND OUT WHY

  ).startWith(null)
  .map(set => set ? (set.size ? set : dummySet) : new Set())

  // Handling the dummySet requires summing up the changes
  .compose(pairwise)
  .map(([pathsOld, pathsNew]) => {
    const paths = new Set(pathsNew)
    const emit = []
    for (const path of paths) {
      if (pathsOld.has(path)) {
        pathsOld.delete(path)
      } else emit.push({type: 'add', path})
    }
    pathsOld.forEach(path => emit.push({type: 'remove', path}))
    //emit.push(null)
    return xs.from(emit)
  }).flatten()
  return stream$
}

function arrayPairwise(array) {
  return array.slice(1).map((x, i) => [array[i], x])
}
// streams$: stream of array of child streams
function gather(streamsMap$) {
  let l = null
  const sub = {
    next: item => l.next(item),
    error: e => l.error(e),
    complete: () => {}
  }
  const streams = new Map()
  streamsMap$.addListener({
    next: streamsMap => {
      const addSet = new Set()
      let removeCount = 0
      const streamsOld = new Map(streams)
      for (const [query, stream] of streamsMap) {
        if (streamsOld.has(stream)) {
          streamsOld.delete(stream)
        } else {
          addSet.add({query, ils: stream._ils})
          //stream._remove = () => console.log(`DONT YOU EVEN THINK`)
          streams.set(stream, stream.subscribe(sub))
        }
      }
      for (const [stream, subsn] of streamsOld) {
        removeCount++
        subsn.unsubscribe()
        streams.delete(stream)
      }
      //console.log('Subbed to', [...addSet], `, ${removeCount} unsubbed`)
    }
  })
  return xs.create({
    start: listener => l = listener,
    stop: () => {l = null}
  })
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

