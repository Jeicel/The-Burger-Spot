// Wrapper so frontend calls to /api/users continue to work.
const createUser = require('./create-user').handler;
const dbTest = require('./db-test').handler;

exports.handler = async function (event, context) {
  if (event.httpMethod === 'POST') {
    return createUser(event, context);
  }

  if (event.httpMethod === 'GET') {
    return dbTest(event, context);
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
