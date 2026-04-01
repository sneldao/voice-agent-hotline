// ============================================
// Expert Credential Verification System
// ============================================
// Verifies real-world credentials for expert agents
// Legal, medical, financial, and technical certifications

import { redis } from './redis';
import type { Address } from 'viem';

// ============================================
// Types
// ============================================
export type CredentialType = 
  | 'bar_license'      // State bar association
  | 'medical_license'  // State medical board
  | 'npi_number'       // National Provider Identifier
  | 'cfa'              // Chartered Financial Analyst
  | 'cpa'              // Certified Public Accountant
  | 'cfp'              // Certified Financial Planner
  | 'series_7'         // FINRA Series 7
  | 'github'           // GitHub profile verification
  | 'linkedin'         // LinkedIn profile
  | 'portfolio'        // Portfolio website
  | 'certification'    // Other certifications
  | 'degree'           // Academic degree
  | 'other';

export interface Credential {
  type: CredentialType;
  value: string;
  jurisdiction?: string; // For licenses (e.g., "CA", "NY")
  issuedDate?: string;
  expiryDate?: string;
  proofUrl?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  verifiedAt?: number;
  verifiedBy?: string;
  rejectionReason?: string;
}

export interface ExpertProfile {
  agentId: string;
  name: string;
  credentials: Credential[];
  category: 'legal' | 'medical' | 'finance' | 'tech' | 'creative' | 'education' | 'business';
  walletAddress: Address;
  verificationLevel: 'none' | 'basic' | 'verified' | 'expert';
  trustScore: number; // 0-100
  createdAt: number;
  updatedAt: number;
}

// ============================================
// Verification Providers
// ============================================
interface VerificationProvider {
  name: string;
  verify: (credential: Credential) => Promise<{
    valid: boolean;
    details?: Record<string, any>;
    error?: string;
  }>;
}

