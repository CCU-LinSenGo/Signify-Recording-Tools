// ============================================================
// 共用常數
// ============================================================

module.exports = {
  // DynamoDB Table Names (透過環境變數注入)
  CONNECTIONS_TABLE:
    process.env.CONNECTIONS_TABLE || "signfy-recordings-connections-table",
  RECORDINGS_TABLE:
    process.env.RECORDINGS_TABLE || "signfy-recordings-recordings-table",
  ACTIONS_TABLE: process.env.ACTIONS_TABLE || "signfy-recordings-actions-table",

  // S3
  S3_BUCKET: process.env.S3_BUCKET || "signfy-recordings-bucket",
  PRESIGNED_URL_EXPIRY: 3600, // 1 hour

  // AWS
  AWS_REGION: process.env.AWS_REGION || "ap-northeast-3",

  // WebSocket
  WEBSOCKET_API_ID: process.env.WEBSOCKET_API_ID || "",
  WEBSOCKET_STAGE: process.env.WEBSOCKET_STAGE || "production",
  WEBSOCKET_ENDPOINT:
    process.env.WEBSOCKET_ENDPOINT ||
    (process.env.WEBSOCKET_API_ID
      ? `https://${process.env.WEBSOCKET_API_ID}.execute-api.${process.env.AWS_REGION || "ap-northeast-3"}.amazonaws.com/${process.env.WEBSOCKET_STAGE || "production"}`
      : ""),

  // Recording
  FRAME_RATE: 30,
  DEFAULT_FRAME_LENGTH: 60,

  // Connection status
  CONNECTION_STATUS: {
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
  },

  // Recording status
  RECORDING_STATUS: {
    RECORDING: "recording",
    COMPLETED: "completed",
    TRIMMED: "trimmed",
  },

  // WebSocket actions (Client A <-> Server)
  WS_ACTIONS: {
    START_RECORDING: "startRecording",
    STOP_RECORDING: "stopRecording",
    UPLOAD_COMPLETED: "uploadCompleted",
    EDITING_COMPLETED: "editingCompleted",
  },
};
