import { Camera, Mic, PenLine, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { mundaAi } from '../ai/mundaAi';
import type { ObservationInput } from '../ai/prompts';
import { connectivity } from '../data/connectivity';
import { repository } from '../data/repository';
import { session } from '../data/session';
import { settings } from '../data/settings';
import { useStore } from '../data/store';
import { plotsFrom } from '../domain/farm';
import type { CoreAnswers, CropStage as Stage, FollowUpQuestion, InferenceOrigin, Observation, QA } from '../domain/models';
import { AffectedArea, CropStage, emptyCore, Limits, normalizeKey, Onset, Rainfall } from '../domain/models';
import { decideRoute, type RouteDecision } from '../domain/routing';
import { labelArea, labelOnset, labelRain, labelStage, useLang, useT } from '../i18n';
import { OriginBadge, Working } from './components';
import { PageHead } from './Header';
import { dictationSupported, fileToJpegBase64, startDictation } from './media';
import { nextStep, prevStep, stepsFor, type ObserveStep } from './observe/steps';
import { PictureChoice } from './observe/PictureChoice';
import { areaPicture, onsetPicture, rainPicture, stagePicture } from './observe/pictures';
import { ResultStep, type RecordState } from './ResultStep';
import { back, href } from './router';
import { useObservations } from './useObservations';

type Questions = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; questions: FollowUpQuestion[]; origin: InferenceOrigin } | { kind: 'unavailable'; reason: string };

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
/** Firestore rules require a description; a photo alone is a complete observation for the farmer. */
const PHOTO_ONLY = 'Leaf photo only; the farmer gave no description.';
/** Long enough to see the tile light up before the next question slides in. */
const AUTO_ADVANCE_MS = 260;

