import {default as xs, Subscription, Listener} from 'xstream'
import * as feathers from 'feathers/client'
import Collection from './collection'

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
      },

      /**
       * Convenience function that uses `listen()` and `response()` and returns requests to make
       */
      collectionStream<
        Name extends keyof S,
        Passed extends {},
        Added extends {datum: S[Name], datum$: xs<S[Name]>, remove$: xs<S[Name]>},
        Sinks extends {}
      >(
        service: Name,
        component: (sources: Passed & Added) => Sinks,
        idSelector?: (model: S[Name]) => string | number,
        passedSources?: Passed,
        fetch$ = xs.empty()
      ) {
        function sameID(datum: any) {
          return (other: any) => idSelector(datum) === idSelector(other)
        }
        const collection$ = this.response({
          service, method: 'find'
        }).flatten().map(({data}: feathers.Pagination<S[Name]>) => {

          const sourcesOfAnAdd$ = xs.merge(
            xs.fromArray(data),
            this.listen({service, on: 'created'})
          ).map((datum: any) => ({
            datum, // For those who seek synchonosity
            datum$: this.listen({service, on: 'patched'})
              .filter(sameID(datum)).startWith(datum),
            remove$: this.listen({service, on: 'removed'})
              .filter(sameID(datum))
          })) as xs<Added>

          return Collection(
            (sources: Passed & Added) => Object.assign(
              {remove$: sources.remove$},
              component(sources)
            ),
            passedSources,
            sourcesOfAnAdd$,
            (sinks: any) => sinks.remove$,
            (sources: Passed & Added) => idSelector(sources.datum)
          )
        }) as xs<xs<Sinks[]>>

        const request$ = xs.merge(
          fetch$, xs.of(null)
        ).mapTo({
          service, method: 'find'
        }) as xs<RequestBase<typeof service, 'find'>>

        return {collection$, Feathers: request$}
      }
    }
  }
}

