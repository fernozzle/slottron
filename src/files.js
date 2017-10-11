const path = require('path')
const fs = require('fs')
const feathersErrors = require('feathers-errors');

module.exports = function() {
  const app = this

  function doy (root, filePath, res) {
    const stream = fs.createReadStream(path.join(root, filePath))
    stream.on('error', (err) => {
      if (err.code !== 'ENOENT') {
        res.status(500)
        res.send(err)
        return
      }
      // Human-made file doesn't exist in the folder,
      // so look up if it's an imaginary file with sources
      app.service('items').find({query: {path: filePath}})
      .then(({data: [result]}) => {
        if (!result) {
          res.status(404)
          res.send(`No file, real or imaginary, exists at '${filePath}'.`)
          return
        }
        res.send(result.sources)
      })
    })
    stream.pipe(res)
  }

  app.get('/files/:id', (req, res) => {
    doy(app.get('SL-root'), req.params.id, res)
  })
}