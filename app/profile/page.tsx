'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { 
  User, 
  Phone, 
  Star, 
  Clock, 
  CreditCard, 
  Settings, 
  History,
  ChevronLeft,
  MoreVertical,
  Shield,
  Zap
} from '@/components/ui/Toast';
import { showSuccess } from '@/lib/useToast';

// Demo data - in production, this would come from context/auth
const DEMO_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE45';
const DEMO_BALANCE = 2.50;

export default function UserProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('User');
  const [bio, setBio] = useState('Voice agent enthusiast');

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const stats = {
    totalCalls: 24,
    totalMinutes: 186,
    totalSpent: 12.50,
    rating: 4.8,
  };

  const recentActivity = [
    { type: 'call', agent: 'Maria Garcia', duration: '12:34', cost: '$0.25', date: '2h ago' },
    { type: 'call', agent: 'Spanish Tutor', duration: '8:15', cost: '$0.17', date: '1d ago' },
    { type: 'payment', amount: '+ $5.00', date: '2d ago' },
    { type: 'call', agent: 'Coding Helper', duration: '25:00', cost: '$0.42', date: '3d ago' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Profile</h1>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="ml-auto w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card variant="gradient" className="p-6">
          <div className="flex items-center gap-4">
            <Avatar size="xl" className="bg-gradient-to-br from-cyan-500 to-blue-500">
              {name.charAt(0) || 'U'}
            </Avatar>
            <div className="flex-1">
              {isEditing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm"
                />
              ) : (
                <h2 className="text-xl font-bold text-white">{name}</h2>
              )}
              <p className="text-sm text-gray-400 font-mono">{formatAddress(DEMO_ADDRESS)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" size="sm">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
                <Badge variant="info" size="sm">
                  <Zap className="w-3 h-3 mr-1" />
                  Pro Member
                </Badge>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="mt-4 space-y-3">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full h-20 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white resize-none"
                placeholder="Tell us about yourself..."
              />
              <Button onClick={() => { setIsEditing(false); showSuccess('Profile updated!'); }} size="sm">
                Save Changes
              </Button>
            </div>
          )}
        </Card>

        {/* Balance Card */}
        <Card className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Available Balance</p>
              <p className="text-3xl font-bold text-white">${DEMO_BALANCE.toFixed(2)}</p>
            </div>
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-500">
              <CreditCard className="w-4 h-4 mr-2" />
              Add Funds
            </Button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-xs">Total Calls</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalCalls}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Minutes</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalMinutes}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs">Total Spent</span>
            </div>
            <p className="text-2xl font-bold text-white">${stats.totalSpent}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Star className="w-4 h-4" />
              <span className="text-xs">Avg Rating</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.rating}</p>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl">
                <div className="flex items-center gap-3">
                  {item.type === 'call' ? (
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-cyan-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-green-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.type === 'call' ? `Called ${item.agent}` : item.amount}
                    </p>
                    <p className="text-xs text-gray-400">{item.date}</p>
                  </div>
                </div>
                {item.type === 'call' && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{item.duration}</p>
                    <p className="text-xs text-gray-400">{item.cost}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Settings */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white">Settings</h3>
          </div>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors">
              <span className="text-sm text-white">Notification Preferences</span>
              <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors">
              <span className="text-sm text-white">Privacy & Security</span>
              <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors">
              <span className="text-sm text-white">Connected Wallets</span>
              <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
          </div>
        </Card>

        {/* Logout */}
        <Button variant="secondary" className="w-full">
          <User className="w-4 h-4 mr-2" />
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}
