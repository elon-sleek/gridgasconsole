/**
 * Error Handling Utilities
 * 
 * Provides safe error messages that don't expose sensitive information to clients.
 * All API routes should use these helpers instead of directly returning error.message
 */

/**
 * Sanitize an error for client response
 * Removes sensitive details like database info, file paths, stack traces
 */
export function sanitizeError(error: unknown, fallbackMessage: string): string {
  if (!error) return fallbackMessage;

  // If it's already a safe string, return it
  if (typeof error === 'string' && !containsSensitiveInfo(error)) {
    return error;
  }

  // Extract message from Error object
  let message = fallbackMessage;
  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = String((error as any).message);
  }

  // Check if message contains sensitive information
  if (containsSensitiveInfo(message)) {
    return fallbackMessage;
  }

  // Return sanitized message
  return message || fallbackMessage;
}

/**
 * Check if a string contains sensitive information
 */
function containsSensitiveInfo(str: string): boolean {
  if (!str) return false;

  const sensitivePatterns = [
    /\bpassword\b/i,
    /\btoken\b/i,
    /\bsecret\b/i,
    /\bapi[_-]key\b/i,
    /\bprivate[_-]key\b/i,
    /\bsupabase[_-]service[_-]role\b/i,
    /postgres:\/\//i,
    /postgresql:\/\//i,
    /\b[a-f0-9]{32,}\b/i, // Looks like hash or UUID in error
    /file:\/\//i,
    /\/home\//i,
    /\/usr\//i,
    /\/var\//i,
    /C:\\/i,
    /stack trace/i,
    /at Object\./i,
    /at async/i,
  ];

  return sensitivePatterns.some(pattern => pattern.test(str));
}

/**
 * Log error safely (console.error) without exposing to client
 */
export function logError(context: string, error: unknown): void {
  // Only log in development or with explicit env var
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_ERROR_LOGGING === 'true') {
    console.error(`[${context}]`, error);
  }
}

/**
 * Standard error responses for common scenarios
 */
export const ErrorMessages = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Invalid request',
  VALIDATION_FAILED: 'Validation failed',
  INTERNAL_ERROR: 'An error occurred while processing your request',
  DATABASE_ERROR: 'Database operation failed',
  RATE_LIMIT: 'Too many requests, please try again later',
  CONFLICT: 'Resource already exists or conflict detected',
};

/**
 * Create a safe error response for API routes
 */
export function createErrorResponse(
  error: unknown,
  fallbackMessage: string,
  status: number = 500
): Response {
  const sanitized = sanitizeError(error, fallbackMessage);
  return Response.json({ error: sanitized }, { status });
}

/**
 * Safe error extractor for database errors
 * Returns generic message for most errors, but allows specific safe errors through
 */
export function sanitizeDatabaseError(error: unknown): string {
  if (!error) return ErrorMessages.DATABASE_ERROR;

  const message = error instanceof Error ? error.message : String(error);

  // Allow specific safe error messages
  const safeErrors = [
    'duplicate key',
    'unique constraint',
    'foreign key constraint',
    'violates not-null',
    'invalid input syntax',
    'record not found',
    'no rows',
  ];

  const isSafe = safeErrors.some(safe => message.toLowerCase().includes(safe));
  
  if (isSafe) {
    // Still sanitize but preserve the type of error
    if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
      return 'A record with this value already exists';
    }
    if (message.toLowerCase().includes('foreign key')) {
      return 'Cannot perform this action due to related records';
    }
    if (message.toLowerCase().includes('not-null')) {
      return 'Required field is missing';
    }
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('no rows')) {
      return 'Record not found';
    }
  }

  // Default safe message for all other database errors
  return ErrorMessages.DATABASE_ERROR;
}

/**
 * Safe error handler for try-catch blocks in API routes
 * 
 * Usage:
 * try {
 *   // ... operation
 * } catch (error) {
 *   return handleApiError(error, 'Failed to perform action');
 * }
 */
export function handleApiError(
  error: unknown,
  fallbackMessage: string,
  context?: string
): Response {
  // Log the full error server-side
  if (context) {
    logError(context, error);
  }

  // Return sanitized error to client
  const sanitized = sanitizeError(error, fallbackMessage);
  return Response.json({ error: sanitized }, { status: 500 });
}
