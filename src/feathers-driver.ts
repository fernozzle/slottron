/**
 * Everyone. Come around, come around.
 *
 * Welcome to the home of the world's most awe-inspiring function.
 */

import {default as xs, Subscription, Listener, MemoryStream} from 'xstream'
import * as feathers from 'feathers/client'
import {makeCollection, StateSource, Instances} from 'cycle-onionify'
import {SlottronModels, primaryKey} from './common'

import {matcher} from 'feathers-commons'

interface RequestBase<S, M> {service: S, method: M, params: feathers.Params, [key: string]: any}
interface IDPart {id: number | string}
interface DataPart<T> {data: T}
export type FeathersRequest<Services, Name extends keyof Services> =
  RequestBase<Name, 'find'> |
  RequestBase<Name, 'get'> & IDPart |
  RequestBase<Name, 'create'> & DataPart<Services[Name]> |
  RequestBase<Name, 'update'> & IDPart & DataPart<Services[Name]> |
  RequestBase<Name, 'patch'> & IDPart & DataPart<Services[Name]> |
  RequestBase<Name, 'remove'> & IDPart

/**
 * Before we begin, I want to set the stage. We all witness a
 * great variety of functions in our lives. Some provide a
 * robust typing, while many do not. Some exceed expectations.
 *
 * And now...
 */

export type FeathersRequestStream<
  S, Name extends keyof S, M extends FeathersRequest<S, Name>['method']
> = xs<Result<S[Name]>[M]> & {request: FeathersRequest<S, Name>}

interface Result<T> {
  find: feathers.Pagination<T>,
  get: T,
  create: T,
  update: T,
  patch: T,
  remove: T
}
const CHANNEL_NAME = 'Item'

/**
 * The world's most awe-inspiring function.
 */
export function makeFeathersSource<Model extends {}>() {
  const client = null as feathers.Application
  const feathersDriver = (false as true) && makeFeathersDriver<Model>(client)
  const feathersSource = (false as true) && feathersDriver(null)
  return undefined as typeof feathersSource
}

export function makeFeathersDriver<S>(client: feathers.Application) {
  type R = FeathersRequest<S, keyof S>

  return function feathersDriver(request$: xs<R>) {
    let unsub = null as Subscription
    const response$ = xs.create<FeathersRequestStream<S, keyof S, R['method']>>({
      start(listener) {
        unsub = request$.subscribe({
          next(request: R) {
            const {service: name, method, id, data, params, extra} = request

            const service = client.service(name)
            const stream = xs.fromPromise(service[method].apply(service,
              [id, data, params].filter(x => x !== undefined)
            )) as FeathersRequestStream<S, typeof name, typeof method>
            stream.request = request
            // A bit of a hack here. If you use the same
            // params as the docs, it'll be fine, okay
            listener.next(stream)
          },
          error(e) { listener.error(e) },
          complete() { listener.error('Feathers driver sink completed.') }
        })
      },
      stop() { if (unsub) unsub.unsubscribe() }
    })
    response$.addListener({})

    const source = {
      listen<T extends Partial<R>>({service: name, on}: T) {
        const service = client.service(name)
        let cb = null as any
        return xs.create<S[T['service']]>({
          start(listener) {
            cb = (x: any) => listener.next(x)
            service.on(on, cb)
          },
          stop() { service.removeListener(on, cb) }
        })
      },
      response<T extends Partial<R>>(matchParams: T): xs<FeathersRequestStream<S, T['service'], T['method']>> {
        const keys = Object.keys(matchParams)
        return response$.filter(({request}) =>
          keys.every(key => matchParams[key] === request[key])
        )
      },

      /**
       * Convenience function that uses `listen()` and `response()` and returns requests to make
       */
      collectionStream<
        Name extends keyof S,
        Passed extends {},
        Added extends {
          datum: S[Name],
          datum$: MemoryStream<S[Name]>,
          remove$: xs<S[Name]>,
          service: feathers.Service<S[Name]> & {path: string} // Grr
        },
        Sinks extends {}
      >(opts: {
        service: Name,
        query?: any,
        item: ({}) => ({}),
        collectSinks: (instances: Instances<any>) => any,
        fetch$?: xs<any>
      }) {

        const {service, item, query} = opts
        const serv = client.service(service) as feathers.Service<S[Name]> & {path: string}
        function sameID(datum: any) {
          return (other: any) => datum[primaryKey] === other[primaryKey]
        }

        const matches = matcher(query)
        const params = Object.keys(query || {}).length > 0 ? {params: {query}} : {}
        console.log('query is', params)

        const that = this as typeof source

        const req = { service, method: 'find', ...params } as any
        const state$ = that.response(req).flatten().map(({data}) => {
          console.log('result is', data)
          const initDict = new Map(data.map(
            item => [item[primaryKey], item]
          )) as Map<string, S[Name]>
          return xs.merge(
            that.listen({service, on: 'created'}),
            that.listen({service, on: 'patched'}),
            that.listen({service, on: 'removed'})
              .map(x => Object.assign({'__delete__': true}, x))
          ).fold((dict, item) => {
            const id = item[primaryKey]
            const itMatches = matches(item)
            console.log('does', item, 'match with', query, '?', itMatches)
            if (!item['__delete__'] && itMatches) {
              dict.set(id, item)
              return dict
            }
            dict.delete(id)
            return dict
          }, initDict).map(dict => [...dict.values()])
        }).flatten()

        const addedSources = {
          service: serv,
          [CHANNEL_NAME]: new StateSource(state$, `Items of ${service}`)
        }

        const collect = makeCollection({
          item,
          collectSinks: instances => {
            const sinks = opts.collectSinks(instances)
            const newFeathers = xs.merge(
              sinks.Feathers || xs.never(), // The items' sink
              xs.merge(
                xs.of(null), // Ensure there's one initial request
                opts.fetch$ || xs.empty(), // Add fetch$
              ).mapTo(req) as xs<RequestBase<typeof service, 'find'>>
            )
            return {...sinks, Feathers: newFeathers}
          },
          itemScope: key => key,
          itemKey: item => item[primaryKey],
          channel: CHANNEL_NAME
        })

        return (sources) => collect({...sources, ...addedSources})
      }
    }
    return source
  }
}

/**
 * Nothing beats it.
 */

