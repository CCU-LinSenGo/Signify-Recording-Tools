// ============================================================
// DynamoDB 共用操作封裝
// ============================================================

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

async function putItem(tableName, item) {
  await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function getItem(tableName, key) {
  const result = await docClient.send(
    new GetCommand({ TableName: tableName, Key: key }),
  );
  return result.Item || null;
}

async function updateItem(
  tableName,
  key,
  updateExpression,
  expressionValues,
  expressionNames,
) {
  const params = {
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: "ALL_NEW",
  };
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

async function scanTable(
  tableName,
  filterExpression,
  expressionValues,
  expressionNames,
) {
  const params = { TableName: tableName };
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionValues;
  }
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }

  const items = [];
  let lastKey;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new ScanCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

async function queryByIndex(
  tableName,
  indexName,
  keyCondition,
  expressionValues,
  filterExpression,
  expressionNames,
) {
  const params = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
    ScanIndexForward: false, // 最新的排前面
  };
  if (filterExpression) {
    params.FilterExpression = filterExpression;
  }
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }

  const items = [];
  let lastKey;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new QueryCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

module.exports = {
  putItem,
  getItem,
  updateItem,
  deleteItem,
  scanTable,
  queryByIndex,
};
