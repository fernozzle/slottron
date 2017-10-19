import {default as xs, Subscription, Listener} from 'xstream'

import * as feathers from 'feathers/client'

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

    return {
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
      }
    }
  }
}
