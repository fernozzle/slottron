import {run} from '@cycle/run'
import {makeDOMDriver, div, input, DOMSource} from '@cycle/dom'
import Collection from '../collection'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

import {routerify} from 'cyclic-router'
import {makeHashHistoryDriver} from '@cycle/history'
import switchPath from 'switch-path'

import {makeFeathersDriver, FeathersRequestStream} from '../feathers-driver'

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

const feathersDriver = makeFeathersDriver<{
  'items/': {project: string, path: string, isReal: boolean, group: string, id: any},
  'projects/': {createdAt: string, path: string, _id: string}
}>('http://localhost:3030')

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

  const removeAll$ = Feathers.listen({service: 'items/', type: 'removed'})
  const updateAll$ = Feathers.listen({service: 'items/', type: 'patched'})
  const listItems$ = Collection(ListingItem, {removeAll$, updateAll$}, add$,
    (item: any) => item.remove$,
    (sources: any) => console.log('id selector', sources.datum)
  )
  const listItemDOMs$ = Collection.pluck(listItems$, (item: any) => item.DOM)

  // Fetch projects

  Feathers.response({service: 'projects/', method: 'find'})
  .flatten().map(x => x.data)
  .addListener({
    next(x) { console.log('projects', x) }
  })

  const vtree$ = listItemDOMs$.map((vtrees: any) => div(
    [
      div([
        input('.proj-path', {attrs: {placeholder: 'Path'}}),
        input('.proj-add', {attrs: {type: 'button', value: 'Add project'}}),
        input('.proj-clear', {attrs: {type: 'button', value: 'Clear projects'}})
      ]),
      div(vtrees)
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
      addProject$,
      clearProject$,
      xs.of(
        {
          service: 'items/',
          method: 'find',
          extra: 'HELLO IT IS ME'
        } as any,
        {
          service: 'projects/',
          method: 'find'
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