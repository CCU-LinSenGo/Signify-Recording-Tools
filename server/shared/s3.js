// ============================================================
// S3 共用操作封裝
// ============================================================

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3_BUCKET, PRESIGNED_URL_EXPIRY } = require("./constants");

const s3Client = new S3Client({});

/**
 * 產生 S3 預簽名 GET URL
 */
async function getPresignedGetUrl(key) {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });
}

/**
 * 產生 S3 預簽名 PUT URL（給 Client A 上傳用）
 */
async function getPresignedPutUrl(key, contentType = "text/csv") {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });
}

/**
 * 從 S3 直接讀取 JSON 檔案
 */
async function getJsonFromS3(key) {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const result = await s3Client.send(command);
  const bodyStr = await result.Body.transformToString("utf-8");
  return JSON.parse(bodyStr);
}

/**
 * 從 S3 讀取 CSV（TSV）檔案，解析為 row objects 陣列
 * CSV 格式: tab-separated, 第一行為 header
 */
async function getCsvFromS3(key) {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const result = await s3Client.send(command);
  const bodyStr = await result.Body.transformToString("utf-8");

  const lines = bodyStr.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = lines[0].split("\t");
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\t");
    if (values.length !== headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      // 自動轉型：數字、布林
      if (val === "true" || val === "True") row[h] = true;
      else if (val === "false" || val === "False") row[h] = false;
      else if (val !== "" && !isNaN(Number(val))) row[h] = Number(val);
      else row[h] = val;
    });
    rows.push(row);
  }

  return rows;
}

/**
 * 直接寫入 JSON 到 S3
 */
async function putJsonToS3(key, data) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: "application/json",
  });
  await s3Client.send(command);
}

module.exports = {
  getPresignedGetUrl,
  getPresignedPutUrl,
  getJsonFromS3,
  getCsvFromS3,
  putJsonToS3,
};
