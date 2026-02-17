import { CallRecord } from './useCallHistory';

export interface ExportOptions {
  format: 'txt' | 'json' | 'pdf';
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
    `Cost: $${call.cost.toFixed(2)}`,
  ];

  if (call.rating) {
    lines.push(`Rating: ${'⭐'.repeat(call.rating)}`);
  }

  if (call.txHash) {
    lines.push(`Transaction: https://celoscan.io/tx/${call.txHash}`);
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
  <title>Call Transcript - ${call.agentName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      line-height: 1.6;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #06b6d4;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #06b6d4;
      margin-bottom: 10px;
    }
    .meta {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .meta-label {
      font-weight: 600;
      color: #64748b;
    }
    .transcript {
      margin-top: 30px;
    }
    .message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 8px;
    }
    .message.user {
      background: #e0f2fe;
      margin-left: 40px;
    }
    .message.agent {
      background: #f1f5f9;
      margin-right: 40px;
    }
    .message-header {
      font-weight: 600;
      margin-bottom: 5px;
      font-size: 14px;
    }
    .message.user .message-header {
      color: #0369a1;
    }
    .message.agent .message-header {
      color: #475569;
    }
    .message-time {
      font-size: 12px;
      color: #94a3b8;
      margin-left: 10px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🎙️ Voice Agent Hotline</div>
    <h1>Call Transcript</h1>
  </div>

  <div class="meta">
    <div class="meta-row">
      <span class="meta-label">Agent:</span>
      <span>${call.agentName}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Specialty:</span>
      <span>${call.agentSpecialty}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Date:</span>
      <span>${new Date(call.timestamp).toLocaleDateString()}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Time:</span>
      <span>${new Date(call.timestamp).toLocaleTimeString()}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Duration:</span>
      <span>${formatDuration(call.duration)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Cost:</span>
      <span>$${call.cost.toFixed(2)}</span>
    </div>
    ${call.rating ? `
    <div class="meta-row">
      <span class="meta-label">Rating:</span>
      <span>${'⭐'.repeat(call.rating)}</span>
    </div>
    ` : ''}
    ${call.txHash ? `
    <div class="meta-row">
      <span class="meta-label">Transaction:</span>
      <span><a href="https://celoscan.io/tx/${call.txHash}">View on CeloScan</a></span>
    </div>
    ` : ''}
  </div>

  <div class="transcript">
    <h2>Conversation</h2>
    ${call.transcripts.length === 0 ? 
      '<p>No transcript available for this call.</p>' :
      call.transcripts.map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isUser = msg.speaker === 'user';
        return `
          <div class="message ${isUser ? 'user' : 'agent'}">
            <div class="message-header">
              ${isUser ? 'You' : call.agentName}
              <span class="message-time">${time}</span>
            </div>
            <div>${msg.text}</div>
          </div>
        `;
      }).join('')
    }
  </div>

  <div class="footer">
    <p>Exported from Voice Agent Hotline</p>
    <p>Export Date: ${new Date().toLocaleString()}</p>
  </div>

  <div class="no-print" style="margin-top: 40px; text-align: center;">
    <button onclick="window.print()" style="
      padding: 12px 24px;
      background: #06b6d4;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    ">Print / Save as PDF</button>
  </div>
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

// Bulk export function
export function exportMultipleCalls(calls: CallRecord[], format: 'txt' | 'json' | 'pdf'): { filename: string; content: string; mimeType: string } {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'json') {
    const data = {
      exportedAt: new Date().toISOString(),
      totalCalls: calls.length,
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
  
  // For bulk TXT export
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                    VOICE AGENT HOTLINE',
    '                      Call History',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Export Date: ${new Date().toLocaleString()}`,
    `Total Calls: ${calls.length}`,
    '',
  ];
  
  calls.forEach((call, index) => {
    lines.push(`───────────────────────────────────────────────────────────────`);
    lines.push(`Call #${index + 1}`);
    lines.push(`Agent: ${call.agentName}`);
    lines.push(`Date: ${new Date(call.timestamp).toLocaleDateString()}`);
    lines.push(`Duration: ${formatDuration(call.duration)}`);
    lines.push(`Cost: $${call.cost.toFixed(2)}`);
    if (call.rating) {
      lines.push(`Rating: ${'⭐'.repeat(call.rating)}`);
    }
    lines.push('');
  });
  
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return {
    filename: `call_history_${timestamp}.txt`,
    content: lines.join('\n'),
    mimeType: 'text/plain',
  };
}
