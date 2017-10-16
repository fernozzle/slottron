const pathModule = require('path')
const xs = require('xstream').default
const pairwise = require('xstream/extra/pairwise').default

const pattern = require('./pattern')

const rootCaptureStep = {pattern: '<*>'} // There's only 1 everything

function fileWatch({fileChange$, watcher, steps}) {
  return arrayPairwise([rootCaptureStep, ...steps]).reduce(
    ({allChange$, stepChange$}, [prevStep, step], i) => {

    // First we collapse into groups...

    const queryChange$ = stepChange$
    .fold(({map}, {type, path, date = new Date()}) => {

      const vars = pattern.read(pattern.parse(prevStep.pattern), path)
      const query = pattern.render(pattern.parse(step.pattern), vars)

      // Add/remove from buckets
      let change = {type: null, query, path, date}
      if (type === 'remove') {
        change.type = 'removeSource'
        if (map.has(query)) {
          const sources = map.get(query).set
          sources.delete(path)
          if (sources.size === 0) {
            map.delete(query) // Remove empty bucket
            change.type = 'remove'
          }
        }
      } else { // add or update
        if (map.has(query)) {
          const queryPaths = map.get(query).set
          if (!queryPaths.has(path)) {
            queryPaths.add(path) // existent bucket
            change.type = 'addSource'
          } else {
            change.type = 'update' // nothing new
          }
        } else {
          map.set(query, {
            set: new Set([path]),
            parsed: pattern.parse(query)
          })
          change.type = 'add' // new bucket
        }
      }
      return {map, change}
    }, {map: new Map(), change: null}).drop(1) // Don't emit seed

    // This goes to the /activity/ service, which should reject items where date <= current value
    const activity$ = queryChange$.map((
      {change: {query, type, path, date}}
    ) => ({
      query, // To be used like a primary key
      path,  // This is the file whose modification updated our query
      date,  // Service has a hook that REJECTS if date <= latest ####### ACTUALLY NO THEY JUST ALL ACCUMULATE AND A REQUEST GETS THE LATEST ONE
      type: ( // What happened to it
        type === 'add' || type === 'addSource'
      ) ? 'add' : (type === 'update' ? 'update' : 'remove'),
    }))

    // ...Then we expand by searching/listening
    listingChange$ = queryChange$.filter(
      x => x.change.type === 'add' // A unique query appears!
    ).fold((streamsMap, {map, change: {type, query}}) => {
      const parsed = map.get(query).parsed
      const remove$ = queryChange$.filter(x => (
        x.change.type === 'remove' &&
        x.change.query === query
      )).take(1)


      // What to do: write an 'expect' function
      //

      const isSmart = (parsed.varNames.length > 0)
      /*
      const queryEvent$ = collection({
        // If live query results are empty, pretend
        // there's 1 fake file there with this name
        fallbackName: pattern.renderDummy(parsed),
        change$: xs.merge(
          xs.from(querySearch(parsed, watcher)) // Synchronous
            .map(path => ({type: 'add', path})),
          fileChange$.filter(queryMatches(parsed)) // Live
        )
      })
      */

      const queryEvent$ = isSmart
        // Branch. This query is but a portal to whatever files exist
        ? trackCollection({query, parsed, remove$, change$: xs.merge(
          xs.from(querySearch(parsed, watcher))
            .map(path => ({type: 'add', path})),
          fileChange$.filter(queryMatches(parsed))
        )}).map(x => {x.query = query; return x})
        // No branching. This query IS the file!
        : xs.merge( // Always exists; realness only changes a property
          xs.of({type: 'add', path: query, query, isReal:
            querySearch(parsed, watcher).length > 0}),
          fileChange$.filter(queryMatches(parsed))
            .map(({type, path}) => ({ // real / imaginary
              type: 'update', path: query, query,
              isReal: type === 'add' || type === 'update'
            }))
            .endWhen(remove$),
          remove$.mapTo({type: 'remove', path: query})
        )
      return streamsMap.set(query, queryEvent$)
    }, new Map())
    .compose(gather)

    return {
      allChange$: xs.merge(
        allChange$,
        activity$,
        listingChange$.map(x => {x.step = i; return x})
      ),
      stepChange$: listingChange$
    }
  }, {
      allChange$: xs.never(),
      stepChange$: xs.merge(
        xs.of({type: 'add', path: './', query: rootCaptureStep.pattern}), xs.never()
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
  return matchingPaths
  //return xs.from(matchingPaths).map(path => ({type: 'add', path}))
}

function trackCollection({parsed, change$, remove$}) {
  const dummyMap = new Map([[pattern.renderDummy(parsed), false]])
  const pathIsRealMap$ = change$.fold((paths, {type, path, date}) => {
    const map = new Map(paths)
    if (type === 'remove') {
      map.delete(path)
    } else { // add or update
      map.set(path, {isReal: true, date: true})
    }
    return map
  }, new Map())

  const stream$ = xs.merge(
    pathIsRealMap$.endWhen(remove$), remove$.mapTo(null)
  ).startWith(null)
  .map(map => map ? (map.size ? map : dummyMap) : new Map())

  // Handling the dummySet requires summing up the changes
  .compose(pairwise)
  .map(([pathsOld, pathsNew]) => {
    const paths = new Map(pathsOld)
    const emit = []
    for (const [path, {isReal, date}] of pathsNew) {
      if (paths.has(path)) {
        paths.delete(path)
        if (date < paths.get(path)) continue
        emit.push({type: 'update', path, isReal})
      } else emit.push({type: 'add', path, isReal})
    }
    paths.forEach(path => emit.push({type: 'remove', path}))
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