// ============================================================
// Action Service Lambda
// 處理:
//   GET  /actions                          → 列出所有動作類別
//   POST /actions                          → 新增動作類別
//   GET  /actions/{actionName}/recordings  → 列出某動作下所有錄影
// ============================================================

const { ACTIONS_TABLE, RECORDINGS_TABLE } = require("/opt/shared/constants");
const { success, error } = require("/opt/shared/response");
const db = require("/opt/shared/dynamodb");

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.resource || event.path;
  const pathParams = event.pathParameters || {};

  console.log(`[ActionService] ${method} ${path}`, JSON.stringify(pathParams));

  try {
    // ---------- GET /actions ----------
    if (method === "GET" && path === "/actions") {
      return await listActions();
    }

    // ---------- POST /actions ----------
    if (method === "POST" && path === "/actions") {
      return await createAction(event);
    }

    // ---------- GET /actions/{actionName}/recordings ----------
    if (method === "GET" && path.includes("/recordings")) {
      const actionName = pathParams.actionName;
      if (!actionName) {
        return error("Missing actionName", 400);
      }
      return await listRecordingsByAction(
        decodeURIComponent(actionName),
        event,
      );
    }

    return error(`Unknown route: ${method} ${path}`, 404);
  } catch (err) {
    console.error("[ActionService] Error:", err);
    return error(err.message, 500);
  }
};

// ============================
// GET /actions
// ============================
async function listActions() {
  const actions = await db.scanTable(ACTIONS_TABLE);

  // 依照 createdAt 排序（最新在前）
  actions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return success({
    actions: actions.map((a) => ({
      actionName: a.actionName,
      displayName: a.displayName || a.actionName,
      description: a.description || "",
      createdAt: a.createdAt,
      recordingCount: a.recordingCount || 0,
    })),
  });
}

// ============================
// POST /actions
// ============================
async function createAction(event) {
  const body = JSON.parse(event.body || "{}");
  const { actionName, displayName, description } = body;

  if (!actionName) {
    return error("Missing actionName", 400);
  }

  // 檢查是否已存在
  const existing = await db.getItem(ACTIONS_TABLE, { actionName });
  if (existing) {
    return error(`Action "${actionName}" already exists`, 409);
  }

  const item = {
    actionName,
    displayName: displayName || actionName,
    description: description || "",
    createdAt: new Date().toISOString(),
    recordingCount: 0,
  };

  await db.putItem(ACTIONS_TABLE, item);

  return success({ message: "Action created", action: item }, 201);
}

// ============================
// GET /actions/{actionName}/recordings
// ============================
async function listRecordingsByAction(actionName, event) {
  const qs = event.queryStringParameters || {};
  const includeInactive = qs.includeInactive === "true";

  // 使用 GSI: actionName-createdAt-index
  let recordings;
  try {
    recordings = await db.queryByIndex(
      RECORDINGS_TABLE,
      "actionName-createdAt-index",
      "actionName = :an",
      { ":an": actionName },
      includeInactive ? undefined : "isActive = :active",
      undefined,
    );

    // 如果需要過濾 isActive，需要加上 ExpressionAttributeValues
    if (!includeInactive) {
      recordings = await db.queryByIndex(
        RECORDINGS_TABLE,
        "actionName-createdAt-index",
        "actionName = :an",
        { ":an": actionName, ":active": true },
        "isActive = :active",
      );
    }
  } catch (err) {
    // 若 GSI 不存在，fallback 用 scan
    console.warn(
      "[listRecordingsByAction] GSI query failed, falling back to scan:",
      err.message,
    );
    let allRecordings = await db.scanTable(
      RECORDINGS_TABLE,
      "actionName = :an",
      { ":an": actionName },
    );
    if (!includeInactive) {
      allRecordings = allRecordings.filter((r) => r.isActive !== false);
    }
    recordings = allRecordings.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  }

  return success({
    actionName,
    recordings: recordings.map((r) => ({
      recordingId: r.recordingId,
      actionName: r.actionName,
      createdAt: r.createdAt,
      totalFrames: r.totalFrames,
      frameRate: r.frameRate,
      durationSec: r.durationSec,
      status: r.status,
      isActive: r.isActive,
      trimStartFrame: r.trimStartFrame,
      trimEndFrame: r.trimEndFrame,
      selectedFrameLength: r.selectedFrameLength,
    })),
    count: recordings.length,
  });
}
