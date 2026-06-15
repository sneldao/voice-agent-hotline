'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';

interface ActivityData {
  active: number;
  lastHour: number;
  activeAgentIds: string[];
}

export function LiveActivity() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/activity/live', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as ActivityData;
        if (!cancelled) {
          setData(json);
          // Hide the ticker entirely if there is no activity at all
          setVisible(json.active > 0 || json.lastHour > 0);
        }
      } catch {
        // Fail silent — ticker just stays hidden
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000); // refresh every 30s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && data && (
        <motion.div
          key="live-activity"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4 }}
          className="live-activity"
        >
          <span className="live-activity__dot" aria-hidden="true" />
          {data.active > 0 ? (
            <span className="live-activity__text">
              <span className="font-bold text-emerald-300/95">{data.active}</span> on the line
              {data.lastHour > 0 && (
                <>
                  <span className="text-amber-100/35"> · </span>
                  <span className="font-bold text-amber-100/80">{data.lastHour}</span> in the last hour
                </>
              )}
            </span>
          ) : (
            <span className="live-activity__text">
              <Radio className="inline h-3 w-3 mr-1 text-amber-100/45" />
              <span className="font-bold text-amber-100/70">{data.lastHour}</span> calls in the last hour
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
