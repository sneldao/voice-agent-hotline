// ============================================
// Venice AI Integration
// ============================================
// Privacy-first AI via Venice's OpenAI-compatible API.
// Used as a secondary LLM for deep reasoning, research,
// and analysis tasks during voice agent calls.
//
// Docs: https://venice.ai
// API:  https://api.venice.ai/api/v1
// ============================================

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';

export interface VeniceCompletionRequest {
  /** The model to use. Defaults to 'llama-3.3-70b' */
  model?: string;
  /** System prompt for the assistant */
  system?: string;
  /** User message / prompt */
  prompt: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
}

export interface VeniceCompletionResponse {
  text: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface VeniceResearchResult {
  summary: string;
  keyPoints: string[];
  confidence: number;
  sources?: string[];
  model: string;
  tokensUsed: number;
}

// ============================================
// Venice API Client
// ============================================

export class VeniceAIClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VENICE_API_KEY || '';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a chat completion to Venice AI.
   * Venice's API is OpenAI-compatible, so we use the standard /chat/completions endpoint.
   */
  async chatCompletion(params: VeniceCompletionRequest): Promise<VeniceCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('VENICE_API_KEY not configured. Get one at https://venice.ai');
    }

    const startTime = Date.now();
    
    const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || 'llama-3.3-70b',
        messages: [
          ...(params.system ? [{ role: 'system', content: params.system }] : []),
          { role: 'user', content: params.prompt },
        ],
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Venice API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { total_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content || '',
      model: data.model,
      tokensUsed: data.usage?.total_tokens || 0,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Perform deep research using Venice AI.
   * Takes a user query and returns a structured analysis.
   */
  async research(query: string, context?: string): Promise<VeniceResearchResult> {
    const systemPrompt = `You are a research analyst. Analyze the following query and provide:
1. A concise 2-3 sentence summary
2. 3-5 key bullet points
3. A confidence score (0-100)
${context ? `\nAdditional context: ${context}` : ''}

Respond in JSON format:
{"summary": "...", "keyPoints": ["...", "..."], "confidence": 85}`;

    const result = await this.chatCompletion({
      model: 'llama-3.3-70b',
      system: systemPrompt,
      prompt: query,
      maxTokens: 800,
      temperature: 0.3,
    });

    // Parse JSON from response
    try {
      const parsed = JSON.parse(result.text);
      return {
        summary: parsed.summary || result.text.slice(0, 200),
        keyPoints: parsed.keyPoints || [],
        confidence: parsed.confidence || 70,
        sources: parsed.sources,
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    } catch {
      // If JSON parsing fails, return the raw text as summary
      const lines = result.text.split('\n').filter(l => l.trim());
      return {
        summary: lines[0] || result.text.slice(0, 200),
        keyPoints: lines.slice(1, 6),
        confidence: 60,
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    }
  }

  /**
   * Generate an image via Venice AI.
   * Venice supports multiple image models.
   */
  async generateImage(params: {
    prompt: string;
    model?: string;
    width?: number;
    height?: number;
  }): Promise<{ url: string; model: string }> {
    if (!this.apiKey) throw new Error('VENICE_API_KEY not configured');

    const response = await fetch(`${VENICE_BASE_URL}/image/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || 'flux-dev',
        prompt: params.prompt,
        width: params.width || 1024,
        height: params.height || 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Venice image API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json() as { images: Array<{ url: string }> };
    return {
      url: data.images?.[0]?.url || '',
      model: params.model || 'flux-dev',
    };
  }

  /**
   * Code review using Venice AI.
   * Privacy-first — code never leaves Venice's secure infrastructure.
   */
  async codeReview(params: {
    code: string;
    language?: string;
    focus?: string[];
  }): Promise<{
    summary: string;
    issues: Array<{ severity: string; description: string; line?: number }>;
    suggestions: string[];
  }> {
    const systemPrompt = `You are a senior code reviewer. Analyze the following ${params.language || 'code'} for:
${params.focus?.join(', ') || 'bugs, security issues, performance problems, and code quality'}

Respond in JSON:
{"summary": "...", "issues": [{"severity": "high|medium|low", "description": "...", "line": number}], "suggestions": ["..."]}`;

    const result = await this.chatCompletion({
      model: 'llama-3.3-70b',
      system: systemPrompt,
      prompt: params.code.slice(0, 8000), // Truncate for API limits
      maxTokens: 1200,
      temperature: 0.2,
    });

    try {
      return JSON.parse(result.text);
    } catch {
      return {
        summary: result.text.slice(0, 300),
        issues: [],
        suggestions: [],
      };
    }
  }
}

// ============================================
// Singleton
// ============================================

export const veniceAI = new VeniceAIClient();