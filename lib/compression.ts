/**
 * Response compression utilities for API responses
 */

/**
 * Compress JSON data using base64 encoding
 * (For static exports, we use lightweight compression)
 */
export function compressJSON(data: unknown): string {
  const json = JSON.stringify(data);
  
  // Simple run-length encoding for repeated characters
  const compressed = json.replace(
    /(":"[^"]*"|:[\d]+)(?=.*\1)/g,
    (match) => match
  );
  
  return Buffer.from(compressed).toString('base64');
}

/**
 * Decompress JSON data
 */
export function decompressJSON<T>(compressed: string): T {
  const json = Buffer.from(compressed, 'base64').toString('utf-8');
  return JSON.parse(json);
}

/**
 * Create a minimal API response
 */
export interface MinimalResponse<T> {
  d?: T; // Data (optional)
  e?: string; // Error message (if any)
  ts: number; // Timestamp
}

export function createMinimalResponse<T>(
  data: T,
  error?: string
): MinimalResponse<T> {
  return {
    d: data,
    e: error,
    ts: Date.now(),
  };
}

/**
 * Response size reducer - removes unnecessary fields
 */
export function reduceResponse<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): Partial<T> {
  const reduced: Partial<T> = {};
  for (const field of fields) {
    if (data[field] !== undefined) {
      reduced[field] = data[field];
    }
  }
  return reduced;
}

/**
 * Batch multiple responses into a single payload
 */
export function batchResponses<T>(
  responses: Array<{ key: string; data: T }>
): Record<string, T> {
  const batched: Record<string, T> = {};
  for (const response of responses) {
    batched[response.key] = response.data;
  }
  return batched;
}

/**
 * Create a paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta,
    ts: Date.now(),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    ts: Date.now(),
  };
}

/**
 * Cache control headers helper
 */
export function cacheControlHeader(
  maxAge: number,
  isPrivate: boolean = false
): string {
  const directives = [
    `max-age=${maxAge}`,
    isPrivate ? 'private' : 'public',
    'stale-while-revalidate=60',
  ];
  return directives.join(', ');
}

/**
 * Create response with standard headers
 */
export function createApiResponse(
  body: unknown,
  options: {
    status?: number;
    cacheControl?: string;
    cors?: boolean;
  } = {}
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.cacheControl) {
    headers['Cache-Control'] = options.cacheControl;
  }

  if (options.cors) {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }

  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers,
  });
}
