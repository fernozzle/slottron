import io from 'socket.io-client'
import feathers from 'feathers/client'
import socketio from 'feathers-socketio/client'

const socket = io('http://localhost:3030')
const client = feathers()
  .configure(socketio(socket))

const projects = client.service('/projects')

// Fetch entries
projects.find().then(results => {
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
