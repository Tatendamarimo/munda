import { useSyncExternalStore } from 'react';

/** Minimal observable value; React reads it with useStore(). Keeps services framework-agnostic. */
export class Store<T> {
  private listeners = new Set<() => void>();
  constructor(private current: T) {}

  get value(): T {
    return this.current;
  }

  set(next: T) {
    if (Object.is(next, this.current)) return;
    this.current = next;
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, () => store.value);
}
