import type { Unsubscribe } from 'firebase/firestore';
import { errMsg, mundaAi } from '../ai/mundaAi';
import { reviewObservation } from '../ai/reviewer';
import type { Observation } from '../domain/models';
import { connectivity } from '../data/connectivity';
import { repository } from '../data/repository';
import { session } from '../data/session';

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 15_000;
const TICK_MS = 60_000;

/**
 * The "when connected" half of Munda on the web (Android uses WorkManager). Watches this user's
 * observations and, whenever online:
 *  - builds records for observations saved without one (no local model + no signal), via cloud;
 *  - runs the cloud history review for records that haven't had one.
 * Browsers don't run reliable background jobs for closed pages, so this runs while the app is
 * open; work survives reloads because the queue *is* Firestore state. A Web Lock ensures only
 * one tab processes at a time. Failures back off exponentially and stop after MAX_ATTEMPTS.
 */
class SyncProcessor {
  private latest: Observation[] = [];
  private attempts = new Map<string, { n: number; nextAt: number }>();
  private running = false;
  private unsub: Unsubscribe | null = null;

  start() {
    let orgId: string | null = null;
    const onSession = () => {
      const s = session.ready;
      if (s?.orgId === orgId) return;
      this.unsub?.();
      orgId = s?.orgId ?? null;
      if (!s) return;
      this.unsub = repository.observeRecent(s.orgId, (items) => {
        this.latest = items.map((i) => i.observation).filter((o) => o.ownerUid === s.uid);
        void this.kick();
      });
    };
    session.subscribe(onSession);
    onSession();
    connectivity.subscribe(() => void this.kick());
    setInterval(() => void this.kick(), TICK_MS);
  }

  private async kick() {
    if (this.running || !connectivity.value || !session.ready) return;
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) await locks.request('munda-sync', { ifAvailable: true }, async (lock) => { if (lock) await this.process(); });
    else await this.process();
  }

  private due(id: string) {
    const a = this.attempts.get(id);
    return !a || (a.n < MAX_ATTEMPTS && Date.now() >= a.nextAt);
  }

  /** Returns true when attempts are exhausted. */
  private failed(id: string): boolean {
    const n = (this.attempts.get(id)?.n ?? 0) + 1;
    this.attempts.set(id, { n, nextAt: Date.now() + BASE_BACKOFF_MS * 2 ** (n - 1) });
    return n >= MAX_ATTEMPTS;
  }

  private async process() {
    this.running = true;
    try {
      for (const o of this.latest) {
        if (!connectivity.value) return;
        if (o.origin === 'PENDING' && !o.record && !o.recordError && this.due(`record:${o.id}`)) {
          await this.buildRecord(o);
        } else if (o.record && o.reviewStatus === 'NOT_STARTED' && this.due(`review:${o.id}`)) {
          await this.review(o);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async buildRecord(o: Observation) {
    const out = await mundaAi.buildRecord(
      { crop: o.crop, plot: o.plot, stage: o.cropStage, description: o.description, core: o.core, followUps: o.followUps, photoBase64: null },
      'CLOUD',
    );
    if (out.kind === 'done') {
      repository.saveRecord(o.orgId, o.id, out.value, out.origin);
      this.attempts.delete(`record:${o.id}`);
    } else if (out.kind === 'failed' && this.failed(`record:${o.id}`)) {
      repository.saveRecordError(o.orgId, o.id, out.reason);
    } else if (out.kind === 'deferred') {
      this.failed(`record:${o.id}`); // back off; signal dropped mid-call
    }
  }

  private async review(o: Observation) {
    try {
      repository.saveReview(o.orgId, o.id, 'DONE', await reviewObservation(o));
      this.attempts.delete(`review:${o.id}`);
    } catch (e) {
      console.warn('Review failed', o.id, errMsg(e));
      if (this.failed(`review:${o.id}`)) repository.saveReview(o.orgId, o.id, 'FAILED', null);
    }
  }
}

export const syncProcessor = new SyncProcessor();
