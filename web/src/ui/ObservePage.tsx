import { useEffect, useRef, useState } from 'react';
import { mundaAi } from '../ai/mundaAi';
import type { ObservationInput } from '../ai/prompts';
import type { CoreAnswers, CropStage as Stage, FieldRecord, FollowUpQuestion, InferenceOrigin, Observation, QA } from '../domain/models';
import { AffectedArea, CropStage, emptyCore, Limits, normalizeKey, Onset, Rainfall } from '../domain/models';
import { decideRoute, type RouteDecision } from '../domain/routing';
import { connectivity } from '../data/connectivity';
import { repository } from '../data/repository';
import { session } from '../data/session';
import { settings } from '../data/settings';
import { useStore } from '../data/store';
import { Camera, ChevronLeft, ImagePlus, Mic, Square, X } from 'lucide-react';
import { Badge, CauseEntry, ChoiceGroup, OriginBadge, Stepper, UncertaintyNote, UrgencyBadge, Working } from './components';
import { dictationSupported, fileToJpegBase64, startDictation } from './media';
import { back } from './router';

type Step = 'describe' | 'questions' | 'result';
type Questions = { kind: 'loading' } | { kind: 'ready'; questions: FollowUpQuestion[]; origin: InferenceOrigin } | { kind: 'unavailable'; reason: string };
type RecordState = { kind: 'idle' } | { kind: 'building' } | { kind: 'done'; record: FieldRecord; origin: InferenceOrigin; latencyMs: number } | { kind: 'problem'; message: string };

interface Form {
  plot: string;
  stage: Stage;
  description: string;
  photo: { base64: string; previewUrl: string } | null;
  core: CoreAnswers;
  /** Answers to AI questions, by question index. */
  answers: Record<number, string>;
}

const LAST_PLOT = 'munda.lastPlot';
const readLastPlot = () => { try { return localStorage.getItem(LAST_PLOT) ?? ''; } catch { return ''; } };

