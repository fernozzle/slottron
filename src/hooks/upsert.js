
// Upsert - a create hook
module.exports = function(hook) {
  const {data, service} = hook
  const id = data[service.id]

  return service.get(id)
    // This is skipped if the item doesn't exist
    .then(item => service.patch(id, data))
    // Doesn't exist
    .catch(e => hook.result)
    // If it didn't exist, this is a noop; continue as normal
    .then(result => { hook.result = result })
}

