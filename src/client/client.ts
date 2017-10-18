import {run} from '@cycle/run'
import {makeDOMDriver, div} from '@cycle/dom'
const Collection = require('@cycle/collection').default
import xs from 'xstream'

import {makeFeathersDriver, FeathersRequestStream} from './feathers-driver'

function ListingItem(sources: {datum: any, removeAll$: xs<{}>, updateAll$: xs<{}>}) {
  const isOurs = (x: any) => x.path === sources.datum.path

  const datum$ = sources.updateAll$.filter(isOurs).startWith(sources.datum)
  return {
    DOM: datum$.map((datum: any) =>
      div(`What is popping, James? ` + JSON.stringify(datum))
    ).remember(),
    remove$: sources.removeAll$.filter(isOurs)
  }
}

const drivers = {
  DOM: makeDOMDriver('#main'),
  Feathers: makeFeathersDriver('http://localhost:3030')
}

run(function App(sources : any) {
  const {DOM, Feathers} = sources

  const add$ = xs.merge(
    Feathers.response({service: 'items/', method: 'find'})
      .flatten() // Flatten xs<Promise>
      .map(({data}: {data: any}) => xs.fromArray(data || []))
      .flatten(), // Flatten xs<Item[]> into xs<Item>
    Feathers.listen({service: 'items/', type: 'created'})
  ).map((datum: any) => ({datum}))

  const removeAll$ = Feathers.listen({service: 'items/', type: 'removed'})
  const updateAll$ = Feathers.listen({service: 'items/', type: 'patched'})
  const listItems$ = Collection(ListingItem, {removeAll$, updateAll$}, add$, (item: any) => {
    return item.remove$
  })
  const listItemDOMs$ = Collection.pluck(listItems$, (item: any) => item.DOM)

  const vtree$ = listItemDOMs$.map((vtrees: any) => div(vtrees))

  return {
    DOM: vtree$,
    Feathers: xs.of({
      service: 'items/',
      method: 'find',
      extra: 'HELLO IT IS ME'
    })
  }
}, drivers)