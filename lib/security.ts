/**
 * Security Utilities
 * 
 * Rate limiting, input validation, sanitization
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAddress } from './address'

// Rate limiter using in-memory store (use Redis in production)
const rateLimits = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number    // Time window in milliseconds
  maxRequests: number // Max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100     // 100 requests per minute
}

/**
 * Rate limiting middleware
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const record = rateLimits.get(key)

  if (!record || now > record.resetTime) {
    // New window
    rateLimits.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    }
  }

  if (record.count >= config.maxRequests) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetTime - now
    }
  }

  // Increment
  record.count++
  rateLimits.set(key, record)

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetIn: record.resetTime - now
  }
}

/**
 * Apply rate limit to API route
 */
export function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig = DEFAULT_CONFIG
): NextResponse | null {
  // Use IP + path as key
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const path = request.nextUrl.pathname
  const key = `${ip}:${path}`

  const { allowed, remaining, resetIn } = rateLimit(key, config)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(resetIn / 1000) },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'Retry-After': Math.ceil(resetIn / 1000).toString()
        }
      }
    )
  }

  // Return response with rate limit headers
  return null // Null means continue (response handled elsewhere)
}

/**
 * Input validation
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateAgentId(agentId: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(agentId)
}

export function validateRating(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 5
}

export function validateRate(rate: number): boolean {
  return typeof rate === 'number' && rate > 0 && rate <= 1000
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

/**
 * Validate and sanitize agent registration input
 */
export function validateAgentInput(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.address || !validateAddress(data.address)) {
    errors.push('Invalid wallet address')
  }

  if (!data.name || typeof data.name !== 'string' || data.name.length < 2) {
    errors.push('Name must be at least 2 characters')
  }

  if (data.name && data.name.length > 100) {
    errors.push('Name must be less than 100 characters')
  }

  if (data.description && data.description.length > 1000) {
    errors.push('Description must be less than 1000 characters')
  }

  if (!data.voiceId || typeof data.voiceId !== 'string') {
    errors.push('Voice ID is required')
  }

  if (!data.capabilities || !Array.isArray(data.capabilities) || data.capabilities.length === 0) {
    errors.push('At least one capability is required')
  }

  if (!data.ratePerMinute || !validateRate(parseFloat(data.ratePerMinute))) {
    errors.push('Valid rate per minute is required (0-1000)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate and sanitize rating input
 */
export function validateRatingInput(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.agentId || !validateAgentId(data.agentId)) {
    errors.push('Valid agent ID is required')
  }

  if (!data.userAddress || !validateAddress(data.userAddress)) {
    errors.push('Valid user address is required')
  }

  if (!data.callId || typeof data.callId !== 'string') {
    errors.push('Call ID is required')
  }

  if (!validateRating(data.score)) {
    errors.push('Rating must be between 1 and 5')
  }

  if (data.comment && typeof data.comment === 'string' && data.comment.length > 500) {
    errors.push('Comment must be less than 500 characters')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
