import {
  collection, doc, getDoc, getDocFromServer, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
  type DocumentSnapshot, type Unsubscribe,
} from 'firebase/firestore';
import type { FieldRecord, HistoryReview, Observation, Pattern, PossibleCause, ReviewStatus } from '../domain/models';
import { AffectedArea, Crop, CropStage, FindingSource, InferenceOrigin, Likelihood, Onset, PatternKind, Rainfall, ReviewStatus as RS, Urgency } from '../domain/models';
import { firebase } from './firebase';

/** An observation plus whether Firestore has acknowledged it (false = only on this device so far). */
export interface ObservationItem {
  observation: Observation;
  synced: boolean;
}

const SCHEMA_VERSION = 1;

const isPermissionDenied = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'permission-denied';

/**
 * Firestore is both the system of record and the offline queue: writes land in the IndexedDB
 * cache immediately and sync when signal returns. Writes are never awaited on the UI path,
 * because offline the promise only resolves after reconnect.
 *
 * Layout and field names are identical to the Android client: orgs/{orgId}/observations/{id}.
 */
const col = (orgId: string) => collection(firebase().db, 'orgs', orgId, 'observations');

export const repository = {
  newId: (orgId: string) => doc(col(orgId)).id,

  observeRecent(orgId: string, onChange: (items: ObservationItem[]) => void, max = 100): Unsubscribe {
    return onSnapshot(
      query(col(orgId), orderBy('createdAtMillis', 'desc'), limit(max)),
      { includeMetadataChanges: true },
      (snap) => onChange(snap.docs.flatMap((d) => toItem(d))),
      (err) => console.warn('Observation listener error', err),
    );
  },

  observe(orgId: string, id: string, onChange: (item: ObservationItem | null) => void): Unsubscribe {
    return onSnapshot(
      doc(col(orgId), id),
      { includeMetadataChanges: true },
      (d) => onChange(toItem(d)[0] ?? null),
      (err) => console.warn('Observation listener error', err),
    );
  },

  /** Fire-and-forget create; durable locally the moment this returns. */
  create(o: Observation) {
    const ref = doc(col(o.orgId), o.id);
    setDoc(ref, toCreateMap(o)).catch(async (e) => {
      // On flaky connections Firestore can re-send a create whose first attempt already
      // committed. The rules reject the replay (it would overwrite a later record/review), so
      // check whether our document is already there before treating this as a failure.
      // The replay can coincide with a sign-in token refresh, so check a few times with a delay.
      if (isPermissionDenied(e)) {
        for (const wait of [500, 2000, 5000]) {
          await new Promise((r) => setTimeout(r, wait));
          try {
            const server = await getDocFromServer(ref);
            if (server.exists() && server.get('ownerUid') === o.ownerUid) {
              console.info('Observation already saved; duplicate send ignored', o.id);
              return;
            }
            if (!server.exists()) break;
          } catch { /* token may still be refreshing; try again */ }
        }
      }
      console.error('Create rejected', o.id, e);
    });
  },

  saveRecord(orgId: string, id: string, record: FieldRecord, origin: InferenceOrigin) {
    updateDoc(doc(col(orgId), id), { record: recordMap(record), origin, recordError: null, updatedAt: serverTimestamp() })
      .catch((e) => console.error('Record update rejected', id, e));
  },

  saveRecordError(orgId: string, id: string, message: string) {
    updateDoc(doc(col(orgId), id), { recordError: message.slice(0, 200), updatedAt: serverTimestamp() })
      .catch((e) => console.error('Record error update rejected', id, e));
  },

  saveReview(orgId: string, id: string, status: ReviewStatus, review: HistoryReview | null) {
    updateDoc(doc(col(orgId), id), { reviewStatus: status, review: review ? reviewMap(review) : null, updatedAt: serverTimestamp() })
      .catch((e) => console.error('Review update rejected', id, e));
  },

  async get(orgId: string, id: string): Promise<Observation | null> {
    return toItem(await getDoc(doc(col(orgId), id)))[0]?.observation ?? null;
  },

  async historyForPlot(orgId: string, plotKey: string, sinceMillis: number, max = 20): Promise<Observation[]> {
    const snap = await getDocs(query(col(orgId), where('plotKey', '==', plotKey), where('createdAtMillis', '>=', sinceMillis), orderBy('createdAtMillis', 'desc'), limit(max)));
    return snap.docs.flatMap((d) => toItem(d).map((i) => i.observation));
  },

  async recentOnFarm(orgId: string, sinceMillis: number, max = 40): Promise<Observation[]> {
    const snap = await getDocs(query(col(orgId), where('createdAtMillis', '>=', sinceMillis), orderBy('createdAtMillis', 'desc'), limit(max)));
    return snap.docs.flatMap((d) => toItem(d).map((i) => i.observation));
  },
};

