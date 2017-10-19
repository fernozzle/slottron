import {run} from '@cycle/run'
import {makeDOMDriver, div, input, DOMSource} from '@cycle/dom'
import Collection from '../collection'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

import {routerify} from 'cyclic-router'
import {makeHashHistoryDriver} from '@cycle/history'
import switchPath from 'switch-path'
import * as feathers from 'feathers/client'
import * as socketio from 'feathers-socketio/client'
const io = require('socket.io-client')

import {makeFeathersDriver} from '../feathers-driver'
import {SlottronModels} from '../common'

const client = feathers().configure(socketio(io('http://localhost:3030')))

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

const feathersDriver = makeFeathersDriver<SlottronModels>(client)

const feathersSource = (false as true) && feathersDriver(null) /* Ha */
function main(sources : {DOM: DOMSource, Feathers: typeof feathersSource, router: any}) {
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

  // Fetch items

  const add$ = xs.merge(
    Feathers.response({service: 'items/', method: 'find'})
      .flatten() // Flatten xs<Promise>
      .map(pagination => xs.fromArray(pagination.data || []))
      .flatten(), // Flatten xs<Item[]> into xs<Item>
    Feathers.listen({service: 'items/', type: 'created'})
  ).map((datum: any) => ({datum}))

  const removeAll$ = Feathers.listen({service: 'items/', on: 'removed'})
  const updateAll$ = Feathers.listen({service: 'items/', on: 'patched'})
  const listItems$ = Collection(ListingItem, {removeAll$, updateAll$}, add$,
    item => item.remove$,
    sources => console.log('id selector', sources.datum)
  )
  const listItemDOMs$ = Collection.pluck(listItems$, (item: any) => item.DOM)

  // Fetch projects

  const projectsSinks = Feathers.collectionStream('projects/', sources => {
    const {datum$} = sources
    const vnode$ = datum$.map(d => div(`Project ${d._id}: ${JSON.stringify(d)}`))
    return {DOM: vnode$}
  }, datum => datum._id)

  projectsSinks.collection$.addListener({next(items$: any) {
    console.log('deedoly', items$)
    items$.addListener({next(item: any) { console.log('itam', item) }})
  }})

  const projectsVtree$ = projectsSinks.collection$.map(collection => {
    return Collection.pluck(collection, (sinks: any) => sinks.DOM)
  }).flatten()

  const vtree$ = xs.combine(
    listItemDOMs$,
    projectsVtree$
  ).map(([listItems, projectItems]) => div(
    [
      div([
        div(projectItems),
        input('.proj-path', {attrs: {placeholder: 'Path'}}),
        input('.proj-add', {attrs: {type: 'button', value: 'Add project'}}),
        input('.proj-clear', {attrs: {type: 'button', value: 'Clear projects'}})
      ]),
      div(listItems)
    ]
  ))

  const input$ = DOM.select('.proj-path').events('keyup')
    .map(ev => ev.target['value'])
  const addProject$ = DOM.select('.proj-add').events('click')
    .compose(sampleCombine(input$))
    .map(([click, path]) => ({
      service: 'projects/',
      method: 'create',
      data: {path}
    }))
  const clearProject$ = DOM.select('.proj-clear').events('click')
    .mapTo({
      service: 'projects/',
      method: 'remove',
      id: null,
      params: {query: null}
    })

  return {
    DOM: vtree$,
    router: xs.never(),
    Feathers: xs.merge(
      projectsSinks.Feathers,
      addProject$,
      clearProject$,
      xs.of(
        {
          service: 'items/',
          method: 'find',
          extra: 'HELLO IT IS ME'
        }
      )
    )
  }
}

run(routerify(main, switchPath), {
  DOM: makeDOMDriver('#main'),
  history: makeHashHistoryDriver(),
  Feathers: feathersDriver
})