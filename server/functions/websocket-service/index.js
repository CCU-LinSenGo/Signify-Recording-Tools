// ============================================================
// WebSocket Service Lambda
// 處理: $connect / $disconnect / $default
// ============================================================

const {
  CONNECTIONS_TABLE,
  RECORDINGS_TABLE,
  WS_ACTIONS,
  RECORDING_STATUS,
} = require("/opt/shared/constants");
const { wsSuccess, wsError } = require("/opt/shared/response");
const db = require("/opt/shared/dynamodb");

exports.handler = async (event) => {
  const { requestContext } = event;
  const routeKey = requestContext.routeKey;
  const connectionId = requestContext.connectionId;

  console.log(
    `[WebSocketService] route=${routeKey}, connectionId=${connectionId}`,
  );

  try {
    switch (routeKey) {
      case "$connect":
        return await handleConnect(connectionId, event);
      case "$disconnect":
        return await handleDisconnect(connectionId);
      case "$default":
        return await handleDefault(connectionId, event);
      default:
        return wsError(`Unknown route: ${routeKey}`);
    }
  } catch (err) {
    console.error("[WebSocketService] Error:", err);
    return wsError(err.message);
  }
};

// ----- $connect -----
async function handleConnect(connectionId, event) {
  const now = new Date().toISOString();
  const queryParams = event.queryStringParameters || {};

  await db.putItem(CONNECTIONS_TABLE, {
    connectionId,
    deviceType: queryParams.deviceType || "AppleVisionPro",
    deviceName: queryParams.deviceName || "unknown",
    connectedAt: now,
    status: "connected",
  });

  console.log(`[Connect] Device connected: ${connectionId}`);
  return wsSuccess();
}

// ----- $disconnect -----
async function handleDisconnect(connectionId) {
  await db.updateItem(
    CONNECTIONS_TABLE,
    { connectionId },
    "SET #s = :s, disconnectedAt = :d",
    { ":s": "disconnected", ":d": new Date().toISOString() },
    { "#s": "status" },
  );

  console.log(`[Disconnect] Device disconnected: ${connectionId}`);
  return wsSuccess();
}

// ----- $default (接收 Client A 的訊息) -----
async function handleDefault(connectionId, event) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return wsError("Invalid JSON body");
  }

  const { action } = body;
  console.log(`[Default] action=${action}, connectionId=${connectionId}`);

  switch (action) {
    case WS_ACTIONS.UPLOAD_COMPLETED:
      return await handleUploadCompleted(body);

    default:
      console.log(`[Default] Unknown action: ${action}`);
      return wsSuccess();
  }
}

/**
 * Client A 上傳 S3 完成後回報，更新錄影記錄的 metadata（幀數、秒數等）
 *
 * 流程：
 * 1. Client B 按「開始錄影」→ DeviceControlService 建立 DB 記錄 + 產生 presigned URL → 通知 Client A
 * 2. Client A 錄影 → 用 presigned URL 上傳 S3
 * 3. Client A 上傳完成 → 發送 uploadCompleted → 本函式更新 metadata
 */
async function handleUploadCompleted(body) {
  const { recordingId, totalFrames, durationSec } = body;

  if (!recordingId) {
    return wsError("Missing recordingId");
  }

  const updateExpr =
    "SET #s = :s, totalFrames = :tf, durationSec = :ds, uploadedAt = :ua";
  const exprValues = {
    ":s": RECORDING_STATUS.COMPLETED,
    ":tf": totalFrames || 0,
    ":ds": durationSec || 0,
    ":ua": new Date().toISOString(),
  };

  await db.updateItem(
    RECORDINGS_TABLE,
    { recordingId },
    updateExpr,
    exprValues,
    { "#s": "status" },
  );

  console.log(`[UploadCompleted] recordingId=${recordingId}`);
  return wsSuccess();
}
