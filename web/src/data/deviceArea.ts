import { isNativeIOS } from '../ai/appleNative';
import { Geolocation } from '@capacitor/geolocation';
import { prefs, updatePrefs } from './prefs';
import { coarseCell } from '../domain/groups';
const KEY = 'munda.deviceArea';
export interface DeviceArea { latitude: number; longitude: number; label: string }
/** Exact GPS coordinates are deliberately discarded before storage. */
export function approximateArea(latitude: number, longitude: number): DeviceArea {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid coordinates');
  const [lat, lon] = coarseCell(latitude, longitude).split(',').map(Number);
  return { latitude: lat!, longitude: lon!, label: `${lat!.toFixed(2)}, ${lon!.toFixed(2)}` };
}
export function selectedDeviceArea(): DeviceArea | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null') as DeviceArea | null;
    return a && a.label === prefs.value.place && Number.isFinite(a.latitude) && Number.isFinite(a.longitude) ? a : null;
  } catch { return null; }
}
/** Called only from the explicit location button, never during startup or rendering. */
export async function pickDeviceArea(): Promise<void> {
  if (!isNativeIOS() && !navigator.geolocation) throw new Error('unavailable');
  const p = isNativeIOS() ? await Geolocation.getCurrentPosition({ enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }) : await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy:false,maximumAge:300000,timeout:15000}));
  const a = approximateArea(p.coords.latitude, p.coords.longitude);
  localStorage.setItem(KEY, JSON.stringify(a));
  updatePrefs({place:a.label});
}
