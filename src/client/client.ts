import {run} from '@cycle/run'
import {makeDOMDriver, div, input, nav, p, span, a, i, button, DOMSource, aside, ul, li, section, header, h1, figure, img} from '@cycle/dom'
import Collection from '../collection'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'
import dropRepeats from 'xstream/extra/dropRepeats'

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
    '/projects': {
      '/': null,
      '/:id':  id => ({project: id}),
      '/:id/step/:jd': (id, jd) => ({project: id, step: jd}),
    },
  }) as xs<RouteMatcherReturn>
  match$.addListener({next: ({path, value}: {path: string, value: any}) => {
    console.log(`We are at '${path}', which is`, value)
  }})


  // Fetch items

  function ItemComponent(sources: any) {
    const {Item} = sources
    const vnode$ = Item.state$.map(d => div(
      '.column.is-half',
      [
        div('.item.media', {class: {'fake': !d.isReal}}, [
          figure('.media-left', {style: {backgroundImage: 'url(https://bulma.io/images/placeholders/128x128.png)'}}),
          div('.media-content', [
            p('.title.is-5', d.path),
            p('.subtitle.is-6', ['From ', i(d.group)])
          ]),
          div('.media-right', a('.has-text-grey-dark', [span('.icon', [i('.fa.fa-chevron-down')])]))
        ])
      ]
    ))
/*     const vnode$ = Item.state$.map(d => div('.item',
      {class: {'fake': !d.isReal}},
      `What is popping, James? ` + JSON.stringify(d)
    )) */
    return {DOM: vnode$}
  }
  const itemSinks$ = match$.map(({value}) => {
    const query = value.project && {project: value.project}
    return Feathers.collectionStream({
      service: 'items/',
      query,
      item: ItemComponent,
      collectSinks: instances => ({
        DOM: instances.pickCombine('DOM')
      })
    })(sources)
  })

  // Fetch projects
  const sidebarComp = SidebarComp(sources)

  const vtree$ = xs.combine(
    itemSinks$.map(sinks => sinks.DOM).flatten(),
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
          div('.level', [
            div('.level-left', [p('.title.is-3', 'Storyboards')]),
            div('.level-right', [
              div('.navbar-tabs', [
                a('.navbar-item.is-tab.is-active', 'A/Z'),
                a('.navbar-item.is-tab', 'Recent'),
                a('.navbar-item.is-tab', 'Is Done')
              ])
            ])
          ]),

          div('.step-section.columns.is-multiline', list),
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
    ).compose(dropRepeats()),
    Feathers: xs.merge(
      itemSinks$.map(sinks => sinks.Feathers).flatten(),
      sidebarComp.Feathers
    )
  }
}

run(routerify(main, switchPath), {
  DOM: makeDOMDriver('#main'),
  history: makeHashHistoryDriver(),
  Feathers: feathersDriver
})