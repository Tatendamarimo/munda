import { ChevronLeft, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AffectedArea, Crop, CropStage, FindingSource, Onset, PatternKind, Rainfall } from '../domain/models';
import { repository, type ObservationItem } from '../data/repository';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { Badge, CauseEntry, OriginBadge, QueuedBadge, SyncBadge, UncertaintyNote, UrgencyBadge, Working } from './components';
import { back } from './router';

export function DetailPage({ id }: { id: string }) {
  const s = useStore(session);
  const orgId = s.kind === 'ready' ? s.orgId : null;
  const [item, setItem] = useState<ObservationItem | null | undefined>(undefined);
  useEffect(() => (orgId ? repository.observe(orgId, id, setItem) : undefined), [orgId, id]);

  if (item === undefined) return <Working>Loading observation</Working>;
  if (item === null) return <p>This observation isn’t available on this device.</p>;
  const o = item.observation;
  const when = new Date(o.createdAtMillis);

  return (
    <article className="detail">
      <div className="flow-head">
        <button className="btn-icon only-narrow" aria-label="Back" onClick={back}><ChevronLeft size={22} strokeWidth={2.25} /></button>
        <div className="badges">
          {o.record && <UrgencyBadge urgency={o.record.urgency} />}
          <OriginBadge origin={o.origin} />
          <SyncBadge synced={item.synced} />
        </div>
      </div>
      <h1 className="detail-title">{o.plot}</h1>
      <dl className="facts">
        <div><dt>Recorded</dt><dd>{when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</dd></div>
        <div><dt>Crop</dt><dd>{Crop.label(o.crop)}, {CropStage.label(o.cropStage).toLowerCase()}</dd></div>
        <div><dt>Affected</dt><dd>{AffectedArea.label(o.core.area)}</dd></div>
        <div><dt>Rain, last 2 weeks</dt><dd>{Rainfall.label(o.core.rainfall)}</dd></div>
        <div><dt>First noticed</dt><dd>{Onset.label(o.core.onset)}</dd></div>
      </dl>

      {o.record ? (
        <section className="detail-section">
          <p className="result-summary">{o.record.summary}</p>
          <UncertaintyNote text={o.record.uncertaintyNote} />
          <h2>Possible causes</h2>
          <div className="causes">{o.record.possibleCauses.map((c) => <CauseEntry key={c.guideId ?? c.name} cause={c} />)}</div>
        </section>
      ) : (
        <section className="detail-section">
          {o.recordError ? <p className="error">Munda couldn’t write this record: {o.recordError}</p> : <><QueuedBadge /><p>Munda writes the field record when this device is back online.</p></>}
        </section>
      )}

      <section className="detail-section review">
        <h2><History size={20} strokeWidth={2.25} aria-hidden="true" />History review</h2>
        {!o.record ? (
          <p className="muted">Runs after the field record is written.</p>
        ) : o.reviewStatus === 'NOT_STARTED' ? (
          <p className="muted">When you’re online, Munda compares this record with earlier ones from this plot and your other plots.</p>
        ) : o.reviewStatus === 'FAILED' ? (
          <p className="error">The review didn’t complete. Your record is saved.</p>
        ) : o.review ? (
          <>
            <p className="review-summary">{o.review.summary}</p>
            <p className="muted small">Based on {o.review.historyConsidered} earlier {o.review.historyConsidered === 1 ? 'record' : 'records'}.</p>
            {o.review.patterns.length > 0 && (
              <ul className="patterns">
                {o.review.patterns.map((p) => (
                  <li key={p.kind + p.summary}>
                    <div className="badges">
                      <Badge tone="cloud">{PatternKind.label(p.kind)}</Badge>
                      <Badge tone="quiet">{FindingSource.label(p.source)}</Badge>
                    </div>
                    <p>{p.summary}</p>
                  </li>
                ))}
              </ul>
            )}
            {o.review.nextChecks.length > 0 && (
              <>
                <h3>What to check next</h3>
                <ol className="next-checks">{o.review.nextChecks.map((c) => <li key={c}>{c}</li>)}</ol>
              </>
            )}
            {o.review.updatedCauses.length > 0 && (
              <>
                <h3>Possible causes, with history</h3>
                <div className="causes">{o.review.updatedCauses.map((c) => <CauseEntry key={c.guideId ?? c.name} cause={c} />)}</div>
              </>
            )}
          </>
        ) : null}
      </section>

      <section className="detail-section">
        <h2>What was recorded</h2>
        <blockquote className="quote">{o.description}</blockquote>
        {o.followUps.length > 0 && (
          <dl className="qa">{o.followUps.map((f) => <div key={f.question}><dt>{f.question}</dt><dd>{f.answer}</dd></div>)}</dl>
        )}
        {o.hadPhoto && <p className="muted small">A leaf photo was used for this record. Photos aren’t uploaded.</p>}
      </section>
    </article>
  );
}
