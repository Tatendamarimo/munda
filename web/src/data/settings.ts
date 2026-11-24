import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from 'firebase/remote-config';
import type { HistoryThresholds } from '../domain/historyRules';
import { firebase } from './firebase';

/**
 * Routing limits, model names and history thresholds live in Remote Config so they can be tuned
 * per region or season (or a bad model rolled back) without a release. Values come from the last
 * activated config, so they're available offline. Same keys as the Android client.
 */
const DEFAULTS = {
  cloud_model: 'gemini-3.7-flash',
  review_model: 'gemini-3.7-flash',
  // Tried once when the main model fails (overloaded, timeout); lighter and usually available.
  cloud_fallback_model: 'gemini-3.5-flash-lite',
  // Read-aloud voice (Gemini text-to-speech). Voice names: the Chirp 3 HD / Gemini TTS list.
  tts_model: 'gemini-2.5-flash-preview-tts',
  tts_voice: 'Sulafat',
  // Chrome's on-device limit is ~9k tokens including prompt and guide excerpts.
  max_on_device_chars: 6000,
  history_lookback_days: 120,
  recurring_threshold: 1,
  spreading_plot_threshold: 2,
  spreading_window_days: 21,
  ai_review_enabled: true,
  ai_followup_questions_enabled: true,
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

class Settings {
  private rc: RemoteConfig | null = null;

  private config(): RemoteConfig {
    if (!this.rc) {
      this.rc = getRemoteConfig(firebase().app);
      this.rc.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
      this.rc.defaultConfig = { ...DEFAULTS };
    }
    return this.rc;
  }

  refresh(): void {
    fetchAndActivate(this.config()).catch((e) => console.warn('Remote Config fetch failed; using cached/defaults', e));
  }

  private str = (k: keyof typeof DEFAULTS) => getValue(this.config(), k).asString() || String(DEFAULTS[k]);
  private num = (k: keyof typeof DEFAULTS) => getValue(this.config(), k).asNumber();
  private bool = (k: keyof typeof DEFAULTS) => getValue(this.config(), k).asBoolean();

  get cloudModel() { return this.str('cloud_model'); }
  get reviewModel() { return this.str('review_model'); }
  get cloudFallbackModel() { return this.str('cloud_fallback_model'); }
  get ttsModel() { return this.str('tts_model'); }
  get ttsVoice() { return this.str('tts_voice'); }
  get maxOnDeviceChars() { return clamp(this.num('max_on_device_chars'), 500, 20_000); }
  get historyLookbackDays() { return clamp(this.num('history_lookback_days'), 7, 730); }
  get aiReviewEnabled() { return this.bool('ai_review_enabled'); }
  get aiFollowUpsEnabled() { return this.bool('ai_followup_questions_enabled'); }
  get thresholds(): HistoryThresholds {
    return {
      recurringThreshold: clamp(this.num('recurring_threshold'), 1, 10),
      spreadingPlotThreshold: clamp(this.num('spreading_plot_threshold'), 1, 20),
      spreadingWindowDays: clamp(this.num('spreading_window_days'), 3, 120),
    };
  }
}

export const settings = new Settings();