// ---- Mapping: explicit, so the wire shape matches firestore.rules exactly. ----

const causeMap = (c: PossibleCause) => ({ guideId: c.guideId, name: c.name, likelihood: c.likelihood, supporting: c.supporting, againstOrMissing: c.againstOrMissing, checkNext: c.checkNext });
const recordMap = (r: FieldRecord) => ({ summary: r.summary, symptoms: r.symptoms, possibleCauses: r.possibleCauses.map(causeMap), urgency: r.urgency, uncertaintyNote: r.uncertaintyNote });
const reviewMap = (r: HistoryReview) => ({
  summary: r.summary,
  patterns: r.patterns.map((p) => ({ kind: p.kind, summary: p.summary, relatedIds: p.relatedIds, source: p.source })),
  updatedCauses: r.updatedCauses.map(causeMap),
  nextChecks: r.nextChecks,
  reviewedAtMillis: r.reviewedAtMillis,
  historyConsidered: r.historyConsidered,
});

function toCreateMap(o: Observation) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: o.id,
    orgId: o.orgId,
    ownerUid: o.ownerUid,
    plot: o.plot,
    plotKey: o.plotKey,
    crop: o.crop,
    cropStage: o.cropStage,
    description: o.description,
    core: { area: o.core.area, rainfall: o.core.rainfall, onset: o.core.onset },
    followUps: o.followUps.map((f) => ({ q: f.question, a: f.answer })),
    hadPhoto: o.hadPhoto,
    record: o.record ? recordMap(o.record) : null,
    origin: o.origin,
    createdAtMillis: o.createdAtMillis,
    reviewStatus: o.reviewStatus,
    review: null,
    recordError: o.recordError,
    area: o.area ?? null,
    cell: o.cell ?? null,
    syncedAt: serverTimestamp(),
  };
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const objs = (v: unknown) => (Array.isArray(v) ? v.map(obj).filter((x): x is Obj => x !== null) : []);
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

const toCause = (c: Obj): PossibleCause => ({
  guideId: typeof c.guideId === 'string' ? c.guideId : null,
  name: str(c.name),
  likelihood: Likelihood.parse(c.likelihood),
  supporting: strs(c.supporting),
  againstOrMissing: strs(c.againstOrMissing),
  checkNext: str(c.checkNext),
});

const toRecord = (r: Obj): FieldRecord => ({
  summary: str(r.summary), symptoms: strs(r.symptoms), possibleCauses: objs(r.possibleCauses).map(toCause),
  urgency: Urgency.parse(r.urgency), uncertaintyNote: str(r.uncertaintyNote),
});

const toReview = (r: Obj): HistoryReview => ({
  summary: str(r.summary),
  patterns: objs(r.patterns).map((p): Pattern => ({ kind: PatternKind.parse(p.kind), summary: str(p.summary), relatedIds: strs(p.relatedIds), source: FindingSource.parse(p.source) })),
  updatedCauses: objs(r.updatedCauses).map(toCause),
  nextChecks: strs(r.nextChecks),
  reviewedAtMillis: num(r.reviewedAtMillis),
  historyConsidered: num(r.historyConsidered),
});

function toItem(d: DocumentSnapshot): ObservationItem[] {
  if (!d.exists()) return [];
  try {
    const x = d.data() as Obj;
    const core = obj(x.core) ?? {};
    const rec = obj(x.record);
    const rev = obj(x.review);
    const observation: Observation = {
      id: str(x.id) || d.id,
      orgId: str(x.orgId),
      ownerUid: str(x.ownerUid),
      crop: Crop.parse(x.crop),
      plot: str(x.plot),
      plotKey: str(x.plotKey),
      cropStage: CropStage.parse(x.cropStage),
      description: str(x.description),
      core: { area: AffectedArea.parse(core.area), rainfall: Rainfall.parse(core.rainfall), onset: Onset.parse(core.onset) },
      followUps: objs(x.followUps).map((f) => ({ question: str(f.q), answer: str(f.a) })),
      hadPhoto: x.hadPhoto === true,
      record: rec ? toRecord(rec) : null,
      origin: InferenceOrigin.parse(x.origin),
      createdAtMillis: num(x.createdAtMillis),
      reviewStatus: RS.parse(x.reviewStatus),
      review: rev ? toReview(rev) : null,
      recordError: typeof x.recordError === 'string' ? x.recordError : null,
      area: typeof x.area === 'string' ? x.area : null,
      cell: typeof x.cell === 'string' ? x.cell : null,
    };
    return [{ observation, synced: !d.metadata.hasPendingWrites }];
  } catch (e) {
    console.warn('Skipping malformed observation', d.id, e);
    return [];
  }
}
