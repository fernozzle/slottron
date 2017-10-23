const fs = require('fs')
const path = require('path')

const createService = require('feathers-nedb');
const createModel = require('../../models/projects.model');
const filters = require('./projects.filters');

const {setCreatedAt} = require('feathers-hooks-common');
import {primaryKey} from '../../common'

module.exports = function () {
  const app = this;
  const Model = createModel(app);

  const options = {
    name: 'projects',
    Model,
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/projects', createService(options));

  const service = app.service('projects');

  service.hooks({
    before: {
      all: [],
      find: [],
      get: [],
      create: [excludeByFields('path'), setCreatedAt('dateAdded')],
      update: [],
      patch: [],
      remove: []
    },

    after: {
      all: [],
      find: [],
      get: [],
      create: [],
      update: [],
      patch: [],
      // remove: []
      remove: [clearItemsToo]
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
  });

  if (service.filter) {
    service.filter(filters);
  }
};

function clearItemsToo(hook) {
  const {service, app, params, id} = hook
  const items = app.service('items/')

  const queryId = params &&
    params.query && params.query[primaryKey]
  const project = id || queryId

  return items.remove(null,
    {query: project ? {project} : null}
  ).then(() => hook)
}

function excludeByFields(...keys) {
  return function ({service, data, path}) {

    const query = {}
    for (const key of keys) query[key] = data[key]

    return service.find({query}).then(result => {
      if (result.total == 0) return;
      throw new Error(
        `Item ${result.data[0][primaryKey]} ` +
        `matching ${JSON.stringify(query)} ` +
        `already exists on service '${path}'`
      )
    })
  }
}
function makeFile({app, data}) {
  const fn = path.join(
    app.get('defaultDir'),
    data.path
  )
  fs.writeFile(fn, 'hoylo')
}

