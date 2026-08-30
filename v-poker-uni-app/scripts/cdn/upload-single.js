/**
 * 单文件上传到 Cloudflare R2（临时脚本）
 * 用法: node upload-single.js <localPath> <s3Key>
 */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

const CONFIG_PATH = path.join(__dirname, 'r2-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const localPath = process.argv[2];
const s3Key = process.argv[3];

if (!localPath || !s3Key) {
  console.error('用法: node upload-single.js <localPath> <s3Key>');
  process.exit(1);
}

const fullLocalPath = path.resolve(localPath);
if (!fs.existsSync(fullLocalPath)) {
  console.error('文件不存在:', fullLocalPath);
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
  forcePathStyle: true,
});

const fileStream = fs.createReadStream(fullLocalPath);
const contentType = mime.lookup(fullLocalPath) || 'application/octet-stream';
const fileSize = fs.statSync(fullLocalPath).size;

console.log('上传文件:', fullLocalPath);
console.log('S3 Key:', s3Key);
console.log('Content-Type:', contentType);
console.log('大小:', (fileSize / 1024).toFixed(1), 'KB');
console.log('Bucket:', config.bucketName);
console.log('');

const command = new PutObjectCommand({
  Bucket: config.bucketName,
  Key: s3Key,
  Body: fileStream,
  ContentType: contentType,
  CacheControl: 'public, max-age=31536000, immutable',
});

s3Client.send(command)
  .then((result) => {
    console.log('上传成功!');
    console.log('ETag:', result.ETag);
    console.log('CDN URL:', `${config._uploadConfig.cdnBaseUrl}/${s3Key}`);
  })
  .catch((err) => {
    console.error('上传失败:', err.message);
    process.exit(1);
  });