export function ObservePage() {
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  const [step, setStep] = useState<Step>('describe');
  const [form, setForm] = useState<Form>({ plot: readLastPlot(), stage: 'UNKNOWN', description: '', photo: null, core: emptyCore(), answers: {} });
  const [questions, setQuestions] = useState<Questions>({ kind: 'loading' });
  const [record, setRecord] = useState<RecordState>({ kind: 'idle' });
  const questionsFor = useRef<string | null>(null);
  const requestSeq = useRef(0);

  const followUps = (): QA[] =>
    questions.kind === 'ready'
      ? Object.entries(form.answers).flatMap(([i, a]) => { const q = questions.questions[Number(i)]; return q ? [{ question: q.text, answer: a.slice(0, Limits.MAX_ANSWER) }] : []; })
      : [];
  const input = (withFollowUps: boolean): ObservationInput => ({
    crop: 'MAIZE', plot: form.plot.trim(), stage: form.stage, description: form.description, core: form.core,
    followUps: withFollowUps ? followUps() : [], photoBase64: form.photo?.base64 ?? null,
  });
  const chars = form.description.length + Object.values(form.answers).reduce((n, a) => n + a.length + 60, 0);
  const route = decideRoute(chars, local.state, online, settings.maxOnDeviceChars);
  const canContinue = form.plot.trim() !== '' && form.description.trim() !== '';

  const edit = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch, description: (patch.description ?? f.description).slice(0, Limits.MAX_DESCRIPTION) }));
    if (record.kind !== 'building') setRecord({ kind: 'idle' });
  };

  const goBack = () => {
    if (step === 'result') { setStep('questions'); setRecord({ kind: 'idle' }); }
    else if (step === 'questions') setStep('describe');
    else back();
  };

  const toQuestions = () => {
    if (!canContinue) return;
    setStep('questions');
    // Questions are tailored to description/stage/photo: regenerate only if those changed.
    const key = `${form.description}|${form.stage}|${form.photo?.base64.length ?? 0}`;
    if (questionsFor.current === key && questions.kind === 'ready') return;
    questionsFor.current = key;
    setForm((f) => ({ ...f, answers: {} }));
    if (route.route === 'QUEUE_UNTIL_ONLINE') {
      setQuestions({ kind: 'unavailable', reason: 'Extra questions need the offline AI or signal. The three questions below are enough to save a good record.' });
      return;
    }
    setQuestions({ kind: 'loading' });
    const seq = ++requestSeq.current;
    void mundaAi.followUpQuestions(input(false), route.route).then((out) => {
      if (seq !== requestSeq.current) return; // stale
      setQuestions(out.kind === 'done' && out.value.length ? { kind: 'ready', questions: out.value, origin: out.origin } : { kind: 'unavailable', reason: out.kind === 'done' ? '' : "Extra questions aren't available right now." });
    });
  };

  const buildRecord = () => {
    if (record.kind === 'building') return;
    setStep('result');
    if (route.route === 'QUEUE_UNTIL_ONLINE') { setRecord({ kind: 'problem', message: route.reason }); return; }
    setRecord({ kind: 'building' });
    void mundaAi.buildRecord(input(true), route.route).then((out) =>
      setRecord(out.kind === 'done' ? { kind: 'done', record: out.value, origin: out.origin, latencyMs: out.latencyMs } : { kind: 'problem', message: out.reason }),
    );
  };

  /** Durable locally the moment this returns (Firestore IndexedDB cache); the sync processor does the rest. */
  const save = () => {
    const s = session.ready;
    if (!s) return;
    const done = record.kind === 'done' ? record : null;
    const o: Observation = {
      id: repository.newId(s.orgId), orgId: s.orgId, ownerUid: s.uid, crop: 'MAIZE',
      plot: form.plot.trim().slice(0, Limits.MAX_KEY), plotKey: normalizeKey(form.plot), cropStage: form.stage,
      description: form.description.trim(), core: form.core, followUps: followUps(), hadPhoto: form.photo !== null,
      record: done?.record ?? null, origin: done?.origin ?? 'PENDING', createdAtMillis: Date.now(),
      reviewStatus: 'NOT_STARTED', review: null, recordError: null,
    };
    repository.create(o);
    try { localStorage.setItem(LAST_PLOT, o.plot); } catch { /* best effort */ }
    // Replace the flow in history so Back from the record returns to the list, not the form.
    window.history.replaceState(null, '', `#/o/${o.id}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  const title = step === 'describe' ? 'What do you see?' : step === 'questions' ? 'A few questions' : 'Possible causes';
  return (
    <div className="flow">
      <div className="flow-head">
        <button className="btn-icon" aria-label={step === 'describe' ? 'Close' : 'Back'} onClick={goBack}><ChevronLeft size={22} strokeWidth={2.25} /></button>
        <Stepper step={step === 'describe' ? 0 : step === 'questions' ? 1 : 2} />
      </div>
      <h1 className="flow-title">{title}</h1>
      {step === 'describe' && <Describe form={form} edit={edit} route={route} canContinue={canContinue} onNext={toQuestions} />}
      {step === 'questions' && <QuestionsStep form={form} edit={edit} questions={questions} route={route} onNext={buildRecord} />}
      {step === 'result' && <Result state={record} onSave={save} />}
    </div>
  );
}

function Describe({ form, edit, route, canContinue, onNext }: { form: Form; edit: (p: Partial<Form>) => void; route: RouteDecision; canContinue: boolean; onNext: () => void }) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [speechError, setSpeechError] = useState<string>();
  const stopRef = useRef<() => void>(() => {});
  const desc = useRef(form.description);
  desc.current = form.description;
  useEffect(() => () => stopRef.current(), []);

  const toggleMic = () => {
    if (listening) { stopRef.current(); return; }
    setSpeechError(undefined);
    setListening(true);
    stopRef.current = startDictation(
      (seg) => edit({ description: `${desc.current.trimEnd()} ${seg}`.trim() }),
      setPartial,
      (err) => { setListening(false); setPartial(''); setSpeechError(err); },
    );
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try { edit({ photo: await fileToJpegBase64(file) }); } catch { setSpeechError('That photo couldn’t be read. Use a JPEG or PNG.'); }
  };

  return (
    <div className="form">
      <label className="field">
        <span className="field-label">Plot</span>
        <input value={form.plot} maxLength={Limits.MAX_KEY} placeholder="River plot" autoComplete="off" onChange={(e) => edit({ plot: e.target.value })} />
      </label>
      <ChoiceGroup legend="Crop stage" options={CropStage.values} selected={form.stage} label={CropStage.label} onSelect={(stage) => edit({ stage })} />
      <div className="field">
        <label className="field-label" htmlFor="desc">What you see</label>
        <div className="describe-box">
          <textarea id="desc" rows={5} value={form.description} placeholder="The lower leaves are yellow and the plants are small." onChange={(e) => edit({ description: e.target.value })} />
          <div className="describe-tools">
            {dictationSupported && (
              <button type="button" className={`tool${listening ? ' is-live' : ''}`} onClick={toggleMic} aria-pressed={listening}>
                {listening ? <Square size={16} strokeWidth={2.5} aria-hidden="true" /> : <Mic size={16} strokeWidth={2.25} aria-hidden="true" />}
                {listening ? 'Stop' : 'Dictate'}
              </button>
            )}
            <label className="tool">
              {form.photo ? <Camera size={16} strokeWidth={2.25} aria-hidden="true" /> : <ImagePlus size={16} strokeWidth={2.25} aria-hidden="true" />}
              {form.photo ? 'Change photo' : 'Add leaf photo'}
              {/* capture opens the camera on phones; on laptops it opens the file picker. */}
              <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(e) => void onPhoto(e.target.files?.[0])} hidden />
            </label>
            {form.photo && (
              <span className="thumb-wrap">
                <img className="thumb" src={form.photo.previewUrl} alt="Leaf photo" />
                <button type="button" className="thumb-remove" aria-label="Remove photo" onClick={() => edit({ photo: null })}><X size={14} strokeWidth={2.5} /></button>
              </span>
            )}
          </div>
        </div>
        {listening && <p className="hint" aria-live="polite">{partial || 'Listening…'}</p>}
        {speechError && <p className="hint error">{speechError}</p>}
      </div>
      <RouteNote route={route} />
      <button className="btn btn-primary btn-block" disabled={!canContinue} onClick={onNext}>Continue</button>
    </div>
  );
}

function QuestionsStep({ form, edit, questions, route, onNext }: { form: Form; edit: (p: Partial<Form>) => void; questions: Questions; route: RouteDecision; onNext: () => void }) {
  const setCore = (p: Partial<CoreAnswers>) => edit({ core: { ...form.core, ...p } });
  return (
    <div className="form">
      <ChoiceGroup legend="How much of the plot is affected?" options={AffectedArea.values} selected={form.core.area} label={AffectedArea.label} onSelect={(area) => setCore({ area })} />
      <ChoiceGroup legend="Rain in the last two weeks?" options={Rainfall.values} selected={form.core.rainfall} label={Rainfall.label} onSelect={(rainfall) => setCore({ rainfall })} />
      <ChoiceGroup legend="When did you first notice it?" options={Onset.values} selected={form.core.onset} label={Onset.label} onSelect={(onset) => setCore({ onset })} />
      <section className="asks" aria-live="polite">
        {questions.kind === 'loading' && <Working>{route.route === 'ON_DEVICE' ? 'Munda is choosing questions on this device' : 'Munda is choosing questions'}</Working>}
        {questions.kind === 'ready' && (
          <>
            <div className="asks-head"><h2>Munda also asks</h2><OriginBadge origin={questions.origin} /></div>
            {questions.questions.map((q, i) => (
              <ChoiceGroup key={q.text} legend={q.text} options={q.options} selected={form.answers[i]} label={(x) => x} onSelect={(a) => edit({ answers: { ...form.answers, [i]: a } })} />
            ))}
          </>
        )}
        {questions.kind === 'unavailable' && questions.reason && <p className="hint">{questions.reason}</p>}
      </section>
      <RouteNote route={route} />
      <button className="btn btn-primary btn-block" onClick={onNext}>{route.route === 'QUEUE_UNTIL_ONLINE' ? 'Continue' : 'Show possible causes'}</button>
    </div>
  );
}

function Result({ state, onSave }: { state: RecordState; onSave: () => void }) {
  if (state.kind === 'idle' || state.kind === 'building') return <Working>Writing your field record</Working>;
  if (state.kind === 'problem') {
    return (
      <div className="form">
        <p className="lede">{state.message}</p>
        <p>Your description and answers are saved now. Munda writes the field record when you’re back online.</p>
        <button className="btn btn-secondary btn-block" onClick={onSave}>Save for later</button>
      </div>
    );
  }
  const r = state.record;
  return (
    <div className="result">
      <div className="badges">
        <OriginBadge origin={state.origin} />
        <UrgencyBadge urgency={r.urgency} />
        <Badge tone="quiet">{(state.latencyMs / 1000).toFixed(1)} s</Badge>
      </div>
      <p className="result-summary">{r.summary}</p>
      <UncertaintyNote text={r.uncertaintyNote} />
      <div className="causes">{r.possibleCauses.map((c) => <CauseEntry key={c.guideId ?? c.name} cause={c} animate />)}</div>
      <button className="btn btn-primary btn-block" onClick={onSave}>Save field record</button>
    </div>
  );
}

function RouteNote({ route }: { route: RouteDecision }) {
  return <p className={`route route-${route.route.toLowerCase()}`}>{route.reason}</p>;
}
