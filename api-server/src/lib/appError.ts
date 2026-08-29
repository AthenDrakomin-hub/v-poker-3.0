/**
 * 统一错误处理模块
 * 提供标准错误码和错误响应格式
 */

// 标准错误码枚举
export enum ErrorCode {
  // 认证相关 (1000-1099)
  UNAUTHORIZED = 'AUTH_001',
  FORBIDDEN = 'AUTH_002',
  INVALID_CREDENTIALS = 'AUTH_003',
  RATE_LIMITED = 'AUTH_004',

  // 房间相关 (2000-2099)
  ROOM_NOT_FOUND = 'ROOM_001',
  ROOM_FULL = 'ROOM_002',
  ROOM_NOT_ALLOWED = 'ROOM_003',
  ROOM_ALREADY_SETTLED = 'ROOM_004',

  // 筹码相关 (3000-3099)
  INSUFFICIENT_CHIPS = 'CHIP_001',
  CHIP_TRANSACTION_FAILED = 'CHIP_002',
  CHIPS_TRANSFER_FAILED = 'CHIP_003',

  // 游戏相关 (4000-4099)
  GAME_INVALID_STATE = 'GAME_001',
  GAME_INVALID_ACTION = 'GAME_002',
  GAME_TIMEOUT = 'GAME_003',

  // 系统相关 (5000-5099)
  INTERNAL_ERROR = 'SYS_001',
  DATABASE_ERROR = 'SYS_002',
  SERVICE_UNAVAILABLE = 'SYS_003',
}

// 标准错误响应格式
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
}

// 统一错误处理中间件
export function errorHandler(err: Error, req: any, res: any, next: any) {
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // 判断错误类型
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: ErrorCode.GAME_INVALID_ACTION,
      message: err.message,
    });
  }

  if (err.name === 'DatabaseError') {
    return res.status(500).json({
      code: ErrorCode.DATABASE_ERROR,
      message: '数据库操作失败，请稍后重试',
    });
  }

  // 默认服务器错误
  return res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
}

// 快速抛出标准化错误
export function throwAppError(code: ErrorCode, message: string, details?: Record<string, any>): never {
  const error = new Error(message) as Error & { code: ErrorCode; details?: Record<string, any> };
  error.code = code;
  error.details = details;
  throw error;
}

// 异步错误包装器（避免每个路由都写try-catch）
export function asyncHandler(fn: Function) {
  return async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
