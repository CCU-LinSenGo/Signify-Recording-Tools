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

  // WebSocket
  WEBSOCKET_ENDPOINT: process.env.WEBSOCKET_ENDPOINT || "",

  // Recording
  FRAME_RATE: 30,
  ALLOWED_FRAME_LENGTHS: [30, 60, 90],
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
  },
};
