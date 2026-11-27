import { isNativeIOS } from '../ai/appleNative';
import { selectedDeviceArea } from '../data/deviceArea';
import { coarseCell } from '../domain/groups';
import { Camera, Image as ImageIcon, Mic, PenLine, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { mundaAi } from '../ai/mundaAi';
import type { ObservationInput } from '../ai/prompts';
import { connectivity } from '../data/connectivity';
import { repository } from '../data/repository';
import { pendingPhotos } from '../data/pendingPhotos';
import { prefs } from '../data/prefs';
import { placeCell } from '../data/weather';
import { session } from '../data/session';
import { settings } from '../data/settings';
import { useStore } from '../data/store';
import { plotsFrom } from '../domain/farm';
import type { CoreAnswers, CropStage as Stage, FollowUpQuestion, InferenceOrigin, Observation, QA } from '../domain/models';
import { AffectedArea, CropStage, emptyCore, Limits, normalizeKey, Onset, PHOTO_ONLY, Rainfall } from '../domain/models';
import { decideRoute, type RouteDecision } from '../domain/routing';
import { labelArea, labelOnset, labelRain, labelStage, useLang, useT } from '../i18n';
import { OriginBadge, Working } from './components';
import { PageHead } from './Header';
import { dictationSupported, fileToJpegBase64, startDictation } from './media';
import { nextStep, prevStep, stepsFor, type ObserveStep } from './observe/steps';
import { PictureChoice } from './observe/PictureChoice';
import { areaPicture, onsetPicture, rainPicture, stagePicture } from './observe/pictures';
import { ReadAloud } from './ReadAloud';
import { ResultStep, type RecordState } from './ResultStep';
import { guideFor } from '../domain/guide';
import { causeDisplay } from '../domain/localize';
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
  const recordSeq = useRef(0);
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
  const route = decideRoute(chars, local.state, online, settings.maxOnDeviceChars, { hasPhoto: Boolean(form.photo), supportsLocalImages: !isNativeIOS() });
  // While questions are loading we still plan to show them; "unavailable" or none skips the step.
  const hasFollowUps = step === 'followups' || questions.kind === 'loading' || (questions.kind === 'ready' && questions.questions.length > 0);
  const steps = stepsFor(hasFollowUps);
  const hasFollowUpsRef = useRef(hasFollowUps);
  hasFollowUpsRef.current = hasFollowUps;

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
    if (route.route === 'QUEUE_UNTIL_ONLINE') { setRecord({ kind: 'problem', message: route.reason }); return; }
    const inp = input(true);
    const started = { kind: 'building', text: '', startedAt: performance.now(), route: route.route, candidates: mundaAi.recordCandidates(inp) } as const;
    setRecord(started);
    // Only the latest build may land: after Back and a changed answer, an earlier one is stale.
    const seq = ++recordSeq.current;
    const onText = (text: string) => { if (seq === recordSeq.current) setRecord((r) => (r.kind === 'building' ? { ...r, text } : r)); };
    void mundaAi.buildRecord(inp, route.route, onText).then((out) => {
      if (seq !== recordSeq.current) return;
      setRecord(out.kind === 'done' ? { kind: 'done', record: out.value, origin: out.origin, latencyMs: out.latencyMs } : { kind: 'problem', message: out.reason });
    });
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
    if (step === 'result') { recordSeq.current++; setRecord({ kind: 'idle' }); }
    if (p) goTo(p); else back();
  };
  // The timer must run the goTo of the render *after* the answer is applied, or the record is
  // built from the form as it was before the last tap (e.g. onset still "not sure").
  const latestGoTo = useRef(goTo);
  latestGoTo.current = goTo;
  const answerAndAdvance = (patch: Partial<Form>) => {
    edit(patch);
    window.clearTimeout(advanceTimer.current);
    const from = step;
    advanceTimer.current = window.setTimeout(() => latestGoTo.current(nextStep(from, hasFollowUpsRef.current)), AUTO_ADVANCE_MS);
  };
  const setCore = (p: Partial<CoreAnswers>) => answerAndAdvance({ core: { ...form.core, ...p } });

  /** Durable locally the moment this returns (Firestore IndexedDB cache); the sync processor does the rest. */
  const save = () => {
    const s = session.ready;
    if (!s) return;
    const done = record.kind === 'done' ? record : null;
    const selectedArea = selectedDeviceArea();
    const o: Observation = {
      id: repository.newId(s.orgId), orgId: s.orgId, ownerUid: s.uid, crop: 'MAIZE',
      plot: form.plot.trim().slice(0, Limits.MAX_KEY), plotKey: normalizeKey(form.plot), cropStage: form.stage,
      description, core: form.core, followUps: followUps(), hadPhoto: form.photo !== null,
      record: done?.record ?? null, origin: done?.origin ?? 'PENDING', createdAtMillis: Date.now(),
      reviewStatus: 'NOT_STARTED', review: null, recordError: null,
      // Only the typed area and a ~5 km square, for the group officer's map; never an exact position.
      area: prefs.value.place.trim() || null, cell: selectedArea ? coarseCell(selectedArea.latitude, selectedArea.longitude) : placeCell.value,
    };
    repository.create(o);
    // Not finished yet (offline, no on-device AI): keep the photo on this device only, so the check
    // can be finished from it when signal returns. Never synced; deleted once used.
    if (!done && form.photo) void pendingPhotos.put(o.id, form.photo.base64);
    try { localStorage.setItem(LAST_PLOT, o.plot); } catch { /* best effort */ }
    // Replace the flow in history so Back from the record returns home, not into the form.
    window.history.replaceState(null, '', href({ name: 'record', id: o.id }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  // The model returned no questions while the farmer waited on that screen: nothing to ask, move on.
  useEffect(() => {
    if (step === 'followups' && questions.kind === 'unavailable' && !questions.reason) goTo('result');
  });

  /** What read-aloud speaks: the question and its answers, or the leading cause and its check. */
  const readText = (): string => {
    const list = (title: string, labels: string[]) => [title, ...labels].join('. ');
    switch (step) {
      case 'describe': return [t('observe.describeTitle'), t('observe.describeHint')].join('. ');
      case 'plot': return list(t('observe.plotTitle'), []);
      case 'area': return list(t('observe.areaTitle'), AffectedArea.values.map((a) => labelArea(a, lang)));
      case 'rain': return list(t('observe.rainTitle'), Rainfall.values.map((r) => labelRain(r, lang)));
      case 'onset': return list(t('observe.onsetTitle'), Onset.values.map((o) => labelOnset(o, lang)));
      case 'followups': return questions.kind === 'ready' ? questions.questions.map((q) => list(q.text, q.options)).join('. ') : '';
      case 'result': {
        const lead = record.kind === 'done' ? record.record.possibleCauses[0] : undefined;
        if (!lead) return '';
        const d = causeDisplay(lead, lang, guideFor('MAIZE'));
        return [t('result.title'), d.name, t('result.checkFirst'), d.check].join('. ');
      }
    }
  };

  const index = steps.indexOf(step);
  return (
    <div className="flow">
      <PageHead title={t('studio.fieldCheck')} onBack={goBack} right={<ReadAloud text={readText()} />} />
      <div className="page" style={{ gap: 18 }}>
        <p className="flow-progress-label">{t('observe.stepOf', { n: index + 1, total: steps.length })}</p>
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
  const online = useStore(connectivity);
  const lang = useLang();
  const [typing, setTyping] = useState(form.description !== '');
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [problem, setProblem] = useState<string>();
  const stopRef = useRef<() => void>(() => {});
  const desc = useRef(form.description);
  desc.current = form.description;
  useEffect(() => () => stopRef.current(), []);

  // Photo only: Munda describes the visible signs so matching and questions work as if the farmer
  // had described it. Filled in when the box is empty (marked as Munda's words), offered otherwise.
  const local = useStore(mundaAi.local);
  const [seen, setSeen] = useState<{ kind: 'idle' | 'reading' | 'filled' | 'unclear' } | { kind: 'suggest'; signs: string }>({ kind: 'idle' });
  const seenFor = useRef<string | null>(null);
  useEffect(() => {
    const photo = form.photo;
    if (!photo) { seenFor.current = null; setSeen({ kind: 'idle' }); return; }
    if (seenFor.current === photo.previewUrl) return;
    seenFor.current = photo.previewUrl;
    const route = decideRoute(0, local.state, online, settings.maxOnDeviceChars, { hasPhoto: true, supportsLocalImages: !isNativeIOS() }).route;
    if (route === 'QUEUE_UNTIL_ONLINE') return;
    setSeen({ kind: 'reading' });
    void mundaAi.describePhoto(photo.base64, 'MAIZE', route).then((out) => {
      if (seenFor.current !== photo.previewUrl) return;
      if (out.kind !== 'done') { setSeen({ kind: 'idle' }); return; }
      if (!out.value.clear) { setSeen({ kind: 'unclear' }); return; }
      if (!desc.current.trim()) { edit({ description: out.value.signs }); setTyping(true); setSeen({ kind: 'filled' }); }
      else setSeen({ kind: 'suggest', signs: out.value.signs });
    });
  }, [form.photo]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = () => {
    if (listening) { stopRef.current(); return; }
    if (!online) { setProblem(t('studio.voiceOffline')); return; }
    setProblem(undefined);
    setListening(true);
    setTyping(true);
    stopRef.current = startDictation(
      (seg) => edit({ description: `${desc.current.trimEnd()} ${seg}`.trim() }),
      setPartial,
      (err) => { setListening(false); setPartial(''); setProblem(err); },
      lang,
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
      {/* No capture attribute: phones offer the gallery (a photo taken earlier, or one sent by a neighbour). */}
      <label className="text-btn gallery-btn">
        <ImageIcon size={18} strokeWidth={2.25} aria-hidden="true" />{t('observe.fromGallery')}
        <input type="file" accept="image/jpeg,image/png" onChange={(e) => void onPhoto(e.target.files?.[0])} hidden />
      </label>
      <p className="hint">{t('observe.photoTips')}</p>
      {seen.kind === 'reading' && <Working>{t('observe.reading')}</Working>}
      {seen.kind === 'unclear' && <p className="hint error">{t('observe.unclear')}</p>}
      {seen.kind === 'suggest' && (
        <div className="seen-card">
          <p>{seen.signs}</p>
          <button type="button" className="btn btn-ghost" onClick={() => { edit({ description: `${desc.current.trimEnd()} ${seen.signs}`.trim() }); setSeen({ kind: 'filled' }); }}>{t('observe.addSeen')}</button>
        </div>
      )}

      <div className="duo">
        {dictationSupported && (
          <button type="button" className={`duo-btn${listening ? ' is-live' : ''}`} onClick={toggleMic} disabled={!online && !listening} aria-describedby="voice-note" aria-pressed={listening}>
            {listening ? <Square size={18} strokeWidth={2.5} aria-hidden="true" /> : <Mic size={18} strokeWidth={2.25} aria-hidden="true" />}
            {listening ? t('observe.stop') : t('observe.speak')}
          </button>
        )}
        <button type="button" className="duo-btn" aria-pressed={typing} onClick={() => setTyping(true)}>
          <PenLine size={18} strokeWidth={2.25} aria-hidden="true" />{t('observe.type')}
        </button>
      </div>

      {dictationSupported && <p id="voice-note" className="hint voice-note">{t('studio.voiceHelp')}</p>}
      <p className="hint privacy-note">{t('studio.privatePhoto')}</p>
      {seen.kind === 'filled' && typing && <p className="hint seen-note">{t('observe.seenNote')}</p>}
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
