'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';
import { useLiveActivity } from '@/lib/useLiveActivity';

export function LiveActivity() {
  const data = useLiveActivity();
  const visible = !!(data && (data.active > 0 || data.lastHour > 0));

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
