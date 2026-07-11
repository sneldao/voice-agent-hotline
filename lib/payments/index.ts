/**
 * Payments Module — unified entrypoint
 *
 * Re-exports the VoicePaymentService (per-second billing, session management).
 * On-chain settlement logic lives in lib/payment-settlement.ts (single source of truth).
 *
 * Import from here for session/billing concerns:
 *   import { VoicePaymentService } from '@/lib/payments'
 *
 * Import from payment-settlement directly for on-chain settlement:
 *   import { paymentSettlement, EIP712_DOMAIN } from '@/lib/payment-settlement'
 */

export {
  VoicePaymentService,
  getVoicePaymentService,
  resetVoicePaymentService
} from './x402'

export type { CallSession, PaymentAuthorization } from './x402'
