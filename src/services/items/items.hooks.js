const pattern = require('../../pattern')
const upsert = require('../../hooks/upsert')

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [upsert],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],

    find: [],
    get: [],
    /*
    find: [hook => {
      if (hook.params.isInternal) return hook
      return Promise.all(hook.result.data.map(result => getSourcesFor(
        hook.app.get('SL-steps'), hook.service, result
      ))).then(results => hook)
    }],
    get: [hook => {
      if (hook.params.isInternal) return hook
      return getSourcesFor(
        hook.app.get('SL-steps'), hook.service, hook.result
      ).then(result => hook)
    }],
    */

    create: [hook => {
      // console.log('created', hook.result)
    }],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};

function getSourcesFor(steps, service, result) {
  if (result.step === 0) {
    result.sources = []
    return Promise.resolve(result)
  }
  const parsed = pattern.parse(steps[result.step].pattern)

  const stepIndex = result.step - 1
  const prevParsed = pattern.parse(steps[stepIndex].pattern)

  const params = {query: {step: stepIndex}, isInternal: true}
  return service.find(params).then(({data}) => {
    const sources = data.filter(({path}) => {
      try {
        const vars = pattern.read(prevParsed, path)
        const query = pattern.render(parsed, vars)
        const queryParsed = pattern.parse(query)
        pattern.read(queryParsed, result.path)
        return true
      } catch (e) { return false }
    }).map(item => item.path)

    result.sources = sources
    return result
  })
}
