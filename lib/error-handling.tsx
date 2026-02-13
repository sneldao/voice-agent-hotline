'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          margin: '1rem'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>
            ⚠️ Something went wrong
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '1rem' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * API Error handler
 */
export function handleApiError(error: any): { message: string; status: number } {
  console.error('[API Error]', error)

  if (error.name === 'ValidationError') {
    return { message: error.message, status: 400 }
  }

  if (error.name === 'UnauthorizedError') {
    return { message: 'Unauthorized', status: 401 }
  }

  if (error.name === 'ForbiddenError') {
    return { message: 'Forbidden', status: 403 }
  }

  if (error.name === 'NotFoundError') {
    return { message: 'Not found', status: 404 }
  }

  if (error.name === 'RateLimitError') {
    return { message: 'Too many requests', status: 429 }
  }

  return { message: 'Internal server error', status: 500 }
}

/**
 * Retry utility
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000 } = options

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (i === maxRetries - 1) throw error
      console.warn(`[Retry] Attempt ${i + 1} failed, retrying...`)
      await new Promise(r => setTimeout(r, delayMs * (i + 1)))
    }
  }

  throw new Error('Max retries exceeded')
}
