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
/** Resolve a town name using only the coarse cell, after the explicit location action. */
export async function nameDeviceArea(area: DeviceArea): Promise<DeviceArea> {
  if (navigator.onLine === false) return area;
  try {
    const query = new URLSearchParams({ latitude: String(area.latitude), longitude: String(area.longitude), localityLanguage: 'en' });
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return area;
    const data = await response.json();
    const clean = (v: unknown): string => typeof v === 'string' ? v.trim().slice(0, 120) : '';
    const town = clean(data.city) || clean(data.locality) || clean(data.principalSubdivision);
    const country = clean(data.countryName);
    return town ? { ...area, label: [...new Set([town, country].filter(Boolean))].join(', ') } : area;
  } catch { return area; }
}
/** Called only from the explicit location button, never during startup or rendering. */
export async function pickDeviceArea(): Promise<void> {
  if (!isNativeIOS() && !navigator.geolocation) throw new Error('unavailable');
  const originalPlace = prefs.value.place;
  const p = isNativeIOS() ? await Geolocation.getCurrentPosition({ enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }) : await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy:false,maximumAge:300000,timeout:15000}));
  const a = await nameDeviceArea(approximateArea(p.coords.latitude, p.coords.longitude));
  // Preserve edits made while either location or the name lookup was pending.
  if (prefs.value.place !== originalPlace) return;
  localStorage.setItem(KEY, JSON.stringify(a));
  updatePrefs({place:a.label});
}
