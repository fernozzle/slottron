const projects = require('./projects/projects.service.js');
const items = require('./items/items.service.js');
const files = require('./files')
module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  app.configure(projects);
  app.configure(items);
  app.configure(files)
};
