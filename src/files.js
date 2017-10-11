const path = require('path')
const fs = require('fs')
const feathersErrors = require('feathers-errors');

module.exports = function() {
  const app = this

  console.log('RUNNING FILES.JS')
  app.get('/files/:id', (req, res) => {
    const filePath = path.join(app.get('SL-root'), req.params.id)
    const stream = fs.createReadStream(filePath)
    stream.on('error', (err) => {
      //res.sendStatus(404)
      res.send(err)
    })
    stream.pipe(res)
  })
}