import { useEffect, useState } from 'react';
import { repository, type ObservationItem } from '../data/repository';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { demoMode, demoObservations } from '../dev/fixtures';

/** Live list of this org's observations (newest first), shared by every screen. */
export function useObservations(): ObservationItem[] | null {
  const s = useStore(session);
  const orgId = s.kind === 'ready' ? s.orgId : null;
  const [items, setItems] = useState<ObservationItem[] | null>(null);
  const uid = s.kind === 'ready' ? s.uid : null;
  useEffect(() => (orgId ? repository.observeRecent(orgId, setItems) : undefined), [orgId]);
  if (import.meta.env.DEV && demoMode()) return demoObservations();
  // In a group the farm holds every member's checks; a farmer's own screens show only theirs.
  return items && items.filter((i) => i.observation.ownerUid === uid);
}
