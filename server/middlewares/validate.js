//const jwt = require('jsonwebtoken');
const config = require('../helpers/config');

module.exports = async function(req, res, next) {
  req.user = {"id":"123","email":"test@test.com"}
  next();
};
