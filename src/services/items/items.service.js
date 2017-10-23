// Initializes the `items` service on path `/items`
const createService = require('feathers-memory');
const hooks = require('./items.hooks');
const filters = require('./items.filters');
import {primaryKey} from '../../common'

module.exports = function () {
  const app = this;

  const options = {
    name: 'items',
    paginate: app.get('paginate'),
    id: primaryKey
  };

  // Initialize our service with any options it requires
  app.use('/items', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('items');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
