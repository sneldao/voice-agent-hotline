'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/lib/useNetworkStatus';

/**
 * CLEAN: Offline detection banner
 * Shows when user is offline or has slow connection
 */
export function OfflineBanner() {
    const { isOnline, isSlowConnection, connectionType } = useNetworkStatus();

    if (isOnline && !isSlowConnection) {
        return null;
    }

    return (
        <div className={`
            fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-medium
            ${!isOnline 
                ? 'bg-red-500/90 text-white' 
                : 'bg-amber-500/90 text-white'
            }
            backdrop-blur-sm
        `}>
            <div className="flex items-center justify-center gap-2">
                {!isOnline ? (
                    <>
                        <WifiOff className="w-4 h-4" />
                        <span>You are offline. Some features may not work.</span>
                    </>
                ) : (
                    <>
                        <Wifi className="w-4 h-4" />
                        <span>
                            Slow connection detected
                            {connectionType && ` (${connectionType})`}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

export default OfflineBanner;