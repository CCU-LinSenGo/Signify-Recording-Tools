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
async function getPresignedPutUrl(key, contentType = "application/json") {
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
  putJsonToS3,
};