// Mock verification providers (would integrate with real APIs in production)
const verificationProviders: Record<CredentialType, VerificationProvider> = {
  bar_license: {
    name: 'State Bar Association',
    verify: async (credential) => {
      // Would integrate with state bar APIs
      // e.g., https://www.calbar.ca.gov/ attorney search
      console.log('[Verify] Checking bar license:', credential.value, credential.jurisdiction);
      
      // Simulate API call
      await new Promise(r => setTimeout(r, 500));
      
      // Mock validation (in production, call actual state bar API)
      const isValid = credential.value.length >= 5 && !!credential.jurisdiction;
      
      return {
        valid: isValid,
        details: isValid ? {
          status: 'Active',
          admittedDate: '2015-06-15',
          practiceAreas: ['Corporate Law', 'Intellectual Property'],
        } : undefined,
        error: isValid ? undefined : 'Invalid license number or jurisdiction',
      };
    },
  },
  
  medical_license: {
    name: 'State Medical Board',
    verify: async (credential) => {
      console.log('[Verify] Checking medical license:', credential.value, credential.jurisdiction);
      
      await new Promise(r => setTimeout(r, 500));
      
      const isValid = credential.value.length >= 6 && !!credential.jurisdiction;
      
      return {
        valid: isValid,
        details: isValid ? {
          status: 'Active',
          specialty: 'Internal Medicine',
          boardCertified: true,
        } : undefined,
        error: isValid ? undefined : 'Invalid license number',
      };
    },
  },
  
  npi_number: {
    name: 'NPI Registry',
    verify: async (credential) => {
      // Would call https://npiregistry.cms.hhs.gov/api/
      console.log('[Verify] Checking NPI:', credential.value);
      
      await new Promise(r => setTimeout(r, 500));
      
      const isValid = credential.value.length === 10 && /^\d+$/.test(credential.value);
      
      return {
        valid: isValid,
        details: isValid ? {
          entityType: 'Individual',
          enumerationDate: '2010-03-15',
        } : undefined,
        error: isValid ? undefined : 'Invalid NPI format (must be 10 digits)',
      };
    },
  },
  
  cfa: {
    name: 'CFA Institute',
    verify: async (credential) => {
      console.log('[Verify] Checking CFA:', credential.value);
      
      await new Promise(r => setTimeout(r, 500));
      
      return {
        valid: true,
        details: {
          level: 'Charterholder',
          charterDate: '2018-09-01',
        },
      };
    },
  },
  
  cpa: {
    name: 'State Board of Accountancy',
    verify: async (credential) => {
      console.log('[Verify] Checking CPA:', credential.value, credential.jurisdiction);
      
      await new Promise(r => setTimeout(r, 500));
      
      const isValid = credential.value.length >= 4 && !!credential.jurisdiction;
      
      return {
        valid: isValid,
        details: isValid ? {
          status: 'Active',
          licenseType: 'CPA',
        } : undefined,
        error: isValid ? undefined : 'Invalid CPA license',
      };
    },
  },
  
  cfp: {
    name: 'CFP Board',
    verify: async (credential) => {
      console.log('[Verify] Checking CFP:', credential.value);
      
      await new Promise(r => setTimeout(r, 500));
      
      return {
        valid: true,
        details: {
          status: 'Active',
          certificationDate: '2019-01-15',
        },
      };
    },
  },
  
  series_7: {
    name: 'FINRA BrokerCheck',
    verify: async (credential) => {
      console.log('[Verify] Checking Series 7:', credential.value);
      
      await new Promise(r => setTimeout(r, 500));
      
      return {
        valid: true,
        details: {
          status: 'Active',
          registeredSince: '2017-03-20',
        },
      };
    },
  },
  
  github: {
    name: 'GitHub',
    verify: async (credential) => {
      try {
        const res = await fetch(`https://api.github.com/users/${credential.value}`);
        if (!res.ok) throw new Error('GitHub user not found');
        
        const data = await res.json();
        
        return {
          valid: true,
          details: {
            followers: data.followers,
            publicRepos: data.public_repos,
            createdAt: data.created_at,
            bio: data.bio,
          },
        };
      } catch (error: any) {
        return {
          valid: false,
          error: error.message,
        };
      }
    },
  },
  
  linkedin: {
    name: 'LinkedIn',
    verify: async (credential) => {
      // LinkedIn API requires OAuth, would need special handling
      console.log('[Verify] Checking LinkedIn:', credential.value);
      
      await new Promise(r => setTimeout(r, 300));
      
      return {
        valid: !!credential.value,
        details: {
          note: 'LinkedIn verification requires manual review',
        },
      };
    },
  },
  
  portfolio: {
    name: 'Portfolio Website',
    verify: async (credential) => {
      try {
        const res = await fetch(credential.value, { method: 'HEAD' });
        
        return {
          valid: res.ok,
          details: {
            url: credential.value,
            accessible: res.ok,
          },
          error: res.ok ? undefined : 'Portfolio website not accessible',
        };
      } catch (error: any) {
        return {
          valid: false,
          error: 'Could not reach portfolio website',
        };
      }
    },
  },
  
  certification: {
    name: 'Certification',
    verify: async (credential) => {
      // Generic certification - manual review
      console.log('[Verify] Checking certification:', credential.value);
      
      return {
        valid: true,
        details: {
          note: 'Requires manual verification',
          value: credential.value,
        },
      };
    },
  },
  
  degree: {
    name: 'Academic Degree',
    verify: async (credential) => {
      // Academic degrees typically require transcript verification
      console.log('[Verify] Checking degree:', credential.value);
      
      return {
        valid: true,
        details: {
          note: 'Requires manual verification',
          value: credential.value,
        },
      };
    },
  },
  
  other: {
    name: 'Other',
    verify: async (credential) => {
      console.log('[Verify] Checking other credential:', credential.value);
      
      return {
        valid: true,
        details: {
          note: 'Requires manual review',
          value: credential.value,
        },
      };
    },
  },
};

