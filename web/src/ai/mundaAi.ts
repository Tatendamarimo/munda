import { getGenerativeModel, InferenceMode, InferenceSource, type GenerativeModel, type LanguageModelCreateOptions, type Part } from 'firebase/ai';
import { guideFor } from '../domain/guide';
import type { FieldRecord, FollowUpQuestion, InferenceOrigin } from '../domain/models';
import { parseQuestions, parseRecord, type Result } from '../domain/parser';
import type { LocalModelState, Route } from '../domain/routing';
import { connectivity } from '../data/connectivity';
import { firebase } from '../data/firebase';
import { settings } from '../data/settings';
import { Store } from '../data/store';
import { questionsPrompt, recordPrompt, retrievalText, type ObservationInput } from './prompts';
import { language } from '../i18n';

/** Only cloud calls get the farmer's language; on-device stays English (see prompts.languageLines). */
const cloudLang = (route: Route) => (route === 'CLOUD' ? language.value : undefined);
import { questionsSchema, recordSchema } from './schemas';

export type AiOutcome<T> =
  | { kind: 'done'; value: T; origin: InferenceOrigin; latencyMs: number }
  /** Can't run anywhere right now (offline and no usable local model). Caller saves and queues. */
  | { kind: 'deferred'; reason: string }
  | { kind: 'failed'; reason: string };

export interface LocalModelInfo {
  state: LocalModelState;
  /** 0..1 while downloading, when known. */
  progress: number | null;
}

