// ============================================================
// WebSocket 訊息推送工具（透過 API Gateway Management API）
// ============================================================

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { WEBSOCKET_ENDPOINT } = require("./constants");

function getApiGwClient(endpoint) {
  const ep = endpoint || WEBSOCKET_ENDPOINT;
  return new ApiGatewayManagementApiClient({ endpoint: ep });
}

/**
 * 透過 WebSocket 向指定 connectionId 推送訊息
 */
async function postToConnection(connectionId, payload, endpoint) {
  const client = getApiGwClient(endpoint);
  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: Buffer.from(JSON.stringify(payload)),
  });
  await client.send(command);
}

module.exports = { postToConnection };
