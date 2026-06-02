'use client';

import { useState } from 'react';
import { Button } from './Button';
import { Card, CardHeader, CardContent } from './Card';
import { Input } from './Input';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { 
  User, 
  Mic, 
  CreditCard, 
  Check, 
  ChevronRight, 
  Sparkles,
  History,
  Clock,
  Zap
} from './Toast';
import { showSuccess, showError } from '@/lib/useToast';
import { apiUrl } from '@/lib/api';
import type { AgentSubmission } from '@/lib/types';

interface AgentCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agent: {
    name: string;
    specialty: string;
    bio: string;
    rate: number;
    voiceId: string;
    type: 'ai' | 'human';
  }) => void;
}

const VOICE_OPTIONS = [
  { id: 'adam', name: 'Adam', gender: 'male', preview: '低沉穩重的聲音' },
  { id: 'rachel', name: 'Rachel', gender: 'female', preview: '溫和清晰的聲音' },
  { id: 'domi', name: 'Domi', gender: 'female', preview: '活力充沛的聲音' },
  { id: 'antoni', name: 'Antoni', gender: 'male', preview: '專業權威的聲音' },
];

const SPECIALTY_CATEGORIES = [
  { id: 'language', icon: '🗣️', name: 'Language Learning', examples: ['Spanish', 'French', 'Mandarin'] },
  { id: 'coding', icon: '💻', name: 'Programming', examples: ['JavaScript', 'Python', 'React'] },
  { id: 'cooking', icon: '🍳', name: 'Cooking', examples: ['Italian', 'French', 'Asian'] },
  { id: 'music', icon: '🎵', name: 'Music', examples: ['Guitar', 'Piano', 'Theory'] },
  { id: 'fitness', icon: '💪', name: 'Fitness', examples: ['Yoga', ' HIIT', 'Nutrition'] },
  { id: 'business', icon: '💼', name: 'Business', examples: ['Marketing', 'Sales', 'Startup'] },
  { id: 'therapy', icon: '🧠', name: 'Mental Health', examples: ['Meditation', 'Coaching'] },
  { id: 'other', icon: '✨', name: 'Other', examples: ['Anything else'] },
];

const AGENT_TYPES = [
  {
    id: 'ai',
    name: 'AI Agent',
    icon: '🤖',
    description: 'Powered by ElevenLabs voice synthesis. Available 24/7.',
    advantages: ['Instant availability', 'Unlimited calls', 'Lower rate'],
  },
  {
    id: 'human',
    name: 'Human Expert',
    icon: '👤',
    description: 'Real person with expertise. Premium experience.',
    advantages: ['Personal touch', 'Deep expertise', 'Complex topics'],
  },
];

