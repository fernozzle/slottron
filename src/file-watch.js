const pathModule = require('path')
const xs = require('xstream').default
const pairwise = require('xstream/extra/pairwise').default

const pattern = require('./pattern')

const rootCaptureStep = {pattern: '<*>'} // There's only 1 everything

function fileWatch({fileChange$, watcher, steps}) {
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
        : remove$.map(({change: {query}}) => ({type: 'remove', path: query}))
          .startWith({type: 'add', path: query})
      return streamsMap.set(query, queryEvent$)
    }, new Map())
    .compose(gather)

    return {
      allChange$: xs.merge(allChange$, listingChange$.map(x => {
        return Object.assign({step: i}, x)
      })),
      stepChange$: listingChange$
    }
  }, {
      allChange$: xs.never(),
      stepChange$: xs.merge(
        xs.of({type: 'add', path: './'}), xs.never()
      )
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
      for (const [query, stream] of streamsMap) {
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