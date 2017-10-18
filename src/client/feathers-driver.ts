import {default as xs, Subscription} from 'xstream'

const io = require('socket.io-client')
const feathers = require('feathers/client')
const socketio = require('feathers-socketio/client')


interface FeathersRequest {
  service: string,
  method: string,
  id?: string,
  data?: any,
  params?: any,
  category?: any
}
export type RequestStream = xs<any> & {request: any}

export default function makeFeathersDriver(socketURL: string) {
  return function feathersDriver(request$: xs<any>) {

    const socket = io(socketURL)
    const client = feathers()
      .configure(socketio(socket))

    const services = new Map<string, any>()

    let unsub = null as Subscription

    const response$ = xs.create<{category: any, stream: RequestStream}>({
      start(listener) {
        unsub = request$.subscribe({
          next(request: FeathersRequest) {
            const {service: name, method, id, data, params, category} = request

            if (!services.has(name))
              services.set(name, client.service(name))
            const service = services.get(name)

            const stream = xs.fromPromise(service[method].apply(service,
              [id, data, params].filter(x => x !== undefined)
            )) as RequestStream
            stream.request = request
            // A bit of a hack here. If you use the same
            // params as the docs, it'll be fine, okay
            listener.next({ category, stream })

            const projects = client.service('/projects')
          },
          error(e) { listener.error(e) },
          complete() { listener.error('Feathers driver sink completed.') }
        })
      },
      stop() { if (unsub) unsub.unsubscribe() }
    })

    return {select(key = '*') {
      return response$.filter(x => key === '*' || key === x.category)
    }}
  }
}
