'use client';

import { useState, useCallback, useEffect } from 'react';
import { generateCallId } from './ids';

export interface CallRecord {
  id: string;
  agentId: string;
  agentName: string;
  agentSpecialty: string;
  duration: number;
  cost: number;
  timestamp: number;
  rating?: number;
  feedback?: string;
  transcripts: Array<{
    text: string;
    speaker: 'user' | 'agent';
    timestamp: number;
  }>;
  txHash?: string;
  isSaved: boolean;
}

interface CallHistoryState {
  calls: CallRecord[];
  totalCalls: number;
  totalDuration: number;
  totalSpent: number;
  averageRating: number;
}

const STORAGE_KEY = 'call_history';

/**
 * Single-pass computation of aggregate stats from a call list.
 * Replaces scattered reduce/filter chains that iterated the array multiple times.
 */
function computeStats(calls: CallRecord[]): Pick<CallHistoryState, 'totalCalls' | 'totalDuration' | 'totalSpent' | 'averageRating'> {
  let totalDuration = 0;
  let totalSpent = 0;
  let ratingSum = 0;
  let ratedCount = 0;

  for (const c of calls) {
    totalDuration += c.duration;
    totalSpent += c.cost;
    if (c.rating !== undefined) {
      ratingSum += c.rating;
      ratedCount++;
    }
  }

  return {
    totalCalls: calls.length,
    totalDuration,
    totalSpent,
    averageRating: ratedCount > 0 ? ratingSum / ratedCount : 0,
  };
}

export function useLocalCallHistory() {
  const [state, setState] = useState<CallHistoryState>({
    calls: [],
    totalCalls: 0,
    totalDuration: 0,
    totalSpent: 0,
    averageRating: 0,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const calls: CallRecord[] = JSON.parse(stored);
        setState({ calls, ...computeStats(calls) });
      } catch {
        // Invalid storage, ignore
      }
    }
  }, []);

  const saveCall = useCallback((call: Omit<CallRecord, 'id' | 'timestamp' | 'isSaved'>) => {
    const newCall: CallRecord = {
      ...call,
      id: generateCallId(),
      timestamp: Date.now(),
      isSaved: false,
    };

    setState(prev => {
      const calls = [newCall, ...prev.calls];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
      return { calls, ...computeStats(calls) };
    });

    return newCall.id;
  }, []);

  const rateCall = useCallback((callId: string, rating: number, feedback?: string) => {
    setState(prev => {
      const calls = prev.calls.map(c =>
        c.id === callId ? { ...c, rating, feedback } : c
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
      return { calls, ...computeStats(calls) };
    });
  }, []);

  const toggleSaveCall = useCallback((callId: string) => {
    setState(prev => {
      const calls = prev.calls.map(c =>
        c.id === callId ? { ...c, isSaved: !c.isSaved } : c
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
      return { ...prev, calls };
    });
  }, []);

  const updateCallReceipt = useCallback((callId: string, receipt: { txHash?: string; cost?: number }) => {
    setState(prev => {
      const calls = prev.calls.map(c =>
        c.id === callId
          ? { ...c, txHash: receipt.txHash ?? c.txHash, cost: receipt.cost ?? c.cost }
          : c
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
      return { calls, ...computeStats(calls) };
    });
  }, []);

  const deleteCall = useCallback((callId: string) => {
    setState(prev => {
      const calls = prev.calls.filter(c => c.id !== callId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
      return { calls, ...computeStats(calls) };
    });
  }, []);

  const getSavedCalls = useCallback(() => {
    return state.calls.filter(c => c.isSaved);
  }, [state.calls]);

  const getCallById = useCallback((callId: string) => {
    return state.calls.find(c => c.id === callId);
  }, [state.calls]);

  const exportTranscript = useCallback((callId: string) => {
    const call = state.calls.find(c => c.id === callId);
    if (!call) return null;

    const transcript = call.transcripts
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker}: ${t.text}`)
      .join('\n');

    return {
      filename: `call_${call.agentName}_${new Date(call.timestamp).toISOString().split('T')[0]}.txt`,
      content: transcript,
    };
  }, [state.calls]);

  return {
    ...state,
    saveCall,
    rateCall,
    toggleSaveCall,
    updateCallReceipt,
    deleteCall,
    getSavedCalls,
    getCallById,
    exportTranscript,
  };
}
