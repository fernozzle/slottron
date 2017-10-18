import {default as xs, Subscription} from 'xstream'

const io = require('socket.io-client')
const feathers = require('feathers/client')
const socketio = require('feathers-socketio/client')


export interface FeathersRequest {
  service: string,
  method: string,
  id?: string,
  data?: any,
  params?: any,
  category?: any
}
export type FeathersRequestStream = xs<any> & {request: FeathersRequest}

export function makeFeathersDriver(socketURL: string) {
  return function feathersDriver(request$: xs<any>) {

    const socket = io(socketURL)
    const client = feathers()
      .configure(socketio(socket))

    const services = new Map<string, any>()

    let unsub = null as Subscription

    const response$ = xs.create<FeathersRequestStream>({
      start(listener) {
        unsub = request$.subscribe({
          next(request: FeathersRequest) {
            const {service: name, method, id, data, params, category} = request

            if (!services.has(name))
              services.set(name, client.service(name))
            const service = services.get(name)

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

    return {select(key = '*'): xs<FeathersRequestStream> {
      return response$.filter(x => key === '*' || key === x.request.category)
    }}
  }
}
