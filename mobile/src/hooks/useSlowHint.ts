import { useEffect, useState } from "react";

/** True once `active` has stayed true for `delayMs` — used to explain a slow server wake-up. */
export function useSlowHint(active: boolean, delayMs = 5_000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return slow;
}
