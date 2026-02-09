/**
 * Circuit Breaker pattern for external API calls
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Successes needed to close from half-open
  timeout: number; // Time in ms before trying again
}

interface CircuitStateInfo {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

interface CircuitBreakerMetrics {
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
  currentState: CircuitState;
}

class CircuitBreaker {
  private state: CircuitStateInfo = {
    state: 'CLOSED',
    failureCount: 0,
    successCount: 0,
    lastFailureTime: null,
    nextAttemptTime: null,
  };

  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics = {
    totalCalls: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    currentState: 'CLOSED',
  };

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  private transitionTo(state: CircuitState): void {
    this.state.state = state;
    this.metrics.currentState = state;

    if (state === 'OPEN') {
      this.state.nextAttemptTime = Date.now() + this.config.timeout;
    } else if (state === 'HALF_OPEN') {
      this.state.successCount = 0;
      this.state.failureCount = 0;
    }
  }

  private recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    this.metrics.totalFailures++;

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private recordSuccess(): void {
    this.state.successCount++;
    this.metrics.totalSuccesses++;

    if (this.state.state === 'HALF_OPEN') {
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.metrics.totalCalls++;

    // Check if circuit is open
    if (this.state.state === 'OPEN') {
      if (Date.now() >= (this.state.nextAttemptTime ?? 0)) {
        this.transitionTo('HALF_OPEN');
      } else {
        // Circuit is open, use fallback or throw
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker is OPEN. Retry after ${new Date(this.state.nextAttemptTime!).toISOString()}`);
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Force the circuit breaker into a specific state
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
    if (state === 'CLOSED') {
      this.state.failureCount = 0;
      this.state.successCount = 0;
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null,
    };
    this.metrics = {
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      currentState: 'CLOSED',
    };
  }

  /**
   * Get current state info
   */
  getState(): CircuitStateInfo {
    return { ...this.state };
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if circuit is closed (healthy)
   */
  isHealthy(): boolean {
    return this.state.state === 'CLOSED';
  }
}

// Pre-configured circuit breakers for external services
export const elevenLabsBreaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  successThreshold: 3, // Close after 3 successes
  timeout: 30 * 1000, // Try again after 30 seconds
});

export const bankrBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60 * 1000,
});

export const ethereumBreaker = new CircuitBreaker({
  failureThreshold: 10,
  successThreshold: 5,
  timeout: 15 * 1000,
});

export const celoBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30 * 1000,
});

/**
 * Execute with circuit breaker and fallback
 */
export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return breaker.execute(fn, fallback);
}
