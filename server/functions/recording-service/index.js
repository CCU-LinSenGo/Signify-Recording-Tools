// ============================================================
// Recording Service Lambda
// 處理:
//   GET    /recordings/{recordingId}        → 取得錄影 metadata
//   GET    /recordings/{recordingId}/data   → 取得錄影幀數據 (presigned URL)
//   PUT    /recordings/{recordingId}/trim   → 儲存裁切結果
//   DELETE /recordings/{recordingId}        → 軟刪除錄影
// ============================================================

const {
  RECORDINGS_TABLE,
  ACTIONS_TABLE,
  RECORDING_STATUS,
  ALLOWED_FRAME_LENGTHS,
} = require("/opt/shared/constants");
const { success, error } = require("/opt/shared/response");
const db = require("/opt/shared/dynamodb");
const s3 = require("/opt/shared/s3");

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.resource || event.path;
  const pathParams = event.pathParameters || {};
  const recordingId = pathParams.recordingId;

  console.log(
    `[RecordingService] ${method} ${path} recordingId=${recordingId}`,
  );

  if (!recordingId) {
    return error("Missing recordingId", 400);
  }

  try {
    // ---------- GET /recordings/{recordingId}/data ----------
    if (method === "GET" && path.includes("/data")) {
      return await getRecordingData(recordingId, event);
    }

    // ---------- GET /recordings/{recordingId} ----------
    if (method === "GET") {
      return await getRecording(recordingId);
    }

    // ---------- PUT /recordings/{recordingId}/trim ----------
    if (method === "PUT" && path.includes("/trim")) {
      return await trimRecording(recordingId, event);
    }

    // ---------- DELETE /recordings/{recordingId} ----------
    if (method === "DELETE") {
      return await softDeleteRecording(recordingId);
    }

    return error(`Unknown route: ${method} ${path}`, 404);
  } catch (err) {
    console.error("[RecordingService] Error:", err);
    return error(err.message, 500);
  }
};

// ============================
// GET /recordings/{recordingId}
// ============================
async function getRecording(recordingId) {
  const recording = await db.getItem(RECORDINGS_TABLE, { recordingId });

  if (!recording) {
    return error("Recording not found", 404);
  }

  return success({ recording });
}

// ============================
// GET /recordings/{recordingId}/data
// ============================
async function getRecordingData(recordingId, event) {
  const recording = await db.getItem(RECORDINGS_TABLE, { recordingId });

  if (!recording) {
    return error("Recording not found", 404);
  }

  const qs = event.queryStringParameters || {};
  const s3Key = recording.s3RawKey;

  if (!s3Key) {
    return error("No data available for this recording", 404);
  }

  // 根據 query param 決定回傳方式
  const returnType = qs.returnType || "url"; // 'url' | 'data'

  if (returnType === "data") {
    // 直接回傳 JSON 數據（小型數據可用，大型建議用 presigned URL）
    try {
      const data = await s3.getJsonFromS3(s3Key);
      return success({
        recordingId,
        s3Key,
        data,
      });
    } catch (err) {
      console.error("[getRecordingData] Failed to read S3:", err.message);
      return error("Failed to read recording data from S3", 500);
    }
  }

  // 預設回傳 presigned URL
  const downloadUrl = await s3.getPresignedGetUrl(s3Key);

  return success({
    recordingId,
    s3Key,
    downloadUrl,
    totalFrames: recording.totalFrames,
    frameRate: recording.frameRate,
    durationSec: recording.durationSec,
    trimStartFrame: recording.trimStartFrame,
    trimEndFrame: recording.trimEndFrame,
    selectedFrameLength: recording.selectedFrameLength,
  });
}

// ============================
// PUT /recordings/{recordingId}/trim
// ============================
async function trimRecording(recordingId, event) {
  const body = JSON.parse(event.body || "{}");
  const { trimStartFrame, trimEndFrame, selectedFrameLength } = body;

  // 驗證
  if (trimStartFrame == null || trimEndFrame == null) {
    return error("Missing trimStartFrame or trimEndFrame", 400);
  }

  if (trimStartFrame < 0 || trimEndFrame <= trimStartFrame) {
    return error(
      "Invalid trim range: trimEndFrame must be greater than trimStartFrame",
      400,
    );
  }

  const frameLength = trimEndFrame - trimStartFrame;
  if (
    selectedFrameLength &&
    !ALLOWED_FRAME_LENGTHS.includes(selectedFrameLength)
  ) {
    return error(
      `selectedFrameLength must be one of: ${ALLOWED_FRAME_LENGTHS.join(", ")}`,
      400,
    );
  }

  // 取得原始錄影記錄
  const recording = await db.getItem(RECORDINGS_TABLE, { recordingId });
  if (!recording) {
    return error("Recording not found", 404);
  }

  if (trimEndFrame > recording.totalFrames) {
    return error(
      `trimEndFrame (${trimEndFrame}) exceeds totalFrames (${recording.totalFrames})`,
      400,
    );
  }

  // 只更新 DynamoDB 的 trim 標記，不另存 S3 檔案
  // Client B 讀取 raw.json 後根據 trimStartFrame / trimEndFrame 在前端擷取對應幀
  const updated = await db.updateItem(
    RECORDINGS_TABLE,
    { recordingId },
    "SET #s = :s, trimStartFrame = :tsf, trimEndFrame = :tef, selectedFrameLength = :sfl, trimmedAt = :ta",
    {
      ":s": RECORDING_STATUS.TRIMMED,
      ":tsf": trimStartFrame,
      ":tef": trimEndFrame,
      ":sfl": selectedFrameLength || frameLength,
      ":ta": new Date().toISOString(),
    },
    { "#s": "status" },
  );

  return success({
    message: "Recording trimmed successfully",
    recording: updated,
    trimmedFrames: frameLength,
  });
}

// ============================
// DELETE /recordings/{recordingId}  (軟刪除)
// ============================
async function softDeleteRecording(recordingId) {
  const recording = await db.getItem(RECORDINGS_TABLE, { recordingId });
  if (!recording) {
    return error("Recording not found", 404);
  }

  // 軟刪除：只標記 isActive = false，不真正刪資料
  const updated = await db.updateItem(
    RECORDINGS_TABLE,
    { recordingId },
    "SET isActive = :ia, deletedAt = :da",
    {
      ":ia": false,
      ":da": new Date().toISOString(),
    },
  );

  // 更新 ActionsTable 的 recordingCount（減 1，但不低於 0）
  try {
    const action = await db.getItem(ACTIONS_TABLE, {
      actionName: recording.actionName,
    });
    if (action && action.recordingCount > 0) {
      await db.updateItem(
        ACTIONS_TABLE,
        { actionName: recording.actionName },
        "SET recordingCount = recordingCount - :dec",
        { ":dec": 1 },
      );
    }
  } catch (err) {
    console.warn("[softDelete] Failed to update action count:", err.message);
  }

  return success({
    message: "Recording soft-deleted",
    recordingId,
    isActive: false,
  });
}
