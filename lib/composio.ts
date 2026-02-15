// ============================================
// Composio Tool Integration
// ============================================
// Connects agents to external tools via Composio
// https://composio.dev

export interface ComposioToolCall {
  tool_slug: string;
  arguments: Record<string, any>;
}

export interface ComposioToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ComposioService {
  private apiKey: string;
  private baseUrl = 'https://backend.composio.dev/api/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMPOSIO_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[Composio] API key not configured');
    }
  }

  /**
   * Execute a Composio tool
   */
  async executeTool(call: ComposioToolCall): Promise<ComposioToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/actions/${call.tool_slug}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          input: call.arguments,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Composio tool execution failed: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        data: result.data || result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Map agent skill type to Composio tools
   */
  getToolsForSkill(skillType: string): string[] {
    const toolMap: Record<string, string[]> = {
      blockchain: [
        'SOLANA_GET_BALANCE',
        'SOLANA_GET_TRANSACTION',
      ],
      code: [
        'GITHUB_LIST_REPOS',
        'GITHUB_GET_REPOSITORY_CONTENT',
        'GITHUB_SEARCH_CODE',
        'GITHUB_CREATE_AN_ISSUE',
      ],
      research: [
        'WEB_SEARCH',
      ],
      general: [
        'WEB_SEARCH',
      ],
    };

    return toolMap[skillType] || [];
  }
}

export const composioService = new ComposioService();
