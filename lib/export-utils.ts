import { CallRecord } from './useCallHistory';
import { getExplorerTxUrl } from './superfluid-streaming';

export interface ExportOptions {
  format: 'txt' | 'json' | 'pdf' | 'csv';
  includeMetadata?: boolean;
  includeTranscript?: boolean;
}

export function exportCall(call: CallRecord, options: ExportOptions): { filename: string; content: string; mimeType: string } {
  const timestamp = new Date(call.timestamp).toISOString().split('T')[0];

  switch (options.format) {
    case 'json':
      return exportAsJSON(call, timestamp);
    case 'pdf':
      return exportAsPDF(call, timestamp);
    case 'csv':
      return exportAsCSV(call, timestamp);
    case 'txt':
    default:
      return exportAsTXT(call, timestamp);
  }
}

function exportAsJSON(call: CallRecord, timestamp: string): { filename: string; content: string; mimeType: string } {
  const data = {
    callId: call.id,
    agent: {
      id: call.agentId,
      name: call.agentName,
      specialty: call.agentSpecialty,
    },
    duration: call.duration,
    cost: call.cost,
    timestamp: call.timestamp,
    rating: call.rating,
    feedback: call.feedback,
    txHash: call.txHash,
    transcripts: call.transcripts.map(t => ({
      ...t,
      time: new Date(t.timestamp).toLocaleTimeString(),
    })),
    exportedAt: new Date().toISOString(),
  };

  return {
    filename: `call_${call.agentName}_${timestamp}.json`,
    content: JSON.stringify(data, null, 2),
    mimeType: 'application/json',
  };
}

