type Listener = () => void;
const listeners: Record<string, Set<Listener>> = {};

export function emit(event: string) {
  listeners[event]?.forEach(fn => fn());
}

export function subscribe(event: string, fn: Listener): () => void {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(fn);
  return () => listeners[event]?.delete(fn);
}