export function AgentCreationModal({ isOpen, onClose, onSubmit }: AgentCreationModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    bio: '',
    rate: 1,
    voiceId: 'adam',
    type: 'ai' as 'ai' | 'human',
    category: '',
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!formData.name || !formData.specialty || !formData.bio) {
      showError('Please fill in all fields');
      return;
    }
    onSubmit(formData as any);
    showSuccess('Agent created successfully!');
    onClose();
    setStep(1);
    setFormData({
      name: '',
      specialty: '',
      bio: '',
      rate: 1,
      voiceId: 'adam',
      type: 'ai',
      category: '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full mx-4 max-w-lg bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Create Agent</h2>
              <p className="text-sm text-gray-400 mt-1">
                {step === 1 && 'Choose your agent type'}
                {step === 2 && 'Basic information'}
                {step === 3 && 'Voice & pricing'}
                {step === 4 && 'Review & launch'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-cyan-500' : 'bg-gray-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {step === 1 && (
            <div className="space-y-4">
              {AGENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, type: type.id as 'ai' | 'human' }));
                    setStep(2);
                  }}
                  className={`
                    w-full flex items-start gap-4 p-4 rounded-xl transition-all text-left
                    ${formData.type === type.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 border'
                      : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/60'
                    }
                  `}
                >
                  <span className="text-3xl">{type.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-white">{type.name}</div>
                    <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {type.advantages.map((adv) => (
                        <Badge key={adv} variant="info" size="sm">{adv}</Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 mt-1" />
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Agent Name</label>
                <Input
                  placeholder="e.g., Maria Garcia"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  icon="👤"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALTY_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                      className={`
                        p-3 rounded-xl text-left transition-all
                        ${formData.category === cat.id
                          ? 'bg-cyan-500/10 border-cyan-500/50 border'
                          : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/60'
                        }
                      `}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <div className="text-sm font-medium text-white mt-1">{cat.name}</div>
                      <div className="text-xs text-gray-500">{cat.examples[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Specialty</label>
                <Input
                  placeholder="e.g., Spanish Conversation Tutor"
                  value={formData.specialty}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                  icon="📚"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Bio</label>
                <textarea
                  placeholder="Tell users about your experience and what you can help with..."
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full h-24 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>
          )}

          {step === 3 && formData.type === 'ai' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Voice</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICE_OPTIONS.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setFormData(prev => ({ ...prev, voiceId: voice.id }))}
                      className={`
                        p-3 rounded-xl text-left transition-all
                        ${formData.voiceId === voice.id
                          ? 'bg-cyan-500/10 border-cyan-500/50 border'
                          : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/60'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-white">{voice.name}</span>
                        <span className="text-xs text-gray-500">({voice.gender})</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{voice.preview}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Rate per minute</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={formData.rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, rate: Number(e.target.value) }))}
                    className="flex-1 accent-cyan-500"
                  />
                  <div className="flex items-center gap-1 bg-gray-800/50 px-3 py-2 rounded-lg">
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-cyan-400">${((formData.rate || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {formData.rate === 0 ? 'Free calls' : `${formData.rate} cents/minute`}
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Card variant="gradient" className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar size="xl" className="bg-gradient-to-br from-cyan-500 to-blue-500">
                    {formData.name.charAt(0) || 'A'}
                  </Avatar>
                  <div>
                    <div className="font-bold text-white">{formData.name || 'Your Agent'}</div>
                    <div className="text-sm text-gray-400">{formData.specialty || 'Your specialty'}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={formData.type === 'ai' ? 'info' : 'success'}>
                        {formData.type === 'ai' ? '🤖 AI' : '👤 Human'}
                      </Badge>
                      <Badge variant="default">
                        ${((formData.rate || 0) / 100).toFixed(2)}/min
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="p-4 bg-gray-800/30 rounded-xl">
                <p className="text-sm text-gray-300">{formData.bio || 'No bio provided'}</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <Zap className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-300">
                  Ready to launch! Users can start calling immediately.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 flex gap-3">
          {step > 1 && (
            <Button
              variant="secondary"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 2 && (!formData.name || !formData.specialty)) ||
                (step === 3 && formData.type === 'ai' && false)
              }
              className="flex-1"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Launch Agent
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Self-Registration Form ───────────────────────────────────────────────────
// Used on /list-your-agent — external developers submit their ElevenLabs agent
// for review. Stores as status: "pending" until approved by an admin.

const CATEGORIES = [
  { id: 'code', label: '💻 Code' },
  { id: 'finance', label: '💰 Finance' },
  { id: 'blockchain', label: '⛓️ Blockchain' },
  { id: 'health', label: '🏥 Health' },
  { id: 'education', label: '📚 Education' },
  { id: 'legal', label: '⚖️ Legal' },
  { id: 'creative', label: '🎨 Creative' },
  { id: 'other', label: '✨ Other' },
];

const EMPTY_SUBMISSION: AgentSubmission = {
  name: '',
  description: '',
  specialty: '',
  category: '',
  elevenlabs_agent_id: '',
  voice_id: '',
  system_prompt: '',
  rate: 0.10,
  wallet_address: '',
  contact_email: '',
};

export function AgentRegistrationForm() {
  const [form, setForm] = useState<AgentSubmission>(EMPTY_SUBMISSION);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof AgentSubmission, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.elevenlabs_agent_id || !form.system_prompt || !form.wallet_address) {
      showError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/agents'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, register: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }
      setSubmitted(true);
      showSuccess('Agent submitted for review!');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">Submission received!</h2>
        <p className="text-gray-400">
          Your agent is under review. We will reach out to <span className="text-cyan-400">{form.contact_email}</span> once approved.
        </p>
        <Button onClick={() => { setForm(EMPTY_SUBMISSION); setSubmitted(false); }} variant="secondary">
          Submit another agent
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
      {/* Agent identity */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Agent identity</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Agent name <span className="text-red-400">*</span></label>
          <Input placeholder="e.g. Tax Advisor" value={form.name} onChange={e => set('name', e.target.value)} icon="🤖" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Short description <span className="text-red-400">*</span></label>
          <Input placeholder="One-line description for the marketplace" value={form.description} onChange={e => set('description', e.target.value)} icon="📝" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Specialty</label>
          <Input placeholder="e.g. US tax law, crypto accounting" value={form.specialty} onChange={e => set('specialty', e.target.value)} icon="🎯" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Category</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => set('category', cat.id)}
                className={`p-2 rounded-xl text-xs text-center transition-all ${
                  form.category === cat.id
                    ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                    : 'bg-gray-800/40 border border-transparent text-gray-400 hover:bg-gray-800/70'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ElevenLabs integration */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">ElevenLabs integration</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">ElevenLabs Agent ID <span className="text-red-400">*</span></label>
          <Input placeholder="agent_xxxxxxxxxxxxxxxx" value={form.elevenlabs_agent_id} onChange={e => set('elevenlabs_agent_id', e.target.value)} icon="🔑" />
          <p className="text-xs text-gray-500">Found in your ElevenLabs dashboard under Conversational AI → Agents.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Voice ID</label>
          <Input placeholder="ElevenLabs voice ID (optional)" value={form.voice_id} onChange={e => set('voice_id', e.target.value)} icon="🎙️" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">System prompt <span className="text-red-400">*</span></label>
          <textarea
            placeholder="Describe what your agent does and how it behaves..."
            value={form.system_prompt}
            onChange={e => set('system_prompt', e.target.value)}
            rows={4}
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Earnings & contact */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Earnings & contact</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Rate per minute (USDC) <span className="text-red-400">*</span></label>
          <div className="flex items-center gap-4">
            <input
              type="range" min="5" max="100" step="1"
              value={Math.round(form.rate * 100)}
              onChange={e => set('rate', Number(e.target.value) / 100)}
              className="flex-1 accent-cyan-500"
            />
            <div className="flex items-center gap-1 bg-gray-800/50 px-3 py-2 rounded-lg min-w-[80px] justify-center">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-cyan-400">${form.rate.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">Platform takes 20%. You earn ${(form.rate * 0.8).toFixed(2)}/min.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Arbitrum wallet address <span className="text-red-400">*</span></label>
          <Input placeholder="0x..." value={form.wallet_address} onChange={e => set('wallet_address', e.target.value)} icon="💳" />
          <p className="text-xs text-gray-500">Earnings paid in USDC to this address.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Contact email</label>
          <Input placeholder="you@example.com" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} icon="✉️" />
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <Clock className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-yellow-300">
          Submissions are reviewed within 48 hours. Your agent will appear as pending until approved.
        </p>
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
      >
        {submitting ? (
          <span className="flex items-center gap-2"><Zap className="w-4 h-4 animate-spin" /> Submitting...</span>
        ) : (
          <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Submit for review</span>
        )}
      </Button>
    </form>
  );
}
