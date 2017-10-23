import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'
import {DOMSource, VNode, div, section, nav, a, span, i, p, aside, ul, li, input} from '@cycle/dom'

import {makeFeathersSource} from '../feathers-driver'
import {SlottronModels, primaryKey} from '../common'

import Collection from '../collection'

const feathersSource = makeFeathersSource<SlottronModels>()

export default function SidebarComp(sources: {
  Feathers: typeof feathersSource,
  DOM: DOMSource,
  router: xs<any>
}) {
  const {Feathers, DOM} = sources

  function ItemComponent(sources: any) {
    const {Item: {state$}, DOM, service} = sources
    DOM.select('.panel-block').events('click')

    const path$ = DOM.select('.SL-choose').events('click')
      .debug(e => console.log('event', e))
      .compose(sampleCombine(state$))
      .map(([, item]) => `/projects/${item[primaryKey]}`)

    const vnode$ = state$.map(d => li([ a('.SL-choose', [
      span('.icon.is-left', [i('.fa.fa-folder')]),
      d.path
    ]) ]))

    return {DOM: vnode$, router: path$}
  }
  const itemSinks = Feathers.collectionStream({
    service: 'projects/',
    // query: null,
    item: ItemComponent,
    collectSinks: instances => ({
      DOM: instances.pickCombine('DOM'),
      router: instances.pickMerge('router')
    })
  })(sources)

  const vtree$ = itemSinks.DOM.map(nodes => div(
    '.sidebar',
    [
      div('.sidebar-pages', [
        div('.sidebar-page', [UserPage(nodes)]),
        // div('.sidebar-page', [ProjectPage(items)]),
      ])
    ]
  ))
  const request$ = xs.merge(
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
    itemSinks.Feathers
  )

  return {
    Feathers: request$,
    DOM: vtree$,
    router: itemSinks.router
  }
}

function ProjectPage(items: VNode[]) {
  return div([
    section('.hero', [
      div('.hero-head', [
        nav('.level', [
          div('.level-left'),
          div('.level-right', [
            a('.button', [
              span('.icon', [i('.fa.fa-cog')])
            ])
          ])
        ])
      ]),
      div('.hero-body', [
        div('.container', [
          p('.title', 'The Show'),
          p('.subtitle', 'Episode 7')
        ])
      ]),
    ]),
    aside('.menu', [
      ul('.menu-list', [
        li([a([
          span('.icon.is-left', [i('.fa.fa-indent')]),
          'Slots',
          span('.tag.is-danger', {style: {marginLeft: '.5em'}},'3'),
        ])]),
        li([a([
          span('.icon.is-left', [a('.fa.fa-users')]),
          'Members'
        ])]),
      ]),
      p('.menu-label', [nav('.level', [
        div('.level-left', [ 'Steps' ]),
        div('.level-right', [ a('.button.is-small', [span('.icon', [i('.fa.fa-pencil')])]) ])
      ])]),
      ul('.menu-list', [
        li([a('', [
          span('.icon.is-left.has-text-danger', [i('.fa.fa-circle-o')]),
          'Storyboard pages'
        ])]),
        li([a('', [
          span('.icon.is-left.has-text-warning', [i('.fa.fa-circle-o')]),
          'Line regions'
        ])]),
        li([a('', [
          span('.icon.is-left.has-text-success', [i('.fa.fa-circle-o')]),
          'Voice acting'
        ])]),
        li([a('', [
          span('.icon.is-left.has-text-info', [i('.fa.fa-circle-o')]),
          'Voice FX'
        ])]),
      ]),
    ])
  ])
}

function UserPage(items: VNode[]) {
  return div([
    section('.hero', [
      div('.hero-head', [
        nav('.level', [
          div('.level-left'),
          div('.level-right', [
            a('.button', [
              span('.icon', [i('.fa.fa-cog')])
            ])
          ])
        ])
      ]),
      div('.hero-body', [
        div('.container', [
          p('.title', 'The Show'),
          p('.subtitle', 'Episode 78')
        ])
      ]),
    ]),
    aside('.menu', [
      ul('.menu-list', [
        li([a([
          span('.icon.is-left', [i('.fa.fa-user-circle')]),
          `My slots`,
          span('.tag.is-primary', {style: {marginLeft: '.5em'}},'3')
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
            span('.icon.is-left', [i('.fa.fa-link')]),
            span('.icon.is-right', [i('.fa.fa-plus')])
          ])
        ]),
        ...items,
      ]),
    ])
  ])
}