function exportAsTXT(call: CallRecord, timestamp: string): { filename: string; content: string; mimeType: string } {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                    VOICE AGENT HOTLINE',
    '                      Call Transcript',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Agent: ${call.agentName}`,
    `Specialty: ${call.agentSpecialty}`,
    `Date: ${new Date(call.timestamp).toLocaleDateString()}`,
    `Time: ${new Date(call.timestamp).toLocaleTimeString()}`,
    `Duration: ${formatDuration(call.duration)}`,
    `Cost: $${(call.cost || 0).toFixed(2)}`,
  ];

  if (call.rating) {
    lines.push(`Rating: ${'⭐'.repeat(call.rating)}`);
  }

  if (call.txHash) {
    lines.push(`Transaction: ${getExplorerTxUrl(call.txHash)}`);
  }

  lines.push('', '───────────────────────────────────────────────────────────────', '');

  if (call.transcripts.length === 0) {
    lines.push('No transcript available for this call.');
  } else {
    call.transcripts.forEach((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const speaker = msg.speaker === 'user' ? 'You' : call.agentName;
      lines.push(`[${time}] ${speaker}:`);
      lines.push(msg.text);
      lines.push('');
    });
  }

  lines.push('', '───────────────────────────────────────────────────────────────');
  lines.push('Exported from Voice Agent Hotline');
  lines.push(`Export Date: ${new Date().toLocaleString()}`);
  lines.push('═══════════════════════════════════════════════════════════════');

  return {
    filename: `call_${call.agentName}_${timestamp}.txt`,
    content: lines.join('\n'),
    mimeType: 'text/plain',
  };
}

function exportAsPDF(call: CallRecord, timestamp: string): { filename: string; content: string; mimeType: string } {
  // For PDF, we'll generate HTML that can be printed to PDF
  // In a real implementation, you'd use a library like jsPDF or puppeteer
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Transcript - ${call.agentName}</title>
  <style>
    :root {
      --primary: #06b6d4;
      --primary-dark: #0891b1;
      --secondary: #64748b;
      --bg-user: #e0f2fe;
      --bg-agent: #f1f5f9;
      --border-user: #0369a1;
      --border-agent: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #1e293b;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }

    .logo {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      opacity: 0.95;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 600;
      margin-top: 16px;
      opacity: 0.95;
    }

    .meta {
      background: #f8fafc;
      padding: 30px 40px;
      border-bottom: 1px solid #e2e8f0;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .meta-value {
      font-size: 15px;
      font-weight: 500;
      color: #1e293b;
    }

    .meta-value.highlight {
      color: var(--primary);
      font-weight: 600;
    }

    .transcript {
      padding: 40px;
    }

    .transcript h2 {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--primary);
    }

    .message {
      margin-bottom: 20px;
      padding: 16px 20px;
      border-radius: 12px;
      border-left: 4px solid;
    }

    .message.user {
      background: var(--bg-user);
      border-color: var(--border-user);
      margin-right: 60px;
    }

    .message.agent {
      background: var(--bg-agent);
      border-color: var(--border-agent);
      margin-left: 60px;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .message-speaker {
      font-weight: 600;
      font-size: 14px;
    }

    .message.user .message-speaker {
      color: var(--border-user);
    }

    .message.agent .message-speaker {
      color: var(--border-agent);
    }

    .message-time {
      font-size: 12px;
      color: var(--secondary);
    }

    .message-text {
      font-size: 15px;
      line-height: 1.5;
      color: #334155;
    }

    .footer {
      background: #f8fafc;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }

    .footer-text {
      font-size: 13px;
      color: var(--secondary);
      margin-bottom: 8px;
    }

    .footer-link {
      font-size: 12px;
      color: var(--primary);
      text-decoration: none;
    }

    .footer-link:hover {
      text-decoration: underline;
    }

    .rating {
      font-size: 20px;
      letter-spacing: 2px;
    }

    .no-print {
      margin-top: 30px;
      text-align: center;
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 14px 28px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4);
    }

    .btn-print:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .container {
        box-shadow: none;
      }

      .no-print {
        display: none !important;
      }

      .message.user {
        margin-right: 40px;
      }

      .message.agent {
        margin-left: 40px;
      }
    }

    @media (max-width: 600px) {
      .meta-grid {
        grid-template-columns: 1fr;
      }

      .message.user,
      .message.agent {
        margin-left: 0;
        margin-right: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎙️</div>
      <div class="logo-text">Voice Agent Hotline</div>
      <h1>Call Transcript</h1>
    </div>

    <div class="meta">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Agent</span>
          <span class="meta-value">${call.agentName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Specialty</span>
          <span class="meta-value">${call.agentSpecialty}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Date</span>
          <span class="meta-value">${new Date(call.timestamp).toLocaleDateString()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Time</span>
          <span class="meta-value">${new Date(call.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Duration</span>
          <span class="meta-value highlight">${formatDuration(call.duration)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Cost</span>
          <span class="meta-value highlight">$${(call.cost || 0).toFixed(2)}</span>
        </div>
        ${call.rating ? `
        <div class="meta-item">
          <span class="meta-label">Rating</span>
          <span class="rating">${'⭐'.repeat(call.rating)}</span>
        </div>
        ` : ''}
        ${call.txHash ? `
        <div class="meta-item">
          <span class="meta-label">Transaction</span>
          <a class="meta-value highlight" href="${getExplorerTxUrl(call.txHash)}" target="_blank">View on Arbiscan →</a>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="transcript">
      <h2>Conversation</h2>
      ${call.transcripts.length === 0 ?
        '<p style="color: #64748b; text-align: center; padding: 40px;">No transcript available for this call.</p>' :
        call.transcripts.map(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isUser = msg.speaker === 'user';
          return `
            <div class="message ${isUser ? 'user' : 'agent'}">
              <div class="message-header">
                <span class="message-speaker">${isUser ? '👤 You' : `🤖 ${call.agentName}`}</span>
                <span class="message-time">${time}</span>
              </div>
              <div class="message-text">${msg.text}</div>
            </div>
          `;
        }).join('')
      }
    </div>

    <div class="footer">
      <p class="footer-text">
        Exported from <strong>Voice Agent Hotline</strong>
      </p>
      <p class="footer-text">
        Export Date: ${new Date().toLocaleString()}
      </p>
      <p class="footer-text">
        <a class="footer-link" href="https://voisss-agent-hotline.vercel.app">voisss-agent-hotline.vercel.app</a>
      </p>
    </div>
  </div>

  <div class="no-print">
    <button class="btn-print" onclick="window.print()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9V2h12v7"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <path d="M6 14h12v8H6z"/>
      </svg>
      Print / Save as PDF
    </button>
  </div>

  <script>
    // Auto-trigger print dialog after a short delay
    setTimeout(function() {
      // Only auto-print if the URL has ?autoprint parameter
      if (window.location.search.includes('autoprint')) {
        window.print();
      }
    }, 500);
  </script>
