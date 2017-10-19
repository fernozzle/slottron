import {default as xs, Subscription, Listener} from 'xstream'

const io = require('socket.io-client')
import * as feathers from 'feathers/client'
import * as socketio from 'feathers-socketio/client'

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
  S, M extends FeathersRequest<S, keyof S>['method']
> = xs<Result<S[keyof S]>[M]> & {request: FeathersRequest<S, keyof S>}

interface Result<T> {
  find: feathers.Pagination<T>,
  get: T,
  create: T,
  update: T,
  patch: T,
  remove: T
}

export function makeFeathersDriver<S>(socketURL: string | feathers.Application) {
  type R = FeathersRequest<S, keyof S>

  const client = (typeof socketURL === 'string')
    ? feathers().configure(socketio(io(socketURL)))
    : socketURL

  return function feathersDriver(request$: xs<R>) {
    let unsub = null as Subscription
    const response$ = xs.create<FeathersRequestStream<S, R['method']>>({
      start(listener) {
        unsub = request$.subscribe({
          next(request: R) {
            const {service: name, method, id, data, params, extra} = request

            const service = client.service(name)
            const stream = xs.fromPromise(service[method].apply(service,
              [id, data, params].filter(x => x !== undefined)
            )) as FeathersRequestStream<S, typeof method>
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
      listen({service: name, type}: {service: string, type: string}) {
        const service = client.service(name)
        let cb = null as any
        return xs.create<any>({
          start(listener) {
            cb = (x: any) => listener.next(x)
            service.on(type, cb)
          },
          stop() { service.removeListener(type, cb) }
        })
      },
      response<T extends Partial<R>>(matchParams = {} as T): xs<FeathersRequestStream<S, T['method']>> {
        const keys = Object.keys(matchParams)
        return response$.filter(({request}) =>
          keys.every(key => matchParams[key] === request[key])
        )
      }
    }
  }
}
