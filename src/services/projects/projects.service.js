const fs = require('fs')
const path = require('path')

const createService = require('feathers-nedb');
const createModel = require('../../models/projects.model');
const filters = require('./projects.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

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
      create: [excludeByPath, makeFile],
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

