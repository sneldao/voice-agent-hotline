'use client';

import { X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { CallRecord } from '@/lib/useCallHistory';

interface TranscriptModalProps {
  call: CallRecord;
  isOpen: boolean;
  onClose: () => void;
  formatDate: (ts: number) => string;
  formatDuration: (s: number) => string;
}

export function TranscriptModal({ call, isOpen, onClose, formatDate, formatDuration }: TranscriptModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Transcript</h3>
          <p className="text-xs text-gray-400">
            {call.agentName} • {formatDate(call.timestamp)} • {formatDuration(call.duration)}
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {call.transcripts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No transcript available</p>
        ) : (
          call.transcripts.map((msg, i) => (
            <div key={i} className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                msg.speaker === 'user' ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-100'
              }`}>
                <div className="text-xs opacity-70 mb-1">
                  {msg.speaker === 'user' ? 'You' : call.agentName} • {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-sm">{msg.text}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-800">
        <Button variant="secondary" onClick={onClose} className="flex-1">Close</Button>
      </div>
    </Modal>
  );
}
