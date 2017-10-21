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

import {makeFeathersDriver} from '../feathers-driver'
import {SlottronModels} from '../common'

require('../style/index.sass')

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

  const projectsSinks = Feathers.collectionStream('projects/', sources => {
    const {datum, datum$, DOM} = sources

    const path$ = DOM.select('.panel-block').events('click')
      .mapTo(`/projects/${datum._id}`)

    const vnode$ = datum$.map(d => li([
      // span('.panel-icon', [i('.fa.fa-folder')]),
      a([
        span('.icon.is-left', [i('.fa.fa-folder')]),
        d.path
      ])
    ]))

    return {DOM: vnode$, router: path$}
  }, datum => datum._id, {DOM: sources.DOM})

  const projectsVtree$ = projectsSinks.collection$.map(
    c => Collection.pluck(c, sinks => sinks.DOM)
  ).flatten().map(items => div('.column.is-narrow', {style: {width: '300px'}}, [
    section('.hero.is-light', [
      div('.hero-body', [
        div('.container', [
          p('.title', 'Light title'),
          p('.subtitle', 'Light subtitle')
        ])
      ])
    ]),
    aside('.menu', [
      ul('.menu-list', [
        li([a([
          span('.icon.is-left', [i('.fa.fa-user-circle')]),
          `My slots`,
          span('.tag.is-danger', {style: {marginLeft: '.5em'}},'3')
        ])]),
      ]),
      p('.menu-label', [nav('.level', [
        div('.level-left', [ 'Projects' ]),
        div('.level-right', [ a('.SL-projects-clear.button.is-small', 'Clear') ])
      ])]),
      ul('.menu-list', [
        li([
          p('.control.has-icons-left.has-icons-right', [
            input('.SL-projects-new.input.is-small', {
              key: Math.random(),
              attrs: {type: 'text', placeholder: 'New project path...'}
            }),
            span('.icon.is-small.is-left', [i('.fa.fa-link')]),
            span('.icon.is-small.is-right', [i('.fa.fa-plus')])
          ])
        ]),
        ...items,
      ]),
    ])
  ]))
  const projectsRequest$ = xs.merge(
    DOM.select('.SL-projects-new').events('keydown')
      .filter((e: KeyboardEvent) => e.keyCode === 13)
      .map(e => ({
        service: 'projects/',
        method: 'create',
        data: {path: (e.target as HTMLInputElement).value}
      })),
    DOM.select('.SL-projects-clear').events('click').mapTo({
      service: 'projects/',
      method: 'remove',
      id: null
    }),
    projectsSinks.Feathers,
  )
  const projectsPath$ = projectsSinks.collection$.map(
    c => Collection.merge(c, sinks => sinks.router)
  ).flatten()

  const vtree$ = xs.combine(
    itemsVtree$,
    projectsVtree$
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
      projectsPath$
    ),
    Feathers: xs.merge(
      itemSinks.Feathers,
      projectsRequest$
    )
  }
}

run(routerify(main, switchPath), {
  DOM: makeDOMDriver('#main'),
  history: makeHashHistoryDriver(),
  Feathers: feathersDriver
})