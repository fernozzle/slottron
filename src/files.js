const path = require('path')
const fs = require('fs')

const multer = require('multer')
const feathersErrors = require('feathers-errors');

module.exports = function() {
  const app = this
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(
          app.get('SL-root'),
          path.dirname(req.params.id)
        ))
      },
      filename: (req, file, cb) => {
        cb(null, path.basename(req.params.id))
      }
    })
  })

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
  app.put('/files/:id', upload.single('file'), (req, res) => {
    res.send('thank you for the file ' + JSON.stringify(req.file))
  })
}