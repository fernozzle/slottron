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

  const itemSinks = Feathers.collectionStream('items/', sources => {
    const {datum$, DOM} = sources
    const vnode$ = datum$.map(d => div( '.item',
      {class: {'fake': !d.isReal}},
      `What is popping, James? ` + JSON.stringify(d)
    ))
    return {DOM: vnode$}
  }, datum => datum.id, {DOM: sources.DOM})
  const itemsVtree$ = xs.merge(
    itemSinks.Feathers,
    itemSinks.collection$.map(
      c => Collection.pluck(c, sinks => sinks.DOM)
    ).flatten()
  )

  // Fetch projects

  const projectsSinks = Feathers.collectionStream('projects/', sources => {
    const {datum, datum$, DOM} = sources

    const request$ = DOM.select('.remove').events('click')
      .mapTo({service: 'projects/', method: 'remove', id: datum._id})

    const vnode$ = datum$.map(d => div([
      `Project ${d._id}: ${JSON.stringify(d)} `,
      input('.remove', {attrs: {value: '\u274c Remove', type: 'button'}})
    ]))

    return {DOM: vnode$, Feathers: request$}
  }, datum => datum._id, {DOM: sources.DOM})

  const projectsVtree$ = projectsSinks.collection$.map(
    c => Collection.pluck(c, sinks => sinks.DOM)
  ).flatten()
  const projectsRequest$ = xs.merge(
    projectsSinks.Feathers,
    projectsSinks.collection$.map(
      c => Collection.merge(c, sinks => sinks.Feathers)
    ).flatten()
  )

  const vtree$ = xs.combine(
    itemsVtree$,
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
      itemSinks.Feathers,
      projectsRequest$,
      addProject$,
      clearProject$,
    )
  }
}

run(routerify(main, switchPath), {
  DOM: makeDOMDriver('#main'),
  history: makeHashHistoryDriver(),
  Feathers: feathersDriver
})