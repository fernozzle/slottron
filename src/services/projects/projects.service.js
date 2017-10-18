const fs = require('fs')
const path = require('path')

const createService = require('feathers-nedb');
const createModel = require('../../models/projects.model');
const filters = require('./projects.filters');

const {setCreatedAt} = require('feathers-hooks-common');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = {
    default: Number.POSITIVE_INFINITY,
    max: Number.POSITIVE_INFINITY
  }

  const options = {
    name: 'projects',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/projects', createService(options));

  const service = app.service('projects');

  service.hooks({
    before: {
      all: [],
      find: [],
      get: [],
      create: [excludeByPath, setCreatedAt('dateAdded')],
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
  });

  if (service.filter) {
    service.filter(filters);
  }
};

function excludeByPath({service, data}) {
  return service.find(
    {query: {path: data.path}}
  ).then(result => {
    if (result.total == 0) return;
    throw new Error('already exists')
  })
}
function makeFile({app, data}) {
  const fn = path.join(
    app.get('defaultDir'),
    data.path
  )
  fs.writeFile(fn, 'hoylo')
}

