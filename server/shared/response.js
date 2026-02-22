// ============================================================
// 統一 HTTP 回應格式
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function success(body, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function error(message, statusCode = 500) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

function wsSuccess() {
  return { statusCode: 200, body: 'OK' };
}

function wsError(message) {
  console.error('WebSocket error:', message);
  return { statusCode: 500, body: JSON.stringify({ error: message }) };
}

module.exports = { success, error, wsSuccess, wsError };
