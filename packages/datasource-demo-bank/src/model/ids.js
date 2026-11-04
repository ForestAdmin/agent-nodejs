/** Ids the layout keeps from one run to the next, so applying twice changes nothing. */
const crypto = require('crypto');

/** A UUID made from a name: the same name always gives the same id. */
const stableId = name => {
  const h = crypto.createHash('md5').update(`forest-lab-desk:${name}`).digest('hex');

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
    20,
    32,
  )}`;
};

module.exports = { stableId };
