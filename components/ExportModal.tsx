'use client';

import { useState } from 'react';
import { X, FileText, FileJson, FileCode, Download, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { CallRecord } from '@/lib/useCallHistory';
import { exportCall, exportMultipleCalls } from '@/lib/export-utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  call?: CallRecord;
  calls?: CallRecord[];
}

type ExportFormat = 'txt' | 'json' | 'pdf';

export function ExportModal({ isOpen, onClose, call, calls }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('txt');
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  if (!isOpen) return null;

  const isBulkExport = !!calls && calls.length > 0;
  const itemCount = isBulkExport ? calls!.length : 1;

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      if (isBulkExport && calls) {
        // Bulk export
        const result = exportMultipleCalls(calls, selectedFormat);
        downloadFile(result.filename, result.content, result.mimeType);
      } else if (call) {
        // Single call export
        const result = exportCall(call, { format: selectedFormat });
        downloadFile(result.filename, result.content, result.mimeType);
      }
      
      setExported(true);
      setTimeout(() => {
        setExported(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formats: { id: ExportFormat; name: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'txt',
      name: 'Plain Text',
      icon: <FileText className="w-6 h-6" />,
      description: 'Simple text format, easy to read',
    },
    {
      id: 'json',
      name: 'JSON',
      icon: <FileJson className="w-6 h-6" />,
      description: 'Structured data format',
    },
    {
      id: 'pdf',
      name: 'PDF / HTML',
      icon: <FileCode className="w-6 h-6" />,
      description: 'Printable HTML (open in browser to save as PDF)',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              Export {isBulkExport ? `${itemCount} Calls` : 'Call'}
            </h2>
            <p className="text-sm text-gray-400">
              Choose your preferred format
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Options */}
        <div className="p-4 space-y-3">
          {formats.map((format) => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id)}
              className={`
                w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all
                ${selectedFormat === format.id 
                  ? 'bg-cyan-500/20 border-2 border-cyan-500' 
                  : 'bg-gray-800 border-2 border-transparent hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${selectedFormat === format.id ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}
              `}>
                {format.icon}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${selectedFormat === format.id ? 'text-white' : 'text-gray-200'}`}>
                  {format.name}
                </div>
                <div className="text-sm text-gray-400">
                  {format.description}
                </div>
              </div>
              {selectedFormat === format.id && (
                <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preview Info */}
        <div className="px-4 pb-4">
          <div className="bg-gray-800 rounded-lg p-3 text-sm">
            <div className="text-gray-400 mb-1">File name preview:</div>
            <code className="text-cyan-400">
              {isBulkExport 
                ? `call_history_2024-01-15.${selectedFormat === 'pdf' ? 'html' : selectedFormat}`
                : `call_AgentName_2024-01-15.${selectedFormat === 'pdf' ? 'html' : selectedFormat}`
              }
            </code>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-800">
          <Button
            onClick={handleExport}
            isLoading={isExporting}
            className="w-full"
            size="lg"
          >
            {exported ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Exported!
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download {selectedFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
