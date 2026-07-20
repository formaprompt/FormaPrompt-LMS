import { useEffect, useState } from 'react';

export function useDebouncedValue<TValue>(value: TValue, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return [debouncedValue, setDebouncedValue] as const;
}
