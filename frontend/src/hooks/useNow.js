import { useEffect, useState } from 'react';

/** Geçen süre etiketlerini canlı tutmak için belirli aralıklarla güncellenen zaman damgası. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
