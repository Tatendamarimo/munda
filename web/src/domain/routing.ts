/** Availability of the on-device model, mirrored from Chrome's LanguageModel.availability(). */
export type LocalModelState = 'AVAILABLE' | 'DOWNLOADING' | 'DOWNLOADABLE' | 'UNAVAILABLE' | 'UNKNOWN';

export type Route =
  /** Hybrid model PREFER_ON_DEVICE: Gemini Nano in Chrome; cloud only if it errors and we're online. */
  | 'ON_DEVICE'
  /** Input too large for Nano, or no local model on this device: go straight to cloud. */
  | 'CLOUD'
  /** No usable local model and no signal: save now, build the record on reconnect. */
  | 'QUEUE_UNTIL_ONLINE';

export interface RouteDecision {
  route: Route;
  reason: string;
}

const describe: Record<LocalModelState, string> = {
  DOWNLOADING: 'still downloading',
  DOWNLOADABLE: 'not downloaded yet',
  UNAVAILABLE: 'not supported on this device',
  UNKNOWN: 'still being checked',
  AVAILABLE: 'ready',
};

/**
 * Decides where an observation is processed, before the farmer taps, so the UI can say whether
 * it stays on the device. Inputs too large for Nano are never silently truncated.
 */
export function decideRoute(chars: number, local: LocalModelState, online: boolean, maxOnDeviceChars: number, capabilities: { hasPhoto?: boolean; supportsLocalImages?: boolean } = {}): RouteDecision {
  if (capabilities.hasPhoto && capabilities.supportsLocalImages === false) {
    return online
      ? { route: 'CLOUD', reason: 'Photo analysis runs in the cloud on this device.' }
      : { route: 'QUEUE_UNTIL_ONLINE', reason: 'Photo saved. Analysis finishes when you have a connection.' };
  }
  const fits = chars <= maxOnDeviceChars;
  const ready = local === 'AVAILABLE';
  if (ready && fits) return { route: 'ON_DEVICE', reason: 'Runs on this device. Private, and works without signal.' };
  if (online && !fits) return { route: 'CLOUD', reason: 'Runs in the cloud. This note is too long for the on-device model.' };
  if (online) return { route: 'CLOUD', reason: `Runs in the cloud. The on-device model is ${describe[local]}.` };
  if (!fits) return { route: 'QUEUE_UNTIL_ONLINE', reason: 'Saves now. This long note is finished when you’re back online.' };
  return { route: 'QUEUE_UNTIL_ONLINE', reason: 'Saves now. Munda finishes it when you’re back online.' };
}
