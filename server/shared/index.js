// ============================================================
// shared/index.js - 方便統一 require
// ============================================================

module.exports = {
  constants: require('./constants'),
  response: require('./response'),
  dynamodb: require('./dynamodb'),
  s3: require('./s3'),
  websocket: require('./websocket'),
};