</body>
</html>`;

  return {
    filename: `call_${call.agentName}_${timestamp}.html`,
    content: html,
    mimeType: 'text/html',
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function exportAsCSV(call: CallRecord, timestamp: string): { filename: string; content: string; mimeType: string } {
  // CSV header
  const headers = [
    'Call ID',
    'Agent Name',
    'Agent ID',
    'Specialty',
    'Date',
    'Time',
    'Duration (seconds)',
    'Duration (formatted)',
    'Cost (USD)',
    'Rating',
    'Transaction Hash',
    'Transcript',
  ];

  // Escape CSV field
  const escapeCSV = (field: string | number | boolean) => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Combine transcript into single field
  const transcriptText = call.transcripts
    .map((t) => {
      const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const speaker = t.speaker === 'user' ? 'You' : call.agentName;
      return `[${time}] ${speaker}: ${t.text.replace(/\n/g, ' ')}`;
    })
    .join(' | ');

  const row = [
    escapeCSV(call.id),
    escapeCSV(call.agentName),
    escapeCSV(call.agentId),
    escapeCSV(call.agentSpecialty),
    escapeCSV(new Date(call.timestamp).toLocaleDateString()),
    escapeCSV(new Date(call.timestamp).toLocaleTimeString()),
    call.duration,
    formatDuration(call.duration),
    (call.cost || 0).toFixed(2),
    call.rating || '',
    call.txHash || '',
    escapeCSV(transcriptText),
  ];

  return {
    filename: `call_${call.agentName}_${timestamp}.csv`,
    content: [headers.join(','), row.join(',')].join('\n'),
    mimeType: 'text/csv',
  };
}

// Bulk export function
export function exportMultipleCalls(calls: CallRecord[], format: 'txt' | 'json' | 'pdf' | 'csv'): { filename: string; content: string; mimeType: string } {
  const timestamp = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const data = {
      exportedAt: new Date().toISOString(),
      totalCalls: calls.length,
      totalCost: calls.reduce((sum, call) => sum + call.cost, 0),
      totalDuration: calls.reduce((sum, call) => sum + call.duration, 0),
      calls: calls.map(call => ({
        callId: call.id,
        agent: {
          id: call.agentId,
          name: call.agentName,
          specialty: call.agentSpecialty,
        },
        duration: call.duration,
        cost: call.cost,
        timestamp: call.timestamp,
        rating: call.rating,
      })),
    };

    return {
      filename: `call_history_${timestamp}.json`,
      content: JSON.stringify(data, null, 2),
      mimeType: 'application/json',
    };
  }

  if (format === 'csv') {
    const headers = [
      'Call ID',
      'Agent Name',
      'Agent ID',
      'Specialty',
      'Date',
      'Time',
      'Duration (seconds)',
      'Duration (formatted)',
      'Cost (USD)',
      'Rating',
      'Transaction Hash',
    ];

    const escapeCSV = (field: string | number | boolean) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = calls.map(call => [
      escapeCSV(call.id),
      escapeCSV(call.agentName),
      escapeCSV(call.agentId),
      escapeCSV(call.agentSpecialty),
      escapeCSV(new Date(call.timestamp).toLocaleDateString()),
      escapeCSV(new Date(call.timestamp).toLocaleTimeString()),
      call.duration,
      formatDuration(call.duration),
      (call.cost || 0).toFixed(2),
      call.rating || '',
      call.txHash || '',
    ]);

    return {
      filename: `call_history_${timestamp}.csv`,
      content: [headers.join(','), ...rows.map(r => r.join(','))].join('\n'),
      mimeType: 'text/csv',
    };
  }

  // For bulk TXT export
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                    VOICE AGENT HOTLINE',
    '                      Call History',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Export Date: ${new Date().toLocaleString()}`,
    `Total Calls: ${calls.length}`,
    `Total Cost: $${calls.reduce((sum, call) => sum + (call.cost || 0), 0).toFixed(2)}`,
    `Total Duration: ${formatDuration(calls.reduce((sum, call) => sum + call.duration, 0))}`,
    '',
  ];

  calls.forEach((call, index) => {
    lines.push(`───────────────────────────────────────────────────────────────`);
    lines.push(`Call #${index + 1}`);
    lines.push(`Agent: ${call.agentName}`);
    lines.push(`Date: ${new Date(call.timestamp).toLocaleDateString()}`);
    lines.push(`Duration: ${formatDuration(call.duration)}`);
    lines.push(`Cost: $${(call.cost || 0).toFixed(2)}`);
    if (call.rating) {
      lines.push(`Rating: ${'⭐'.repeat(call.rating)}`);
    }
    if (call.txHash) {
      lines.push(`Transaction: ${getExplorerTxUrl(call.txHash)}`);
    }
    lines.push('');
  });

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('Exported from Voice Agent Hotline');
  lines.push(`Export Date: ${new Date().toLocaleString()}`);
  lines.push('═══════════════════════════════════════════════════════════════');

  return {
    filename: `call_history_${timestamp}.txt`,
    content: lines.join('\n'),
    mimeType: 'text/plain',
  };
}
