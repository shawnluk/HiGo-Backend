const { seedMessages } = require('../data/messages');

const messages = seedMessages.map((message) => ({ ...message }));

function listMessages(query = {}) {
  let result = [...messages];

  if (query.read !== undefined) {
    const shouldBeRead = String(query.read) === 'true' || String(query.read) === '1';
    result = result.filter((message) => Boolean(message.read) === shouldBeRead);
  }

  if (query.type) {
    result = result.filter((message) => message.type === query.type);
  }

  return result;
}

module.exports = { listMessages };