export function ObservePage() {
  const t = useT();
  const lang = useLang();
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  const plots = plotsFrom((useObservations() ?? []).map((i) => i.observation));
  const [step, setStep] = useState<ObserveStep>('describe');
  const [form, setForm] = useState<Form>({ plot: readLastPlot(), stage: 'UNKNOWN', description: '', photo: null, core: emptyCore(), answers: {} });
  const [questions, setQuestions] = useState<Questions>({ kind: 'idle' });
  const [record, setRecord] = useState<RecordState>({ kind: 'idle' });
  const questionsFor = useRef<string | null>(null);
  const requestSeq = useRef(0);
  const advanceTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const description = form.description.trim() || (form.photo ? PHOTO_ONLY : '');
  const followUps = (): QA[] =>
    questions.kind === 'ready'
      ? Object.entries(form.answers).flatMap(([i, a]) => { const q = questions.questions[Number(i)]; return q ? [{ question: q.text, answer: a.slice(0, Limits.MAX_ANSWER) }] : []; })
      : [];
  const input = (withFollowUps: boolean): ObservationInput => ({
    crop: 'MAIZE', plot: form.plot.trim(), stage: form.stage, description, core: form.core,
    followUps: withFollowUps ? followUps() : [], photoBase64: form.photo?.base64 ?? null,
  });
  const chars = description.length + Object.values(form.answers).reduce((n, a) => n + a.length + 60, 0);
  const route = decideRoute(chars, local.state, online, settings.maxOnDeviceChars);
  // While questions are loading we still plan to show them; "unavailable" or none skips the step.
  const hasFollowUps = step === 'followups' || questions.kind === 'loading' || (questions.kind === 'ready' && questions.questions.length > 0);
  const steps = stepsFor(hasFollowUps);

  const edit = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch, description: (patch.description ?? f.description).slice(0, Limits.MAX_DESCRIPTION) }));
    if (record.kind !== 'building') setRecord({ kind: 'idle' });
  };

  /** Questions depend on the description, stage and photo; fetched as soon as those are known so they're ready by the end. */
  const fetchQuestions = () => {
    const key = `${description}|${form.stage}|${form.photo?.base64.length ?? 0}`;
    if (questionsFor.current === key && (questions.kind === 'ready' || questions.kind === 'loading')) return;
    questionsFor.current = key;
    setForm((f) => ({ ...f, answers: {} }));
    if (route.route === 'QUEUE_UNTIL_ONLINE') { setQuestions({ kind: 'unavailable', reason: t('observe.questionsUnavailable') }); return; }
    setQuestions({ kind: 'loading' });
    const seq = ++requestSeq.current;
    void mundaAi.followUpQuestions(input(false), route.route).then((out) => {
      if (seq !== requestSeq.current) return; // stale
      setQuestions(out.kind === 'done' && out.value.length ? { kind: 'ready', questions: out.value, origin: out.origin } : { kind: 'unavailable', reason: out.kind === 'done' ? '' : t('observe.questionsFailed') });
    });
  };

  const buildRecord = () => {
    if (record.kind === 'building') return;
    if (route.route === 'QUEUE_UNTIL_ONLINE') { setRecord({ kind: 'problem', message: route.reason }); return; }
    setRecord({ kind: 'building' });
    void mundaAi.buildRecord(input(true), route.route).then((out) =>
      setRecord(out.kind === 'done' ? { kind: 'done', record: out.value, origin: out.origin, latencyMs: out.latencyMs } : { kind: 'problem', message: out.reason }),
    );
  };

  const goTo = (s: ObserveStep | null) => {
    if (!s) return;
    window.clearTimeout(advanceTimer.current);
    if (s === 'area' && step === 'plot') fetchQuestions();
    if (s === 'result') buildRecord();
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const next = () => goTo(nextStep(step, hasFollowUps));
  const goBack = () => {
    const p = prevStep(step, hasFollowUps);
    if (step === 'result') setRecord({ kind: 'idle' });
    if (p) goTo(p); else back();
  };
  const answerAndAdvance = (patch: Partial<Form>) => {
    edit(patch);
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => goTo(nextStep(step, hasFollowUps)), AUTO_ADVANCE_MS);
  };
  const setCore = (p: Partial<CoreAnswers>) => answerAndAdvance({ core: { ...form.core, ...p } });

  /** Durable locally the moment this returns (Firestore IndexedDB cache); the sync processor does the rest. */
  const save = () => {
    const s = session.ready;
    if (!s) return;
    const done = record.kind === 'done' ? record : null;
    const o: Observation = {
      id: repository.newId(s.orgId), orgId: s.orgId, ownerUid: s.uid, crop: 'MAIZE',
      plot: form.plot.trim().slice(0, Limits.MAX_KEY), plotKey: normalizeKey(form.plot), cropStage: form.stage,
      description, core: form.core, followUps: followUps(), hadPhoto: form.photo !== null,
      record: done?.record ?? null, origin: done?.origin ?? 'PENDING', createdAtMillis: Date.now(),
      reviewStatus: 'NOT_STARTED', review: null, recordError: null,
    };
    repository.create(o);
    try { localStorage.setItem(LAST_PLOT, o.plot); } catch { /* best effort */ }
    // Replace the flow in history so Back from the record returns home, not into the form.
    window.history.replaceState(null, '', href({ name: 'record', id: o.id }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  // The model returned no questions while the farmer waited on that screen: nothing to ask, move on.
  useEffect(() => {
    if (step === 'followups' && questions.kind === 'unavailable' && !questions.reason) goTo('result');
  });

  const index = steps.indexOf(step);
  return (
    <div className="flow">
      <PageHead
        onBack={goBack}
        title={undefined}
        right={<span className="icon-spacer" />}
      />
      <div className="page" style={{ gap: 18 }}>
        <div className="dots" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={t('observe.stepOf', { n: index + 1, total: steps.length })}>
          {steps.map((s, i) => <i key={s} className={i <= index ? 'on' : ''} />)}
        </div>

        {step === 'describe' && <Describe form={form} edit={edit} canContinue={description !== ''} onNext={next} />}

        {step === 'plot' && (
          <>
            <h2 className="page-title">{t('observe.plotTitle')}</h2>
            <PlotPicker value={form.plot} plots={plots.map((p) => p.name)} onChange={(plot) => edit({ plot })} />
            <p className="tag" style={{ marginTop: 8 }}>{t('observe.stageTitle')}</p>
            <PictureChoice question={t('observe.stageTitle')} options={CropStage.values} selected={form.stage} picture={stagePicture} label={(s) => labelStage(s, lang)} onSelect={(stage) => edit({ stage })} />
            <button className="btn btn-primary btn-main" disabled={form.plot.trim() === ''} onClick={next}>{t('common.continue')}</button>
          </>
        )}

        {step === 'area' && (
          <Question title={t('observe.areaTitle')} origin={null}>
            <PictureChoice question={t('observe.areaTitle')} options={AffectedArea.values} selected={form.core.area === 'UNKNOWN' ? undefined : form.core.area} picture={areaPicture} label={(a) => labelArea(a, lang)} onSelect={(area) => setCore({ area })} />
          </Question>
        )}
        {step === 'rain' && (
          <Question title={t('observe.rainTitle')} origin={null}>
            <PictureChoice question={t('observe.rainTitle')} options={Rainfall.values} selected={form.core.rainfall === 'UNKNOWN' ? undefined : form.core.rainfall} picture={rainPicture} label={(r) => labelRain(r, lang)} onSelect={(rainfall) => setCore({ rainfall })} />
          </Question>
        )}
        {step === 'onset' && (
          <Question title={t('observe.onsetTitle')} origin={null}>
            <PictureChoice question={t('observe.onsetTitle')} options={Onset.values} selected={form.core.onset === 'UNKNOWN' ? undefined : form.core.onset} picture={onsetPicture} label={(o) => labelOnset(o, lang)} onSelect={(onset) => setCore({ onset })} />
          </Question>
        )}

        {step === 'followups' && (
          <FollowUps
            questions={questions}
            route={route}
            answers={form.answers}
            onAnswer={(i, a) => edit({ answers: { ...form.answers, [i]: a } })}
            onNext={next}
          />
        )}

        {step === 'result' && <ResultStep state={record} onSave={save} />}
      </div>
    </div>
  );
}

function Question({ title, origin, children }: { title: string; origin: InferenceOrigin | null; children: ReactNode }) {
  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="page-title">{title}</h2>
        {origin && <OriginBadge origin={origin} />}
      </div>
      {children}
    </>
  );
}

function Describe({ form, edit, canContinue, onNext }: { form: Form; edit: (p: Partial<Form>) => void; canContinue: boolean; onNext: () => void }) {
  const t = useT();
  const [typing, setTyping] = useState(form.description !== '');
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [problem, setProblem] = useState<string>();
  const stopRef = useRef<() => void>(() => {});
  const desc = useRef(form.description);
  desc.current = form.description;
  useEffect(() => () => stopRef.current(), []);

  const toggleMic = () => {
    if (listening) { stopRef.current(); return; }
    setProblem(undefined);
    setListening(true);
    setTyping(true);
    stopRef.current = startDictation(
      (seg) => edit({ description: `${desc.current.trimEnd()} ${seg}`.trim() }),
      setPartial,
      (err) => { setListening(false); setPartial(''); setProblem(err); },
    );
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try { edit({ photo: await fileToJpegBase64(file) }); } catch { setProblem(t('observe.photoError')); }
  };

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <h2 className="page-title">{t('observe.describeTitle')}</h2>
        <p className="muted">{t('observe.describeHint')}</p>
      </div>

      {form.photo ? (
        <div className="photo-preview">
          <img src={form.photo.previewUrl} alt={t('observe.photoUsed')} />
          <label className="btn btn-ghost">
            <Camera size={18} strokeWidth={2.25} aria-hidden="true" />{t('observe.changePhoto')}
            <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(e) => void onPhoto(e.target.files?.[0])} hidden />
          </label>
          <button type="button" className="icon-btn photo-remove" aria-label={t('observe.removePhoto')} onClick={() => edit({ photo: null })}><X size={18} strokeWidth={2.5} /></button>
        </div>
      ) : (
        // capture opens the camera on phones; on laptops it opens the file picker.
        <label className="action-card action-card-inline">
          <span className="action-icon"><Camera size={28} strokeWidth={2.2} aria-hidden="true" /></span>
          <span><b>{t('observe.takePhoto')}</b><small>{t('observe.takePhotoSub')}</small></span>
          <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(e) => void onPhoto(e.target.files?.[0])} hidden />
        </label>
      )}

      <div className="duo">
        {dictationSupported && (
          <button type="button" className={`duo-btn${listening ? ' is-live' : ''}`} onClick={toggleMic} aria-pressed={listening}>
            {listening ? <Square size={18} strokeWidth={2.5} aria-hidden="true" /> : <Mic size={18} strokeWidth={2.25} aria-hidden="true" />}
            {listening ? t('observe.stop') : t('observe.speak')}
          </button>
        )}
        <button type="button" className="duo-btn" aria-pressed={typing} onClick={() => setTyping(true)}>
          <PenLine size={18} strokeWidth={2.25} aria-hidden="true" />{t('observe.type')}
        </button>
      </div>

      {typing && (
        <textarea rows={4} value={form.description} placeholder={t('observe.placeholder')} aria-label={t('observe.describeTitle')} autoFocus={!listening} onChange={(e) => edit({ description: e.target.value })} />
      )}
      {listening && <p className="hint" aria-live="polite">{partial || t('observe.listening')}</p>}
      {problem && <p className="hint error">{problem}</p>}

      <button className="btn btn-primary btn-main" disabled={!canContinue} onClick={onNext}>{t('common.continue')}</button>
    </>
  );
}