/** Chrome's Prompt API global; declared minimally so we can show model status in the UI. */
declare global {
  // eslint-disable-next-line no-var
  var LanguageModel: { availability(options?: unknown): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'> } | undefined;
}

// On-device sessions accept text plus one image (JPEG/PNG), English in and out.
const createOptions: LanguageModelCreateOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

const LOCAL_ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;

/**
 * Munda's on-device + cloud intelligence via Firebase AI Logic hybrid inference in Chrome.
 *
 * On-device inference is single-turn, so the "conversation" is two single-turn calls:
 *  1. followUpQuestions: up to 2 questions that best separate the candidate causes retrieved
 *     from the crop's guide.
 *  2. buildRecord: possible causes with visible uncertainty.
 *
 * Each uses a PREFER_ON_DEVICE hybrid model (Gemini Nano when available) plus an ONLY_IN_CLOUD
 * model for long inputs or when the local call fails while online. The recorded origin comes
 * from `response.inferenceSource`, never guessed. Mirrors MundaAi.kt on Android.
 */
class MundaAi {
  readonly local = new Store<LocalModelInfo>({ state: 'UNKNOWN', progress: null });
  private models = new Map<string, GenerativeModel>();

  private model(kind: 'questions' | 'record', mode: 'hybrid' | 'cloud'): GenerativeModel {
    const key = `${kind}:${mode}`;
    let m = this.models.get(key);
    if (!m) {
      const schema = kind === 'questions' ? questionsSchema : recordSchema;
      m = getGenerativeModel(firebase().ai, {
        mode: mode === 'hybrid' ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: settings.cloudModel,
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2 },
        },
        onDeviceParams: { createOptions, promptOptions: { responseConstraint: schema } },
      });
      this.models.set(key, m);
    }
    return m;
  }

  async refreshLocalStatus(): Promise<void> {
    const lm = globalThis.LanguageModel;
    if (!lm) {
      this.local.set({ state: 'UNAVAILABLE', progress: null });
      return;
    }
    try {
      const a = await lm.availability(createOptions);
      const state: LocalModelState = a === 'available' ? 'AVAILABLE' : a === 'downloading' ? 'DOWNLOADING' : a === 'downloadable' ? 'DOWNLOADABLE' : 'UNAVAILABLE';
      if (state !== 'DOWNLOADING' || this.local.value.state !== 'DOWNLOADING') this.local.set({ state, progress: null });
    } catch (e) {
      console.warn('LanguageModel.availability failed', e);
      this.local.set({ state: 'UNAVAILABLE', progress: null });
    }
  }

  /**
   * Downloads/initialises Gemini Nano. Chrome requires a user gesture for the first download,
   * so call this from a click handler. Do it before going to the field.
   */
  async ensureLocalModel(): Promise<void> {
    await this.refreshLocalStatus();
    const s = this.local.value.state;
    if (s === 'UNAVAILABLE') return;
    if (s !== 'AVAILABLE') this.local.set({ state: 'DOWNLOADING', progress: 0 });
    try {
      // Every hybrid model shares Chrome's single Nano download.
      await this.model('record', 'hybrid').initializeDeviceModel((p) => this.local.set({ state: 'DOWNLOADING', progress: p }));
      this.local.set({ state: 'AVAILABLE', progress: null });
    } catch (e) {
      console.warn('initializeDeviceModel failed', e);
      await this.refreshLocalStatus();
    }
  }

  async followUpQuestions(input: ObservationInput, route: Route): Promise<AiOutcome<FollowUpQuestion[]>> {
    if (!settings.aiFollowUpsEnabled) return { kind: 'done', value: [], origin: 'ON_DEVICE', latencyMs: 0 };
    const candidates = guideFor(input.crop).relevant(retrievalText(input), input.core, input.stage, 4);
    return this.run('questions', questionsPrompt(input, candidates, cloudLang(route)), input.photoBase64, route, parseQuestions);
  }

  /** The guide entries a record is built from, so the screen can show what's being weighed. */
  recordCandidates(input: ObservationInput) {
    return guideFor(input.crop).relevant(retrievalText(input), input.core, input.stage, 5);
  }

  /**
   * `onText` receives the answer so far while it's written (streamed), for a live preview. It
   * restarts from '' if a retry or the cloud fallback begins a new attempt.
   */
  async buildRecord(input: ObservationInput, route: Route, onText?: (text: string) => void): Promise<AiOutcome<FieldRecord>> {
    const guide = guideFor(input.crop);
    const candidates = this.recordCandidates(input);
    const allowed = new Set(candidates.map((e) => e.id));
    return this.run('record', recordPrompt(input, candidates, cloudLang(route)), input.photoBase64, route, (t) => parseRecord(t, guide, allowed), onText);
  }

  private async run<T>(kind: 'questions' | 'record', prompt: string, photo: string | null, route: Route, parse: (t: string) => Result<T>, onText?: (text: string) => void): Promise<AiOutcome<T>> {
    const started = performance.now();
    const parts: Array<string | Part> = photo ? [{ type: 'inlineData', inlineData: { mimeType: 'image/jpeg', data: photo } }, prompt] : [prompt];

    const finish = (text: string, source: InferenceSource | undefined): AiOutcome<T> => {
      const r = parse(text);
      return r.ok
        ? { kind: 'done', value: r.value, origin: source === InferenceSource.ON_DEVICE ? 'ON_DEVICE' : 'CLOUD', latencyMs: Math.round(performance.now() - started) }
        : { kind: 'failed', reason: `Couldn't read the model's answer: ${r.error}` };
    };

    /** One attempt; streamed when someone is watching. On-device streams aren't cut off by the timeout. */
    const call = async (m: GenerativeModel): Promise<{ text: string; source: InferenceSource | undefined }> => {
      if (!onText) {
        const res = await m.generateContent(parts, { timeout: TIMEOUT_MS });
        return { text: res.response.text(), source: res.response.inferenceSource };
      }
      onText('');
      const res = await m.generateContentStream(parts, { timeout: TIMEOUT_MS });
      let acc = '';
      for await (const chunk of res.stream) {
        const piece = chunk.text();
        // Chunks are additions; older Chrome builds sent the whole text so far.
        acc = acc && piece.startsWith(acc) ? piece : acc + piece;
        onText(acc);
      }
      const final = await res.response;
      return { text: acc || final.text(), source: final.inferenceSource };
    };

    const viaCloud = async (): Promise<AiOutcome<T>> => {
      try {
        const r = await call(this.model(kind, 'cloud'));
        return finish(r.text, r.source);
      } catch (e) {
        console.warn('Cloud call failed', e);
        return connectivity.value ? { kind: 'failed', reason: errMsg(e) } : { kind: 'deferred', reason: 'Lost signal; saved for later' };
      }
    };

    if (route === 'QUEUE_UNTIL_ONLINE') return { kind: 'deferred', reason: 'No signal and no on-device model on this device' };
    if (route === 'CLOUD') return viaCloud();

    try {
      const r = await withBackoff(() => call(this.model(kind, 'hybrid')));
      const out = finish(r.text, r.source);
      // Small local model produced something unusable: one cloud retry if we can.
      return out.kind === 'failed' && connectivity.value ? viaCloud() : out;
    } catch (e) {
      console.warn('Hybrid (prefer on-device) call failed', e);
      return connectivity.value ? viaCloud() : { kind: 'deferred', reason: 'On-device model busy or unavailable; saved for later' };
    }
  }
}

async function withBackoff<R>(fn: () => Promise<R>): Promise<R> {
  let wait = 400;
  for (let i = 1; i < LOCAL_ATTEMPTS; i++) {
    try {
      return await fn();
    } catch (e) {
      console.debug(`Local attempt ${i} failed, retrying in ${wait}ms`, e);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
  return fn();
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export const mundaAi = new MundaAi();
