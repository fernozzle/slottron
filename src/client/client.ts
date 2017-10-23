import {run} from '@cycle/run'
import {makeDOMDriver, div, input, nav, p, span, a, i, button, DOMSource, aside, ul, li, section, header} from '@cycle/dom'
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
    '/deebee': 'the deeb land',
    '/projects': {
      '/': 'all projects ever',
      '/:id':  id => `Home of project ${id}`,
      '/:id/members/:jd': (id, jd) => `Project ${id}, member ${jd}`,
    },
  }) as xs<RouteMatcherReturn>
  const page$ = match$.map(({path, value}: {path: string, value: any}) => {
    console.log('We are at', path, 'which is', value)
    console.log('Thongo', sources.router.path(path))
  })
  page$.addListener({})

  // Fetch items

  function ItemComponent(sources: any) {
    const {Item} = sources
    const vnode$ = Item.state$.map(d => div('.item',
      {class: {'fake': !d.isReal}},
      `What is popping, James? ` + JSON.stringify(d)
    ))
    return {DOM: vnode$}
  }
  const itemSinks = Feathers.collectionStream({
    service: 'items/',
    query: null,
    item: ItemComponent,
    collectSinks: instances => ({
      DOM: instances.pickCombine('DOM')
    })
  })(sources)

  // Fetch projects
  const sidebarComp = SidebarComp(sources)

  const vtree$ = xs.combine(
    itemSinks.DOM,
    sidebarComp.DOM
  ).map(([list, project]) => div('.root',
    [
      project,
      div('.main-container', [
        nav('.navbar', [
          header('.navbar-item', [
            i('.fa.fa-circle-o.is-left.has-text-danger'),
            'Storyboards'
          ]),
          div('.navbar-tabs', [
            a('.navbar-item.is-tab.is-active', 'List'),
            a('.navbar-item.is-tab', 'Edit'),
          ])
        ]),
        div('.main-card', [
          p(list)
        ])
      ])
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