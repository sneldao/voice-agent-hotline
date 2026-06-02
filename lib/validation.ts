/**
 * Request validation schemas using Zod
 */

import { z } from 'zod';

// Agent schema
export const AgentSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  specialty: z.string().min(1).max(200),
  bio: z.string().min(1).max(1000),
  rating: z.number().min(0).max(5),
  totalRatings: z.number().int().min(0),
  rate: z.number().min(0).max(100),
  avatar: z.string().emoji().optional(),
  color: z.string().optional(),
  online: z.boolean().default(false),
  tags: z.array(z.string()).max(10).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

// Call request schema
export const CallRequestSchema = z.object({
  agentId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export type CallRequest = z.infer<typeof CallRequestSchema>;

// Payment schema
export const PaymentSchema = z.object({
  agentId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(['USDC', 'USDT', 'ETH']).default('USDC'),
  duration: z.number().int().positive(), // in seconds
});

export type Payment = z.infer<typeof PaymentSchema>;

// Agent registration schema
export const AgentRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  specialty: z.string().min(1).max(200),
  bio: z.string().min(1).max(1000),
  rate: z.number().min(0).max(100),
  tags: z.array(z.string()).max(10),
  voiceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentRegistration = z.infer<typeof AgentRegistrationSchema>;

// Search query schema
export const SearchQuerySchema = z.object({
  q: z.string().min(0).max(200).optional(),
  category: z.string().optional(),
  minRating: z.number().min(0).max(5).optional(),
  maxRate: z.number().min(0).optional(),
  onlineOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// Validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errorMessages = result.error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');
  
  return { success: false, error: errorMessages };
}

// Validation error response
export function createValidationErrorResponse(errors: string) {
  return new Response(
    JSON.stringify({
      error: 'Validation Error',
      message: errors,
      code: 'VALIDATION_ERROR',
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// API error response
export function createErrorResponse(
  message: string,
  code: string,
  status: number = 400
) {
  return new Response(
    JSON.stringify({
      error: message,
      code,
      status,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// Success response helper
export function createSuccessResponse<T>(
  data: T,
  rateLimitHeaders?: Record<string, string>
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (rateLimitHeaders) {
    Object.assign(headers, rateLimitHeaders);
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    { status: 200, headers }
  );
}
