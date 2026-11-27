import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { LocalModelState } from '../domain/routing';

export const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
interface AppleAIPlugin {
  addListener(event: 'networkStatus', listener: (status: { connected: boolean }) => void): Promise<PluginListenerHandle>;
  status(): Promise<{ state: LocalModelState; detail: string }>;
  generate(options: { prompt: string; schema: string }): Promise<{ text: string; source: 'ON_DEVICE' }>;
  appCheckToken(): Promise<{ token: string; expireTimeMillis: number }>;
}
export const appleAI = registerPlugin<AppleAIPlugin>('MundaAppleAI');
/** Apple Foundation Models accepts text only. Never drop a photo to force a local call. */
export function appleRequestRoute(route: 'ON_DEVICE' | 'CLOUD' | 'QUEUE_UNTIL_ONLINE', hasPhoto: boolean, online: boolean) {
  return route === 'ON_DEVICE' && hasPhoto ? (online ? 'CLOUD' : 'QUEUE_UNTIL_ONLINE') : route;
}
