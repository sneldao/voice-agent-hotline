'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { X, Link2, Twitter, Facebook, Linkedin, Mail, Check, Copy, Download, Share2 } from 'lucide-react';
import { Button } from './ui/Button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  callData?: {
    agentName: string;
    duration: number;
    cost: number;
    rating?: number;
  };
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  url, 
  imageUrl,
  callData 
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const generateShareImage = useCallback(async () => {
    if (!callData) return;
    
    setIsGeneratingImage(true);
    
    // Create a canvas for the share image
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsGeneratingImage(false);
      return;
    }

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Logo area
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 48px system-ui';
    ctx.fillText('🎙️ Voice Agent Hotline', 80, 100);

    // Call info
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px system-ui';
    ctx.fillText(`Call with ${callData.agentName}`, 80, 250);

    // Stats
    ctx.font = '48px system-ui';
    ctx.fillStyle = '#94a3b8';
    const minutes = Math.floor(callData.duration / 60);
    const seconds = callData.duration % 60;
    ctx.fillText(`⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`, 80, 350);
    ctx.fillText(`💰 $${(callData.cost || 0).toFixed(2)}`, 400, 350);

    // Rating stars
    if (callData.rating) {
      ctx.fillText('⭐'.repeat(callData.rating), 80, 450);
    }

    // Tagline
    ctx.font = 'italic 36px system-ui';
    ctx.fillStyle = '#64748b';
    ctx.fillText('AI-powered voice conversations on Arbitrum', 80, 550);

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png');
    setShareImage(dataUrl);
    setIsGeneratingImage(false);
  }, [callData]);

  useEffect(() => {
    if (isOpen && callData) {
      void generateShareImage();
    }
  }, [callData, generateShareImage, isOpen]);

  if (!isOpen) return null;

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(description)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description + '\n\n' + url)}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadImage = () => {
    if (!shareImage) return;
    
    const link = document.createElement('a');
    link.href = shareImage;
    link.download = `voice-agent-call-${Date.now()}.png`;
    link.click();
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, '_blank', 'width=600,height=400');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Share Call</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        {shareImage && (
          <div className="p-4 border-b border-gray-800">
            <p className="text-sm text-gray-400 mb-3">Preview</p>
            <div className="relative rounded-lg overflow-hidden">
              <Image
                src={shareImage}
                alt="Share preview"
                width={1200}
                height={630}
                unoptimized
                className="w-full h-auto"
              />
              <button
                onClick={handleDownloadImage}
                className="absolute bottom-2 right-2 p-2 bg-gray-900/80 rounded-lg text-white hover:bg-gray-800 transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {isGeneratingImage && (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">Generating share image...</p>
          </div>
        )}

        {/* Share Options */}
        <div className="p-4">
          <p className="text-sm text-gray-400 mb-3">Share to</p>
          
          <div className="grid grid-cols-4 gap-3 mb-4">
            <ShareButton 
              icon={<Twitter className="w-5 h-5" />}
              label="Twitter"
              onClick={() => openShareWindow(shareLinks.twitter)}
              color="bg-sky-500"
            />
            <ShareButton 
              icon={<Facebook className="w-5 h-5" />}
              label="Facebook"
              onClick={() => openShareWindow(shareLinks.facebook)}
              color="bg-blue-600"
            />
            <ShareButton 
              icon={<Linkedin className="w-5 h-5" />}
              label="LinkedIn"
              onClick={() => openShareWindow(shareLinks.linkedin)}
              color="bg-blue-700"
            />
            <ShareButton 
              icon={<Mail className="w-5 h-5" />}
              label="Email"
              onClick={() => openShareWindow(shareLinks.email)}
              color="bg-gray-600"
            />
          </div>

          {/* Native Share (Mobile) */}
          {typeof window !== 'undefined' && 'share' in navigator && (
            <Button 
              onClick={handleNativeShare}
              variant="secondary"
              className="w-full mb-3"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share via Device
            </Button>
          )}

          {/* Copy Link */}
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-400 truncate">
              {url}
            </div>
            <button
              onClick={handleCopyLink}
              className={`
                px-4 py-2 rounded-lg font-medium text-sm transition-colors
                ${copied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-cyan-500 text-white hover:bg-cyan-400'
                }
              `}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareButton({ 
  icon, 
  label, 
  onClick, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className={`
        w-12 h-12 rounded-xl ${color} 
        flex items-center justify-center text-white
        transform transition-transform group-hover:scale-110
      `}>
        {icon}
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </button>
  );
}
