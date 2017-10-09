const projects = require('./projects/projects.service.js');
const items = require('./items/items.service.js');
module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  app.configure(projects);
  app.configure(items);
};
