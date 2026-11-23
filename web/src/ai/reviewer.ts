import { getGenerativeModel, InferenceMode, type GenerativeModel } from 'firebase/ai';
import { guideFor } from '../domain/guide';
import { evaluateHistory, mergePatterns } from '../domain/historyRules';
import type { HistoryReview, Observation } from '../domain/models';
import { parseReview, type ReviewParts } from '../domain/parser';
import { firebase } from '../data/firebase';
import { repository } from '../data/repository';
import { settings } from '../data/settings';
import { reviewPrompt } from './prompts';
import { language } from '../i18n';
import { reviewSchema } from './schemas';

const DAY = 86_400_000;
let model: GenerativeModel | null = null;

/**
 * Runs when connected. Deliberately cloud-only: it needs Firestore history plus the full guide,
 * beyond Nano's context, and isn't time-critical. Deterministic rules run first; the cloud model
 * adds revised likelihoods and prioritised next checks. Throws on infrastructure failure so the
 * sync processor retries. Mirrors HistoryReviewer.kt on Android.
 */
export async function reviewObservation(target: Observation): Promise<HistoryReview> {
  const since = target.createdAtMillis - settings.historyLookbackDays * DAY;
  const [plotHistory, farmHistory] = await Promise.all([
    repository.historyForPlot(target.orgId, target.plotKey, since),
    repository.recentOnFarm(target.orgId, since),
  ]);
  const rules = evaluateHistory(target, plotHistory, farmHistory, settings.thresholds);
  const history = [...new Map([...plotHistory, ...farmHistory].filter((o) => o.id !== target.id && o.crop === target.crop).map((o) => [o.id, o])).values()];

  let ai: ReviewParts | null = null;
  if (settings.aiReviewEnabled && target.record) {
    try {
      model ??= getGenerativeModel(firebase().ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: settings.reviewModel,
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: reviewSchema, temperature: 0.1 },
        },
      });
      const res = await model.generateContent(reviewPrompt(target, plotHistory, farmHistory, rules.map((r) => r.kind), language.value), { timeout: 60_000 });
      const parsed = parseReview(res.response.text(), new Set(history.map((o) => o.id)), guideFor(target.crop));
      if (parsed.ok) ai = parsed.value;
      else console.warn('Unparseable review', parsed.error);
    } catch (e) {
      // Rule findings are still valuable; don't lose them because the model call failed.
      console.warn('AI review failed; keeping rule findings', e);
    }
  }

  const fallbackSummary =
    history.length === 0
      ? "This is the first record for this plot, so there's no history to compare yet."
      : rules.length
        ? `Compared with ${history.length} earlier record(s); see the patterns below.`
        : `Compared with ${history.length} earlier record(s); no clear pattern yet.`;

  return {
    summary: ai?.summary || fallbackSummary,
    patterns: mergePatterns(rules, ai?.patterns ?? []),
    updatedCauses: ai?.updatedCauses ?? [],
    nextChecks: ai?.nextChecks.length ? ai.nextChecks : (target.record?.possibleCauses.map((c) => c.checkNext) ?? []),
    reviewedAtMillis: Date.now(),
    historyConsidered: history.length,
  };
}
