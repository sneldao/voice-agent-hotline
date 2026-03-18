'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { getExplorerTxUrl } from '@/lib/superfluid-streaming';

interface PaymentReceiptProps {
  callId: string;
}

interface Receipt {
  callId: string;
  payer: string;
  payee: string;
  amount: string;
  token: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  settled: boolean;
}

export function PaymentReceipt({ callId }: PaymentReceiptProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await fetch(`/api/payments/settle?callId=${callId}`);
        const data = await res.json();
        
        if (data.settled && data.receipt) {
          setReceipt(data.receipt);
        }
      } catch (err) {
        setError('Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [callId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking payment status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-amber-400">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="text-slate-500 text-sm">
        Payment pending settlement...
      </div>
    );
  }

  const explorerUrl = getExplorerTxUrl(receipt.txHash);
  const date = new Date(receipt.timestamp).toLocaleString();

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle className="w-5 h-5" />
        <span className="font-medium">Payment Settled on Celo</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Amount:</span>
          <span className="text-slate-200 font-medium">
            {parseFloat(receipt.amount).toFixed(6)} {receipt.token}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Block:</span>
          <span className="text-slate-200">#{receipt.blockNumber}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Time:</span>
          <span className="text-slate-200">{date}</span>
        </div>

        <div className="pt-2 border-t border-emerald-500/20">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span className="text-sm">View on CeloScan</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
