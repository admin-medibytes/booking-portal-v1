export enum ErrorCode {
  // Database errors
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_TRANSACTION_FAILED = 'DB_TRANSACTION_FAILED',
  DB_CONSTRAINT_VIOLATION = 'DB_CONSTRAINT_VIOLATION',
  DB_UNIQUE_VIOLATION = 'DB_UNIQUE_VIOLATION',
  DB_FOREIGN_KEY_VIOLATION = 'DB_FOREIGN_KEY_VIOLATION',
  
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Authentication & Authorization errors
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  
  // Business logic errors
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // System errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Invitation errors
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_ALREADY_USED = 'INVITATION_ALREADY_USED',
}

export interface ErrorDetails {
  field?: string;
  constraint?: string;
  table?: string;
  value?: unknown;
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: ErrorDetails,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

export class DatabaseError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: ErrorDetails,
    originalError?: Error
  ) {
    super(code, message, 500, details);
    this.name = 'DatabaseError';
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }

  static fromPostgresError(error: unknown): DatabaseError {
    const pgError = error as Record<string, unknown>;
    
    // Handle common PostgreSQL error codes
    switch (pgError.code) {
      case '23505': // unique_violation
        return new DatabaseError(
          ErrorCode.DB_UNIQUE_VIOLATION,
          'Unique constraint violation',
          {
            constraint: pgError.constraint_name as string,
            table: pgError.table_name as string,
            detail: pgError.detail as string,
          },
          error as Error
        );
      
      case '23503': // foreign_key_violation
        return new DatabaseError(
          ErrorCode.DB_FOREIGN_KEY_VIOLATION,
          'Foreign key constraint violation',
          {
            constraint: pgError.constraint_name as string,
            table: pgError.table_name as string,
            detail: pgError.detail as string,
          },
          error as Error
        );
      
      case '23502': // not_null_violation
        return new DatabaseError(
          ErrorCode.DB_CONSTRAINT_VIOLATION,
          'Not null constraint violation',
          {
            column: pgError.column_name as string,
            table: pgError.table_name as string,
          },
          error as Error
        );
      
      case '08006': // connection_failure
      case '08001': // sqlclient_unable_to_establish_sqlconnection
      case '08004': // sqlserver_rejected_establishment_of_sqlconnection
        return new DatabaseError(
          ErrorCode.DB_CONNECTION_FAILED,
          'Database connection failed',
          {
            detail: pgError.message as string,
          },
          error as Error
        );
      
      default:
        return new DatabaseError(
          ErrorCode.DB_QUERY_FAILED,
          (pgError.message as string) || 'Database query failed',
          {
            code: pgError.code as string,
            detail: pgError.detail as string,
            hint: pgError.hint as string,
          },
          error as Error
        );
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: unknown) {
    super(
      ErrorCode.VALIDATION_FAILED,
      message,
      400,
      { field, value }
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      ErrorCode.ENTITY_NOT_FOUND,
      `${entity} not found${id ? ` with id: ${id}` : ''}`,
      404,
      { entity, id }
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(ErrorCode.AUTHENTICATION_REQUIRED, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(ErrorCode.INSUFFICIENT_PERMISSIONS, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class BannedError extends AppError {
  constructor(message: string = 'You have been banned from this application') {
    super(ErrorCode.ACCOUNT_BANNED, message, 403);
    this.name = 'BannedError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.RESOURCE_CONFLICT, message, 409, details);
    this.name = 'ConflictError';
  }
}

// Error handler wrapper for database operations
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    const dbError = DatabaseError.fromPostgresError(error);
    if (context) {
      dbError.message = `${context}: ${dbError.message}`;
    }
    
    throw dbError;
  }
}

// Type guard for operational errors
export function isOperationalError(error: Error): error is AppError {
  return error instanceof AppError && error.isOperational;
}