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
