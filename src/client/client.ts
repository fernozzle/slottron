import {run} from '@cycle/run'
import {makeDOMDriver, div} from '@cycle/dom'
import xs from 'xstream'

import {makeFeathersDriver, FeathersRequestStream} from './feathers-driver'


/*
// Fetch entries
projects.find().then((results:any) => {
  console.log('Projects:', results)
})

// Listen for events
projects.on('created', (datum: any) => {
  console.log('Project added:', datum)
})

// Create entries
const button = document.querySelector('#new-project')
const name = document.querySelector('#name') as HTMLInputElement
button.addEventListener('click', () => {
  projects.create({
    path: `./${name.value}`,
  })
})

*/

const drivers = {
  DOM: makeDOMDriver('#main'),
  Feathers: makeFeathersDriver('http://localhost:3030')
}

run(function App(sources : any) {
  const {DOM, Feathers} = sources

  Feathers.listen({service: 'items/', type: 'created'}).addListener({
    next: (x: any) => {
      console.log('LISTEN', x)
    }
  })

  Feathers.response({}).addListener({
    next: (result$: FeathersRequestStream) => {
      console.log('NEW FEATHERS REQUEST!', result$)
      result$.addListener({
        next: result => {
          console.log(`result to ${result$.request.extra}:`, result)
        }
      })
    }
  })

  const vtree$ = xs.of(
    div('My Awesome Cycle.js app')
  )

  return {
    DOM: vtree$,
    Feathers: xs.of({
      service: 'items/',
      method: 'find',
      extra: 'HELLO IT IS ME'
    })
  }
}, drivers)