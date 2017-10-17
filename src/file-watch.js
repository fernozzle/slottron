const pathModule = require('path')
const xs = require('xstream').default
const pairwise = require('xstream/extra/pairwise').default

const pattern = require('./pattern')

const rootCaptureStep = {pattern: '<*>'} // There's only 1 everything

function fileWatch({fileChange$, watcher, steps}) {
  return arrayPairwise([rootCaptureStep, ...steps]).reduce((
    {allChange$, stepChange$},
    [prevStep, step],
    i
  ) => {
    // First we collapse into groups...
    const groupChange$ = stepChange$
    //.debug(x => console.log('STEPCHANGE', x))
    .fold(({map}, {type, path, date = new Date()}) => {

      const vars = pattern.read(pattern.parse(prevStep.pattern), path)
      const group = pattern.render(pattern.parse(step.pattern), vars)

      // Add/remove from buckets
      const change = {type: null, group, path, date}
      if (type === 'remove') {
        change.type = 'removeSource'
        if (map.has(group)) {
          const sources = map.get(group).set
          sources.delete(path)
          if (sources.size === 0) {
            map.delete(group) // Remove empty bucket
            change.type = 'remove'
          }
        }
      } else if (map.has(group)) { // Add or update
        const groupPaths = map.get(group).set
        if (!groupPaths.has(path)) {
          groupPaths.add(path) // Existent bucket
          change.type = 'addSource'
        } else change.type = 'update' // Nothing new
      } else { // New bucket
        map.set(group, {
          set: new Set([path]),
          parsed: pattern.parse(group)
        })
        change.type = 'add'
      }
      return {map, change}
    }, {map: new Map(), change: null})
    .filter(({change}) => change) // Don't emit seed

    /**      _       _
     *    __| | __ _| |_ ___
     *   / _` ||__` | __/ _ \  is the ctime (changed time, for both file content and copying)
     *  | (_| |/ _` | ||  __/     of the file if provided (all add/remove events, both search & event)
     * (_\__,_|\__,_|\__\___|     and `Date.now()` if it's a remove event
     */

    // An entire group shares one activity entry
    // This goes to the /activity/ service, which should reject items where date <= current value
    const groupActivity$ = groupChange$.map((
      {change: {group, type, path, date}}
    ) => ({
      activity: true,
      group, // To be used like a primary key
      path,  // This is the file whose modification updated our group
      date,  // Entries shall accumulate and the one with the latest date
             // determines whether a group's descendant item is outdated
      type: ( // What happened to it
        type === 'add' || type === 'addSource'
      ) ? 'add' : (type === 'update' ? 'update' : 'remove'),
    }))

    // ...Then we expand by searching/listening
    // groupChange$ events where type === 'update' are completely IGNORED here
    itemChange$ = groupChange$.filter(
      x => x.change.type === 'add' // A unique group appears!
    ).fold((streamsMap, {map, change: {type, group}}) => {
      const parsed = map.get(group).parsed
      const groupRemove$ = groupChange$.filter(x => (
        x.change.type === 'remove' && x.change.group === group
      )).take(1)
      return streamsMap.set(group, collectGroupEvents({
        // If live group results are empty, pretend
        // there's 1 fake file there with this name
        fallbackName: pattern.renderDummy(parsed),
        filesInitial: groupSearch(parsed, watcher),
        fileChange$: fileChange$.filter(groupMatches(parsed)),
        groupRemove$
      }).map(change => Object.assign(change, {group, step: i})))
    }, new Map())
    .compose(gather)

    return {
      allChange$: xs.merge(allChange$, groupActivity$, itemChange$),
      stepChange$: itemChange$
    }
  }, {
    allChange$: xs.never(),
    stepChange$: xs.merge(xs.never(), xs.of({
      type: 'add', path: './',
      group: rootCaptureStep.pattern
    }))
  }).allChange$
}

function groupMatches(parsedPattern) {
  return change => {
    try {
      pattern.read(parsedPattern, change.path)
      return true
    } catch (e) {}
    return false
  }
}
function groupSearch(parsedPattern, watcher) {
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
  return matchingPaths
}

function collectGroupEvents({fallbackName, filesInitial, fileChange$, groupRemove$}) {
  const dummyMap = new Map([[fallbackName, {isReal: false, date: null}]])
  const initialMap = new Map(filesInitial.map(path =>
    [path, {isReal: true, date: new Date(0)}] // REPLACE WITH FILE CREATION DATE
  ))
  const map$ = fileChange$.fold((paths, {type, path}) => {
    const map = new Map(paths)
    if (type === 'remove') map.delete(path)
    else map.set(path, {isReal: true, date: new Date()}) // I guess we're using realtime timestamps
    return map
  }, initialMap)

  return xs.merge(
    map$.endWhen(groupRemove$), groupRemove$.mapTo(null)
  ).startWith(null)
  .map(map => map ? (map.size ? map : dummyMap) : new Map())
  .compose(pairwise)
  .map(([mapOld, mapNew]) => {
    const map = new Map(mapOld)
    const emit = []
    for (const [path, item] of mapNew) { // Date unused right now
      if (map.has(path)) { // Both old and new have it...
        if (item !== map.get(path)) //..but it's DIFFERENT (by value)
          emit.push(Object.assign({type: 'update', path}, item))
        map.delete(path)
      } else emit.push(Object.assign({type: 'add', path}, item))
    }
    map.forEach((item, path) => emit.push({type: 'remove', path}))
    return xs.from(emit)
  }).flatten()
}

function arrayPairwise(array) {
  return array.slice(1).map((x, i) => [array[i], x])
}
function gather(streamsMap$) {
  const itemBuffer = []
  let l = null
  const sub = {
    next: item => l ? l.next(item) : itemBuffer.push({item}),
    error: error => l ? l.error(error) : itemBuffer.push({error}),
    complete: () => {}
  }
  const streams = new Map()
  streamsMap$.addListener({
    next: streamsMap => {
      const streamsOld = new Map(streams)
      for (const [group, stream] of streamsMap) {
        if (streamsOld.has(stream)) {
          streamsOld.delete(stream)
        } else streams.set(stream, stream.subscribe(sub))
      }
      for (const [stream, subsn] of streamsOld) {
        subsn.unsubscribe()
        streams.delete(stream)
      }
    }
  })
  return xs.create({
    start: listener => {
      if (!l) itemBuffer.forEach(({item, error}) => {
        if (item) listener.next(item)
        if (error) listener.error(error)
      })
      l = listener
    },
    stop: () => {
      l = null
      itemBuffer.splice(0, itemBuffer.length)
    }
  })
}

exports.default = fileWatch