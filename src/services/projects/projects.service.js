const fs = require('fs')
const path = require('path')

const createService = require('feathers-nedb');
const createModel = require('../../models/projects.model');
const filters = require('./projects.filters');

const {setCreatedAt} = require('feathers-hooks-common');

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
      // remove: []
      remove: [clearItemsToo] // Why
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
  console.log('id', id, 'params', params)
  const items = app.service('items/')
  if (id) return items.remove(id).then(x => hook)
  if (params._id) return items.remove(null, {query: {'project': params._id}}).then(x => hook)
  return items.remove(null).then(x => hook)
}

function excludeByPath({service, data}) {
  console.log('IT IS ME!!!')
  return service.find(
    {query: {path: data['path']}}
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

