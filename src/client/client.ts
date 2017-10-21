import {run} from '@cycle/run'
import {makeDOMDriver, div, input, nav, p, span, a, i, button, DOMSource, aside, ul, li, section} from '@cycle/dom'
import Collection from '../collection'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

import {routerify, RouteMatcherReturn} from 'cyclic-router'
import {makeHashHistoryDriver} from '@cycle/history'
import switchPath from 'switch-path'
import * as feathers from 'feathers/client'
import * as socketio from 'feathers-socketio/client'
const io = require('socket.io-client')

import {makeFeathersDriver, makeFeathersSource} from '../feathers-driver'
import {SlottronModels} from '../common'

require('../style/index.sass')
import SidebarComp from './comp-sidebar'

const client = feathers().configure(socketio(io('http://localhost:3030')))

const feathersDriver = makeFeathersDriver<SlottronModels>(client)
const feathersSource = makeFeathersSource<SlottronModels>()

function main(sources : {DOM: DOMSource, Feathers: typeof feathersSource, router: any}) {
  const {DOM, Feathers} = sources

  const match$ = sources.router.define({
    '/': 'home sweet home',
    '/other': 'nice other place',
    '/projects': {
      '/': 'all projects ever',
      '/:id': (id: string) => `the project with id ${id}`
    }
  }) as xs<RouteMatcherReturn>
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
  const itemsVtree$ = itemSinks.collection$.map(
    c => Collection.pluck(c, sinks => sinks.DOM)
  ).flatten().map(nodes => div('.column', nodes))

  // Fetch projects
  const sidebarComp = SidebarComp(sources)

  const vtree$ = xs.combine(
    itemsVtree$,
    sidebarComp.DOM
  ).map(([list, project]) => div('.columns.is-fullheight',
    [
      project,
      list
    ]
  ))

  return {
    DOM: vtree$,
    router: xs.merge(
      Feathers.response({service: 'projects/', method: 'create'})
        .flatten().map(x => `/projects/${x._id}`),
      sidebarComp.router
    ),
    Feathers: xs.merge(
      itemSinks.Feathers,
      sidebarComp.Feathers
    )
  }
}

run(routerify(main, switchPath), {
  DOM: makeDOMDriver('#main'),
  history: makeHashHistoryDriver(),
  Feathers: feathersDriver
})