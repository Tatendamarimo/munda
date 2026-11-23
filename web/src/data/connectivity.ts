import { Store } from './store';

/**
 * Browser online/offline events. `navigator.onLine` only means "has a network"; real failures
 * still surface as request errors, which the AI layer handles by queueing.
 */
class Connectivity extends Store<boolean> {
  constructor() {
    super(typeof navigator === 'undefined' ? true : navigator.onLine);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.set(true));
      window.addEventListener('offline', () => this.set(false));
    }
  }
}

export const connectivity = new Connectivity();
