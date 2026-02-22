# Signfy Recording System - Server

## 專案結構

```
server/
├── shared/                          # Lambda Layer (共用程式碼)
│   ├── constants.js                 # 常數定義
│   ├── response.js                  # 統一回應格式
│   ├── dynamodb.js                  # DynamoDB 操作封裝
│   ├── s3.js                        # S3 操作封裝
│   └── websocket.js                 # WebSocket 推送工具
├── functions/
│   ├── websocket-service/           # WebSocket 連線管理
│   │   └── index.js                 # $connect / $disconnect / $default
│   ├── device-control-service/      # 裝置控制
│   │   └── index.js                 # 連線狀態 / 開始錄影 / 停止錄影
│   ├── action-service/              # 動作管理
│   │   └── index.js                 # 列出動作 / 新增動作 / 列出錄影
│   └── recording-service/           # 錄影管理
│       └── index.js                 # 取得錄影 / 下載數據 / 裁切 / 刪除
├── package.json
├── env.example.json                 # 環境變數範本
└── README.md
```

---

## AWS 建置指南

### 1. DynamoDB Tables

#### signfy-recordings-connections-table

| 欄位                  | 類型   | 說明                         |
| --------------------- | ------ | ---------------------------- |
| **connectionId** (PK) | String | WebSocket connectionId       |
| deviceType            | String | "AppleVisionPro"             |
| deviceName            | String | 裝置名稱                     |
| connectedAt           | String | ISO8601                      |
| disconnectedAt        | String | ISO8601                      |
| status                | String | "connected" / "disconnected" |

#### signfy-recordings-recordings-table

| 欄位                 | 類型    | 說明                                  |
| -------------------- | ------- | ------------------------------------- |
| **recordingId** (PK) | String  | UUID                                  |
| actionName           | String  | 動作名稱                              |
| createdAt            | String  | ISO8601                               |
| s3RawKey             | String  | S3 原始資料路徑                       |
| totalFrames          | Number  | 總幀數                                |
| frameRate            | Number  | 幀率 (30)                             |
| durationSec          | Number  | 秒數                                  |
| trimStartFrame       | Number  | 裁切起始幀                            |
| trimEndFrame         | Number  | 裁切結束幀                            |
| selectedFrameLength  | Number  | 選定幀數 (30/60/90)                   |
| status               | String  | "recording" / "completed" / "trimmed" |
| isActive             | Boolean | true = 保留, false = 軟刪除           |

**GSI:** `actionName-createdAt-index`

- Partition Key: `actionName` (String)
- Sort Key: `createdAt` (String)

#### signfy-recordings-actions-table

| 欄位                | 類型   | 說明       |
| ------------------- | ------ | ---------- |
| **actionName** (PK) | String | 動作名稱   |
| displayName         | String | 顯示名稱   |
| description         | String | 說明       |
| createdAt           | String | ISO8601    |
| recordingCount      | Number | 已錄製幾組 |

### 2. S3 Bucket

- Bucket Name: `signfy-recordings-bucket`（或自訂名稱）
- 開啟 CORS 設定（允許 Client A 直接上傳）

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 3. Lambda Layer（共用程式碼） 

將 `shared/` 資料夾打包為 Lambda Layer。程式碼中使用 `/opt/shared/xxx` 路徑，所以 Layer zip 結構必須為：

```bash
# 打包指令
mkdir -p layer/shared
cp shared/*.js layer/shared/
cd layer && zip -r ../shared-layer.zip .
```

```
shared-layer.zip
└── shared/
    ├── index.js
    ├── constants.js
    ├── response.js
    ├── dynamodb.js
    ├── s3.js
    └── websocket.js
```

> Lambda 執行時 Layer 內容會被解壓到 `/opt/`，所以 `require('/opt/shared/constants')` 會對應到 Layer 中的 `shared/constants.js`。

**Layer 的 npm 依賴：** 因為 Lambda (Node.js 24.x) 運行環境已內建 AWS SDK v3，所以 Layer 不需要額外安裝 npm 套件。如果未來使用其他套件，需把 `node_modules` 也打包進 Layer。

### 4. Lambda Functions

| Lambda Function                  | Runtime      | Handler       | Layer        | 記憶體建議 |
| -------------------------------- | ------------ | ------------- | ------------ | ---------- |
| signfy-recordings-websocket      | Node.js 24.x | index.handler | shared-layer | 256 MB     |
| signfy-recordings-device-control | Node.js 24.x | index.handler | shared-layer | 256 MB     |
| signfy-recordings-action         | Node.js 24.x | index.handler | shared-layer | 256 MB     |
| signfy-recordings-recording      | Node.js 24.x | index.handler | shared-layer | 512 MB     |

