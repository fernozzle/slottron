import {run} from '@cycle/run'
import {makeDOMDriver, div} from '@cycle/dom'
const Collection = require('@cycle/collection').default
import xs from 'xstream'

import {routerify} from 'cyclic-router'
import {makeHashHistoryDriver} from '@cycle/history'
import switchPath from 'switch-path'

import {makeFeathersDriver, FeathersRequestStream} from './feathers-driver'

function ListingItem(sources: {datum: any, removeAll$: xs<{}>, updateAll$: xs<{}>}) {
  const isOurs = (x: any) => x.path === sources.datum.path

  const datum$ = sources.updateAll$.filter(isOurs).startWith(sources.datum)
  return {
    DOM: datum$.map((datum: any) =>
      div('.item', {class: {'fake': !datum.isReal}}, `What is popping, James? ` + JSON.stringify(datum))
    ).remember(),
    remove$: sources.removeAll$.filter(isOurs)
  }
}

function main(sources : any) {
  const {DOM, Feathers} = sources

  const match$ = sources.router.define({
    '/': 'home sweet home',
    '/other': 'nice other place',
    '/projects': {
      '/': 'all projects ever',
      '/:id': (id: string) => `the project with id ${id}`
    }
  })
  const page$ = match$.map(({path, value}: {path: string, value: any}) => {
    console.log('We are at', path, 'which is', value)
    console.log('Thongo', sources.router.path(path))
  })
  page$.addListener({})

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
    router: xs.never(),
    Feathers: xs.of({
      service: 'items/',
      method: 'find',
      extra: 'HELLO IT IS ME'
    })
  }
}

run(routerify(main, switchPath), {
  DOM: makeDOMDriver('#main'),
  history: makeHashHistoryDriver(),
  Feathers: makeFeathersDriver('http://localhost:3030')
})