function PlotPicker({ value, plots, onChange }: { value: string; plots: string[]; onChange: (v: string) => void }) {
  const t = useT();
  const key = normalizeKey(value);
  return (
    <div className="stack">
      {plots.length > 0 && (
        <div className="lang-chips" role="group" aria-label={t('observe.plotTitle')}>
          {plots.map((p) => (
            <button key={p} type="button" className="lang-chip" aria-pressed={normalizeKey(p) === key} onClick={() => onChange(p)}>{p}</button>
          ))}
        </div>
      )}
      <input value={value} maxLength={Limits.MAX_KEY} placeholder={plots.length ? t('observe.plotNew') : t('observe.plotPlaceholder')} autoComplete="off" aria-label={t('observe.plotTitle')} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FollowUps({ questions, route, answers, onAnswer, onNext }: {
  questions: Questions; route: RouteDecision; answers: Record<number, string>; onAnswer: (i: number, a: string) => void; onNext: () => void;
}) {
  const t = useT();
  return (
    <>
      <h2 className="page-title">{t('observe.followupsTitle')}</h2>
      {questions.kind === 'loading' && <Working>{route.route === 'ON_DEVICE' ? t('observe.choosingOnDevice') : t('observe.choosing')}</Working>}
      {questions.kind === 'unavailable' && questions.reason && <p className="hint">{questions.reason}</p>}
      {questions.kind === 'ready' && (
        <>
          <OriginBadge origin={questions.origin} />
          {questions.questions.map((q, i) => (
            <fieldset key={q.text} className="choice">
              <legend className="question-text">{q.text}</legend>
              <div className="tiles tiles-text" role="radiogroup" aria-label={q.text}>
                {q.options.map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={answers[i] === o} className="tile tile-text" onClick={() => onAnswer(i, o)}>
                    <b>{o}</b>
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </>
      )}
      <button className="btn btn-primary btn-main" disabled={questions.kind === 'loading'} onClick={onNext}>
        {route.route === 'QUEUE_UNTIL_ONLINE' ? t('common.continue') : t('observe.showCauses')}
      </button>
    </>
  );
}