#### 環境變數（所有 Lambda 共用）

| 變數名            | 值                                  |
| ----------------- | ----------------------------------- |
| CONNECTIONS_TABLE | signfy-recordings-connections-table |
| RECORDINGS_TABLE  | signfy-recordings-recordings-table  |
| ACTIONS_TABLE     | signfy-recordings-actions-table     |
| S3_BUCKET         | signfy-recordings-bucket            |

#### 額外環境變數（WebSocketService + DeviceControlService）

| 變數名           | 值                        |
| ---------------- | ------------------------- |
| WEBSOCKET_API_ID | `<你的 WebSocket API ID>` |
| WEBSOCKET_STAGE  | production                |

#### IAM 權限

所有 Lambda 需要：

- `dynamodb:PutItem`, `GetItem`, `UpdateItem`, `DeleteItem`, `Scan`, `Query` on 所有三張 Table
- `s3:GetObject`, `s3:PutObject` on `signfy-recordings-bucket/*`

WebSocketService + DeviceControlService 額外需要：

- `execute-api:ManageConnections` on WebSocket API

### 5. API Gateway

#### WebSocket API

| Route       | Integration             |
| ----------- | ----------------------- |
| $connect    | WebSocketService Lambda |
| $disconnect | WebSocketService Lambda |
| $default    | WebSocketService Lambda |

- Stage: `production`
- 記下 WebSocket API ID 設定到環境變數

#### REST API

| Method | Path                             | Integration          |
| ------ | -------------------------------- | -------------------- |
| GET    | /connection/status               | DeviceControlService |
| POST   | /recording/start                 | DeviceControlService |
| POST   | /recording/stop                  | DeviceControlService |
| GET    | /actions                         | ActionService        |
| POST   | /actions                         | ActionService        |
| GET    | /actions/{actionName}/recordings | ActionService        |
| GET    | /recordings/{recordingId}        | RecordingService     |
| GET    | /recordings/{recordingId}/data   | RecordingService     |
| PUT    | /recordings/{recordingId}/trim   | RecordingService     |
| DELETE | /recordings/{recordingId}        | RecordingService     |

> 記得每個路由都要開啟 CORS（或使用 OPTIONS 方法 + Mock Integration）

---

## API 規格

### Client A (WebSocket) 通訊協議

#### Server → Client A

```json
// 開始錄影
{
  "action": "startRecording",
  "recordingId": "uuid",
  "actionName": "吃飯",
  "uploadUrl": "https://s3-presigned-url...",
  "s3Key": "吃飯/uuid/raw.json"
}

// 停止錄影
{
  "action": "stopRecording",
  "recordingId": "uuid"
}
```

#### Client A → Server

```json
// 上傳 S3 完成後通知 Server 更新 metadata
{
  "action": "uploadCompleted",
  "recordingId": "uuid",
  "totalFrames": 150,
  "durationSec": 5.0
}
```

### Client B (REST API)

#### 查看連線狀態

```
GET /connection/status
→ { isConnected: true, devices: [...] }
```

#### 開始錄影

```
POST /recording/start
Body: { "actionName": "吃飯" }
→ { recordingId: "uuid", ... }
```

#### 停止錄影

```
POST /recording/stop
Body: { "recordingId": "uuid" }
→ { message: "Stop recording signal sent" }
```

#### 列出所有動作

```
GET /actions
→ { actions: [{ actionName, displayName, recordingCount, ... }] }
```

#### 新增動作

```
POST /actions
Body: { "actionName": "吃飯", "displayName": "吃飯", "description": "吃飯動作" }
→ { action: { ... } }
```

#### 列出某動作的錄影

```
GET /actions/吃飯/recordings
→ { recordings: [...], count: 5 }
```

#### 取得錄影 metadata

```
GET /recordings/{recordingId}
→ { recording: { ... } }
```

#### 下載錄影數據

```
GET /recordings/{recordingId}/data
→ { downloadUrl: "https://presigned-url..." }

GET /recordings/{recordingId}/data?returnType=data
→ { data: { frames: [...] } }
```

#### 裁切錄影

```
PUT /recordings/{recordingId}/trim
Body: { "trimStartFrame": 10, "trimEndFrame": 70, "selectedFrameLength": 60 }
→ { message: "Recording trimmed successfully", trimmedFrames: 60 }
```

#### 軟刪除錄影

```
DELETE /recordings/{recordingId}
→ { message: "Recording soft-deleted", isActive: false }
```
