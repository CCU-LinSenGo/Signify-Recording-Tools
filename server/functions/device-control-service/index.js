// ============================================================
// Device Control Service Lambda
// 處理:
//   GET  /connection/status   → 查詢 Client A 連線狀態
//   POST /recording/start     → 透過 WebSocket 通知 Client A 開始錄影
//   POST /recording/stop      → 透過 WebSocket 通知 Client A 停止錄影
//   POST /editing/completed   → 透過 WebSocket 通知 Client A 剪輯完成
// ============================================================

const {
  CONNECTIONS_TABLE,
  RECORDINGS_TABLE,
  WS_ACTIONS,
  RECORDING_STATUS,
  CONNECTION_STATUS,
  WEBSOCKET_ENDPOINT,
  FRAME_RATE,
  DEFAULT_FRAME_LENGTH,
} = require("/opt/shared/constants");
const { success, error } = require("/opt/shared/response");
const db = require("/opt/shared/dynamodb");
const ws = require("/opt/shared/websocket");
const s3 = require("/opt/shared/s3");

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.resource || event.path;

  console.log(`[DeviceControlService] ${method} ${path}`);

  try {
    // ---------- GET /connection/status ----------
    if (method === "GET" && path.includes("/connection/status")) {
      return await getConnectionStatus();
    }

    // ---------- POST /recording/start ----------
    if (method === "POST" && path.includes("/recording/start")) {
      return await startRecording(event);
    }

    // ---------- POST /recording/stop ----------
    if (method === "POST" && path.includes("/recording/stop")) {
      return await stopRecording(event);
    }

    // ---------- POST /editing/completed ----------
    if (method === "POST" && path.includes("/editing/completed")) {
      return await editingCompleted(event);
    }

    return error(`Unknown route: ${method} ${path}`, 404);
  } catch (err) {
    console.error("[DeviceControlService] Error:", err);
    return error(err.message, 500);
  }
};

// ============================
// GET /connection/status
// ============================
async function getConnectionStatus() {
  // 掃描 ConnectionsTable 找到 status = connected 的裝置
  const connections = await db.scanTable(
    CONNECTIONS_TABLE,
    "#s = :s",
    { ":s": CONNECTION_STATUS.CONNECTED },
    { "#s": "status" },
  );

  return success({
    isConnected: connections.length > 0,
    devices: connections.map((c) => ({
      connectionId: c.connectionId,
      deviceType: c.deviceType,
      deviceName: c.deviceName,
      connectedAt: c.connectedAt,
    })),
  });
}

// ============================
// POST /recording/start
// ============================
async function startRecording(event) {
  const body = JSON.parse(event.body || "{}");
  const { actionName, description, enableAnimationRecording } = body;

  if (!actionName) {
    return error("Missing actionName", 400);
  }

  // 取得目前連線中的 Client A
  const connections = await db.scanTable(
    CONNECTIONS_TABLE,
    "#s = :s",
    { ":s": CONNECTION_STATUS.CONNECTED },
    { "#s": "status" },
  );

  if (connections.length === 0) {
    return error("No device connected", 400);
  }

  // 產生 recordingId
  const recordingId = generateUUID();
  const now = new Date().toISOString();
  const s3RawKey = `${actionName}/${recordingId}/raw.csv`;
  const shouldUploadAnimation = Boolean(enableAnimationRecording);
  const s3AnimKey = shouldUploadAnimation
    ? `${actionName}/${recordingId}/animation.fbx`
    : null;

  // 先建立錄影記錄（status = recording）
  await db.putItem(RECORDINGS_TABLE, {
    recordingId,
    actionName,
    description: typeof description === "string" ? description : null,
    createdAt: now,
    s3RawKey,
    s3AnimKey,
    enableAnimationRecording: shouldUploadAnimation,
    totalFrames: 0,
    frameRate: FRAME_RATE,
    durationSec: 0,
    trimStartFrame: null,
    trimEndFrame: null,
    selectedFrameLength: DEFAULT_FRAME_LENGTH,
    status: RECORDING_STATUS.RECORDING,
    isActive: true,
  });

  // 產生 S3 presigned PUT URL 供 Client A 上傳
  const uploadUrl = await s3.getPresignedPutUrl(s3RawKey);
  const animationUploadUrl = shouldUploadAnimation
    ? await s3.getPresignedPutUrl(s3AnimKey)
    : null;

  // 取得 WebSocket endpoint
  const endpoint = WEBSOCKET_ENDPOINT;

  // 通知所有連線中的 Client A 開始錄影
  const notifyPayload = {
    action: WS_ACTIONS.START_RECORDING,
    recordingId,
    actionName,
    description: typeof description === "string" ? description : null,
    uploadUrl,
    s3Key: s3RawKey,
    enableAnimationRecording: shouldUploadAnimation,
    animationUploadUrl,
    animationS3Key: s3AnimKey,
  };

  const notifyPromises = connections.map((c) =>
    ws
      .postToConnection(c.connectionId, notifyPayload, endpoint)
      .catch((err) => {
        console.warn(`Failed to notify ${c.connectionId}:`, err.message);
      }),
  );
  await Promise.all(notifyPromises);

  return success({
    message: "Recording started",
    recordingId,
    actionName,
    description: typeof description === "string" ? description : null,
    enableAnimationRecording: shouldUploadAnimation,
    animationS3Key: s3AnimKey,
    notifiedDevices: connections.length,
  });
}

// ============================
// POST /recording/stop
// ============================
async function stopRecording(event) {
  const body = JSON.parse(event.body || "{}");
  const { recordingId } = body;

  // 取得目前連線中的 Client A
  const connections = await db.scanTable(
    CONNECTIONS_TABLE,
    "#s = :s",
    { ":s": CONNECTION_STATUS.CONNECTED },
    { "#s": "status" },
  );

  if (connections.length === 0) {
    return error("No device connected", 400);
  }

  const endpoint = WEBSOCKET_ENDPOINT;

  const notifyPayload = {
    action: WS_ACTIONS.STOP_RECORDING,
    recordingId: recordingId || null,
  };

  const notifyPromises = connections.map((c) =>
    ws
      .postToConnection(c.connectionId, notifyPayload, endpoint)
      .catch((err) => {
        console.warn(`Failed to notify ${c.connectionId}:`, err.message);
      }),
  );
  await Promise.all(notifyPromises);

  return success({
    message: "Stop recording signal sent",
    recordingId: recordingId || null,
    notifiedDevices: connections.length,
  });
}

// ============================
// POST /editing/completed
// ============================
async function editingCompleted(event) {
  const body = JSON.parse(event.body || "{}");
  const { recordingId } = body;

  // 取得目前連線中的 Client A
  const connections = await db.scanTable(
    CONNECTIONS_TABLE,
    "#s = :s",
    { ":s": CONNECTION_STATUS.CONNECTED },
    { "#s": "status" },
  );

  if (connections.length === 0) {
    return error("No device connected", 400);
  }

  const endpoint = WEBSOCKET_ENDPOINT;

  const notifyPayload = {
    action: WS_ACTIONS.EDITING_COMPLETED,
    recordingId: recordingId || null,
  };

  const notifyPromises = connections.map((c) =>
    ws
      .postToConnection(c.connectionId, notifyPayload, endpoint)
      .catch((err) => {
        console.warn(`Failed to notify ${c.connectionId}:`, err.message);
      }),
  );
  await Promise.all(notifyPromises);

  return success({
    message: "Editing completed signal sent",
    recordingId: recordingId || null,
    notifiedDevices: connections.length,
  });
}

// ============================
// Helper
// ============================

function generateUUID() {
  // Simple UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
