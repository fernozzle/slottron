
module.exports = function() {
  const fileService = {
    get(id, params) {
      return Promise.resolve({
        id, text: `You have to do ${id}!`
      })
    }
  }
  this.use('/files', fileService)
}