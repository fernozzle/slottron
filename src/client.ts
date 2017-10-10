import {run} from '@cycle/run'
import {makeDOMDriver, div} from '@cycle/dom'
import xs from 'xstream'

const io = require('socket.io-client')
console.log('io', io)
//import io from 'socket.io-client'
const feathers = require('feathers/client')
const socketio = require('feathers-socketio/client')

const socket = io('http://localhost:3030')
const client = feathers()
  .configure(socketio(socket))

const projects = client.service('/projects')

// Fetch entries
projects.find().then((results:any) => {
  console.log('Projects:', results)
})

// Listen for events
projects.on('created', datum => {
  console.log('Project added:', datum)
})

// Create entries
const button = document.querySelector('#new-project')
const name = document.querySelector('#name')
button.addEventListener('click', () => {
  projects.create({
    path: `./${name.value}`,
  })
})

const drivers = {
  DOM: makeDOMDriver('#main')
}

run(function App(sources : any) {
  const vtree$ = xs.of(
    div('My Awesome Cycle.js app')
  )

  return {
    DOM: vtree$
  }
}, drivers)