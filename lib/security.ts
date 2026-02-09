/**
 * Security utilities - Input sanitization, XSS prevention, CORS
 */

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize HTML content (for rich text)
 */
export function sanitizeHTML(html: string): string {
  // Allow only safe tags
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/on\w+=\w+/gi, '');
}

/**
 * Validate and sanitize URLs
 */
export function sanitizeURL(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Only allow safe protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Remove dangerous patterns
    const sanitized = parsed.toString()
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '');
    
    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Validate Ethereum addresses
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate UUID v4
 */
export function isValidUUIDv4(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    maxStringLength?: number;
    allowedFields?: string[];
  } = {}
): T {
  const { maxStringLength = 1000, allowedFields } = options;
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    if (allowedFields && !allowedFields.includes(key)) {
      delete sanitized[key];
      continue;
    }
    
    const value = sanitized[key];
    
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeInput(
        value.slice(0, maxStringLength)
      );
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>,
        options
      );
    }
  }
  
  return sanitized;
}

/**
 * Rate limit by IP
 */
export function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

/**
 * CORS configuration helper
 */
export function createCORSHeaders(origin: string = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle CORS preflight
 */
export function handleCORS(request: Request, origin: string = '*'): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: createCORSHeaders(origin),
    });
  }
  return null;
}

/**
 * Security headers for responses
 */
export function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

/**
 * Add security headers to response
 */
export function withSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  const headers = securityHeaders();
  
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Validate content type
 */
export function requireJSON(request: Request): Response | null {
  const contentType = request.headers.get('content-type');
  
  if (!contentType?.includes('application/json')) {
    return new Response(
      JSON.stringify({ error: 'Content-Type must be application/json' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return null;
}

/**
 * Maximum request body size (10MB)
 */
export const MAX_BODY_SIZE = 10 * 1024 * 1024;

/**
 * Validate request body size
 */
export async function validateBodySize(request: Request): Promise<Response | null> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  return null;
}

/**
 * Create a secure API response
 */
export function secureResponse(
  data: unknown,
  options: {
    status?: number;
    cors?: boolean;
  } = {}
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...securityHeaders(),
  };
  
  if (options.cors) {
    Object.assign(headers, createCORSHeaders());
  }
  
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers,
  });
}

/**
 * Create an error response with sanitized message
 */
export function secureErrorResponse(
  message: string,
  code: string,
  status: number = 400
): Response {
  // Don't leak internal details in error messages
  const sanitizedMessage = sanitizeInput(message);
  
  return secureResponse({
    error: {
      code,
      message: sanitizedMessage,
    },
  }, { status });
}