// ============================================
// Expert Verification Service
// ============================================
export class ExpertVerificationService {
  /**
   * Submit credentials for verification
   */
  async submitCredentials(
    agentId: string,
    credentials: Omit<Credential, 'verificationStatus'>[]
  ): Promise<ExpertProfile> {
    // Get or create profile
    let profile = await this.getProfile(agentId);
    
    if (!profile) {
      profile = {
        agentId,
        name: '',
        credentials: [],
        category: 'business',
        walletAddress: '0x0',
        verificationLevel: 'none',
        trustScore: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Add new credentials as pending
    const newCredentials: Credential[] = credentials.map(c => ({
      ...c,
      verificationStatus: 'pending',
    }));

    profile.credentials = [...profile.credentials, ...newCredentials];
    profile.updatedAt = Date.now();

    // Save to Redis
    await this.saveProfile(profile);

    // Trigger async verification
    this.verifyCredentialsAsync(agentId, newCredentials);

    return profile;
  }

  /**
   * Async verification of credentials
   */
  private async verifyCredentialsAsync(
    agentId: string,
    credentials: Credential[]
  ): Promise<void> {
    for (const credential of credentials) {
      try {
        const provider = verificationProviders[credential.type];
        if (!provider) {
          await this.updateCredentialStatus(
            agentId,
            credential.type,
            'rejected',
            'Unknown credential type'
          );
          continue;
        }

        console.log(`[ExpertVerify] Verifying ${credential.type} for ${agentId}...`);
        
        const result = await provider.verify(credential);
        
        if (result.valid) {
          await this.updateCredentialStatus(
            agentId,
            credential.type,
            'verified',
            undefined,
            result.details
          );
        } else {
          await this.updateCredentialStatus(
            agentId,
            credential.type,
            'rejected',
            result.error
          );
        }
      } catch (error: any) {
        console.error(`[ExpertVerify] Error verifying ${credential.type}:`, error);
        await this.updateCredentialStatus(
          agentId,
          credential.type,
          'rejected',
          error.message
        );
      }
    }

    // Recalculate trust score
    await this.recalculateTrustScore(agentId);
  }

  /**
   * Update credential status
   */
  private async updateCredentialStatus(
    agentId: string,
    credentialType: CredentialType,
    status: 'verified' | 'rejected' | 'expired',
    rejectionReason?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const profile = await this.getProfile(agentId);
    if (!profile) return;

    const credential = profile.credentials.find(c => c.type === credentialType);
    if (!credential) return;

    credential.verificationStatus = status;
    credential.verifiedAt = Date.now();
    
    if (rejectionReason) {
      credential.rejectionReason = rejectionReason;
    }

    if (details) {
      // Merge verification details
      Object.assign(credential, details);
    }

    await this.saveProfile(profile);

    console.log(`[ExpertVerify] Updated ${credentialType} to ${status} for ${agentId}`);
  }

  /**
   * Recalculate trust score based on verified credentials
   */
  private async recalculateTrustScore(agentId: string): Promise<void> {
    const profile = await this.getProfile(agentId);
    if (!profile) return;

    const verified = profile.credentials.filter(c => c.verificationStatus === 'verified');
    const total = profile.credentials.length;

    if (total === 0) {
      profile.trustScore = 0;
      profile.verificationLevel = 'none';
    } else {
      // Base score from verification rate
      const verificationRate = verified.length / total;
      let score = Math.round(verificationRate * 50); // Max 50 from verification

      // Bonus for high-value credentials
      const highValueTypes: CredentialType[] = ['bar_license', 'medical_license', 'cfa', 'cpa'];
      const hasHighValue = verified.some(c => highValueTypes.includes(c.type));
      if (hasHighValue) score += 25;

      // Bonus for multiple credentials
      if (verified.length >= 2) score += 15;
      if (verified.length >= 3) score += 10;

      profile.trustScore = Math.min(100, score);

      // Determine verification level
      if (profile.trustScore >= 80) {
        profile.verificationLevel = 'expert';
      } else if (profile.trustScore >= 50) {
        profile.verificationLevel = 'verified';
      } else if (profile.trustScore >= 20) {
        profile.verificationLevel = 'basic';
      } else {
        profile.verificationLevel = 'none';
      }
    }

    profile.updatedAt = Date.now();
    await this.saveProfile(profile);

    console.log(`[ExpertVerify] Trust score for ${agentId}: ${profile.trustScore} (${profile.verificationLevel})`);
  }

  /**
   * Get expert profile
   */
  async getProfile(agentId: string): Promise<ExpertProfile | null> {
    const data = await redis.hgetall(`expert:${agentId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return this.deserializeProfile(data as Record<string, string>);
  }

  /**
   * Save expert profile
   */
  private async saveProfile(profile: ExpertProfile): Promise<void> {
    await redis.hset(`expert:${profile.agentId}`, this.serializeProfile(profile));
    // Add to index set for efficient listing
    await redis.sadd('expert_index', profile.agentId);
  }

  /**
   * List experts by category
   */
  async listExperts(filters?: {
    category?: string;
    minTrustScore?: number;
    verificationLevel?: string;
  }): Promise<ExpertProfile[]> {
    // Use Set index instead of KEYS for O(1) lookup
    const expertIds = await redis.smembers('expert_index');
    if (expertIds.length === 0) return [];

    // Batch fetch with pipeline
    const pipeline = redis.pipeline();
    expertIds.forEach(id => pipeline.hgetall(`expert:${id}`));
    const results = await pipeline.exec();

    const experts: ExpertProfile[] = [];
    for (const raw of results || []) {
      const data = (raw as [Error | null, Record<string, string>])[1];
      if (!data) continue;

      const profile = this.deserializeProfile(data);

      // Apply filters
      if (filters?.category && profile.category !== filters.category) continue;
      if (filters?.minTrustScore && profile.trustScore < filters.minTrustScore) continue;
      if (filters?.verificationLevel && profile.verificationLevel !== filters.verificationLevel) continue;

      experts.push(profile);
    }

    // Sort by trust score
    experts.sort((a, b) => b.trustScore - a.trustScore);

    return experts;
  }

  /**
   * Manual verification by admin
   */
  async manualVerify(
    agentId: string,
    credentialType: CredentialType,
    verified: boolean,
    notes?: string
  ): Promise<void> {
    await this.updateCredentialStatus(
      agentId,
      credentialType,
      verified ? 'verified' : 'rejected',
      verified ? undefined : notes
    );

    console.log(`[ExpertVerify] Manual ${verified ? 'verification' : 'rejection'} for ${agentId}: ${credentialType}`);
  }

  // ============================================
  // Serialization
  // ============================================
  private serializeProfile(profile: ExpertProfile): Record<string, string> {
    return {
      agentId: profile.agentId,
      name: profile.name,
      credentials: JSON.stringify(profile.credentials),
      category: profile.category,
      walletAddress: profile.walletAddress,
      verificationLevel: profile.verificationLevel,
      trustScore: profile.trustScore.toString(),
      createdAt: profile.createdAt.toString(),
      updatedAt: profile.updatedAt.toString(),
    };
  }

  private deserializeProfile(data: Record<string, string>): ExpertProfile {
    return {
      agentId: data.agentId,
      name: data.name,
      credentials: JSON.parse(data.credentials || '[]'),
      category: data.category as ExpertProfile['category'],
      walletAddress: data.walletAddress as Address,
      verificationLevel: data.verificationLevel as ExpertProfile['verificationLevel'],
      trustScore: parseInt(data.trustScore),
      createdAt: parseInt(data.createdAt),
      updatedAt: parseInt(data.updatedAt),
    };
  }
}

// ============================================
// Singleton
// ============================================
export const expertVerification = new ExpertVerificationService();

// ============================================
// Expert Categories with Requirements
// ============================================
export const EXPERT_CATEGORIES = {
  legal: {
    name: 'Legal',
    description: 'Attorneys, paralegals, legal consultants',
    requiredCredentials: ['bar_license'],
    recommendedCredentials: ['degree', 'certification'],
    minTrustScore: 60,
  },
  medical: {
    name: 'Medical & Health',
    description: 'Doctors, nurses, nutritionists, therapists',
    requiredCredentials: ['medical_license', 'npi_number'],
    recommendedCredentials: ['certification', 'degree'],
    minTrustScore: 70,
  },
  finance: {
    name: 'Finance',
    description: 'Financial advisors, accountants, analysts',
    requiredCredentials: [],
    recommendedCredentials: ['cfa', 'cpa', 'cfp', 'series_7'],
    minTrustScore: 40,
  },
  tech: {
    name: 'Technology',
    description: 'Developers, engineers, IT specialists',
    requiredCredentials: [],
    recommendedCredentials: ['github', 'certification', 'portfolio'],
    minTrustScore: 30,
  },
  creative: {
    name: 'Creative',
    description: 'Designers, writers, artists',
    requiredCredentials: [],
    recommendedCredentials: ['portfolio', 'linkedin'],
    minTrustScore: 20,
  },
  education: {
    name: 'Education',
    description: 'Tutors, teachers, trainers',
    requiredCredentials: [],
    recommendedCredentials: ['degree', 'certification', 'linkedin'],
    minTrustScore: 30,
  },
  business: {
    name: 'Business',
    description: 'Consultants, coaches, strategists',
    requiredCredentials: [],
    recommendedCredentials: ['linkedin', 'certification'],
    minTrustScore: 20,
  },
};
