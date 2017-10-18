import {default as xs, Subscription, Listener} from 'xstream'

const io = require('socket.io-client')
const feathers = require('feathers/client')
const socketio = require('feathers-socketio/client')


export interface FeathersRequest {
  service: string,
  method: string,
  id?: string,
  data?: any,
  params?: any,
  extra?: any
}
export type FeathersRequestStream = xs<any> & {request: FeathersRequest}

export function makeFeathersDriver(socketURL: string) {
  return function feathersDriver(request$: xs<any>) {

    const socket = io(socketURL)
    const client = feathers()
      .configure(socketio(socket))

    const services = new Map<string, any>()

    let unsub = null as Subscription

    function getService(name: string) {
      let service = services.get(name)
      if (!service) {
        service = client.service(name)
        services.set(name, service)
      }
      return service
    }

    const response$ = xs.create<FeathersRequestStream>({
      start(listener) {
        unsub = request$.subscribe({
          next(request: FeathersRequest) {
            const {service: name, method, id, data, params, extra} = request

            const service = getService(name)
            const stream = xs.fromPromise(service[method].apply(service,
              [id, data, params].filter(x => x !== undefined)
            )) as FeathersRequestStream
            stream.request = request
            // A bit of a hack here. If you use the same
            // params as the docs, it'll be fine, okay
            listener.next(stream)

            const projects = client.service('/projects')
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
        const service = getService(name)
        let cb = null as any

        return xs.create<any>({
          start(listener) {
            cb = (x: any) => listener.next(x)
            service.on(type, cb)
          },
          stop() {
            service.removeListener(type, cb)
          }
        })
      },
      response(matchParams: {} = {}): xs<FeathersRequestStream> {
        const keys = Object.keys(matchParams)
        return response$.filter(({request}) =>
          keys.every(key => matchParams[key] === request[key])
        )
      }
    }
  }
}
