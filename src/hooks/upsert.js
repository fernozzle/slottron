/**
 * For CREATE requests.
 * If an item that has the same values at each of `idByKeys`
 * already exists, just patch that one.
 */
module.exports = function (...idByKeys) { // eslint-disable-line no-unused-vars
  return function (hook) {
    if (!idByKeys || idByKeys.length === 0) return hook

    const {data, service} = hook, query = {}
    for (const key of idByKeys) {
      query[key] = data[key]
    }

    return service.find({ query }).then(page => {
      if (page.total === 0) return hook // It's new: create
      return service.patch(
        page.data[0][service.id],
        data
      ).then(result => {
        hook.result = result
        return hook
      })
    })
  }
}