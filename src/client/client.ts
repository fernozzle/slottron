import {run} from '@cycle/run'
import {makeDOMDriver, div} from '@cycle/dom'
import xs from 'xstream'

import makeFeathersDriver from './feathers-driver'


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
  const vtree$ = xs.of(
    div('My Awesome Cycle.js app')
  )

  return {
    DOM: vtree$
  }
}, drivers)