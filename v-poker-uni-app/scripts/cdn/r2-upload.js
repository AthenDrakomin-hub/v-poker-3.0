/**
 * V-Poker 静态资源上传到 Cloudflare R2
 *
 * 用法:
 *   1. 复制 r2-config.json.example 为 r2-config.json，填入凭证
 *   2. node r2-upload.js
 *   3. node r2-upload.js --dry-run    (仅预览不上传)
 *   4. node r2-upload.js --delete     (先清空bucket再上传)
 *
 * 依赖: @aws-sdk/client-s3, @aws-sdk/lib-storage, mime-types
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const mime = require('mime-types');

// ========== 配置 ==========
const CONFIG_PATH = path.join(__dirname, 'r2-config.json');
const EXAMPLE_PATH = path.join(__dirname, 'r2-config.json.example');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ 未找到 r2-config.json');
    console.error('   请执行: copy r2-config.json.example r2-config.json');
    console.error('   然后填入你的 R2 Access Key ID 和 Secret Access Key');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  if (config.accessKeyId === 'YOUR_ACCESS_KEY_ID' || !config.accessKeyId) {
    console.error('❌ 请在 r2-config.json 中填入真实的 accessKeyId 和 secretAccessKey');
    console.error('   获取路径: Cloudflare Dashboard → R2 → Manage R2 API Tokens');
    process.exit(1);
  }
  return config;
}

// ========== 参数解析 ==========
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DO_DELETE = args.includes('--delete');

// ========== S3 客户端 ==========
function createS3Client(config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

// ========== 文件扫描 ==========
function scanFiles(sourceDir, keyPrefix) {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(sourceDir, fullPath).replace(/\\/g, '/');
        const key = keyPrefix + relativePath;
        const stats = fs.statSync(fullPath);
        files.push({
          localPath: fullPath,
          key,
          size: stats.size,
          contentType: mime.lookup(fullPath) || 'application/octet-stream',
        });
      }
    }
  }
  walk(sourceDir);
  return files;
}

// ========== 上传单文件 ==========
async function uploadFile(s3Client, bucket, file, cacheControl) {
  const fileStream = fs.createReadStream(file.localPath);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: file.key,
      Body: fileStream,
      ContentType: file.contentType,
      CacheControl: cacheControl,
      // R2 不支持 ACL，但设置了也不报错
    },
    // 分片上传配置
    partSize: 5 * 1024 * 1024, // 5MB
    leavePartsOnError: false,
  });

  // 进度回调
  upload.on('httpUploadProgress', (progress) => {
    if (progress.total) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      process.stdout.write(`\r   ↑ ${path.basename(file.key)} ${pct}% (${(progress.loaded/1024).toFixed(0)}/${(progress.total/1024).toFixed(0)}KB)`);
    }
  });

  await upload.done();
  process.stdout.write('\n');
}

// ========== 清空 Bucket ==========
async function emptyBucket(s3Client, bucket, prefix) {
  console.log(`\n🗑️  清空 bucket 中 ${prefix ? '前缀 ' + prefix : '全部'} 对象...`);
  let continuationToken = null;
  let deleted = 0;
  do {
    const listParams = { Bucket: bucket, MaxKeys: 1000 };
    if (prefix) listParams.Prefix = prefix;
    if (continuationToken) listParams.ContinuationToken = continuationToken;

    const listResult = await s3Client.send(new ListObjectsV2Command(listParams));
    if (listResult.Contents && listResult.Contents.length > 0) {
      for (const obj of listResult.Contents) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
        deleted++;
        process.stdout.write(`\r   删除 ${deleted} 个对象...`);
      }
    }
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);
  process.stdout.write('\n');
  console.log(`   ✅ 已删除 ${deleted} 个对象`);
}

// ========== 并发上传 ==========
async function uploadConcurrent(s3Client, bucket, files, cacheControl, concurrency) {
  let success = 0;
  let failed = 0;
  let index = 0;
  const total = files.length;
  const startTime = Date.now();

  async function worker(workerId) {
    while (index < total) {
      const currentIndex = index++;
      const file = files[currentIndex];
      const num = currentIndex + 1;
      try {
        console.log(`[${num}/${total}] W${workerId} → ${file.key} (${(file.size/1024).toFixed(1)}KB, ${file.contentType})`);
        if (!DRY_RUN) {
          await uploadFile(s3Client, bucket, file, cacheControl);
        }
        success++;
      } catch (err) {
        failed++;
        console.error(`\n   ❌ 上传失败: ${file.key}`);
        console.error(`      ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  return { success, failed, elapsed };
}

// ========== 主流程 ==========
async function main() {
  console.log('========================================');
  console.log('  V-Poker 静态资源 → Cloudflare R2');
  console.log('========================================\n');

  const config = loadConfig();
  const uploadConfig = config._uploadConfig || {};
  const sourceDir = path.resolve(__dirname, uploadConfig.sourceDir || '../static');
  const keyPrefix = uploadConfig.keyPrefix || 'static/';
  const cdnBaseUrl = uploadConfig.cdnBaseUrl || `https://${config.bucketName}.r2.dev`;
  const concurrency = uploadConfig.concurrentUploads || 5;
  const cacheControl = uploadConfig.cacheControl || 'public, max-age=31536000, immutable';

  console.log(`📦 Bucket: ${config.bucketName}`);
  console.log(`📂 源目录: ${sourceDir}`);
  console.log(`🔑 Key前缀: ${keyPrefix}`);
  console.log(`🌐 CDN: ${cdnBaseUrl}`);
  console.log(`⚡ 并发数: ${concurrency}`);
  if (DRY_RUN) console.log('🔍 模式: DRY-RUN (仅预览)');
  console.log('');

  // 检查源目录
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ 源目录不存在: ${sourceDir}`);
    process.exit(1);
  }

  // 扫描文件
  console.log('🔍 扫描文件...');
  const files = scanFiles(sourceDir, keyPrefix);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`   找到 ${files.length} 个文件, 总计 ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  // 按类型统计
  const byType = {};
  for (const f of files) {
    const ext = path.extname(f.key) || '(无)';
    byType[ext] = (byType[ext] || 0) + 1;
  }
  console.log('📊 文件类型统计:');
  for (const [ext, count] of Object.entries(byType).sort()) {
    console.log(`   ${ext}: ${count} 个`);
  }
  console.log('');

  // 创建 S3 客户端
  const s3Client = createS3Client(config);

  // 可选：清空 bucket
  if (DO_DELETE && !DRY_RUN) {
    await emptyBucket(s3Client, config.bucketName, keyPrefix);
  }

  // 上传
  console.log(`🚀 开始上传 ${DRY_RUN ? '(预览模式)' : ''}...\n`);
  const result = await uploadConcurrent(s3Client, config.bucketName, files, cacheControl, concurrency);

  // 结果
  console.log('\n========================================');
  console.log('  上传完成');
  console.log('========================================');
  console.log(`   ✅ 成功: ${result.success}`);
  console.log(`   ❌ 失败: ${result.failed}`);
  console.log(`   ⏱️  耗时: ${result.elapsed}s`);
  console.log(`   🌐 CDN 基准URL: ${cdnBaseUrl}`);
  console.log(`   📄 示例: ${cdnBaseUrl}/${keyPrefix}logo-horizontal.png`);
  console.log('');

  if (result.failed > 0) {
    console.log('⚠️  有文件上传失败，请检查网络和凭证后重试');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ 致命错误:', err.message);
  console.error(err.stack);
  process.exit(1);
});
