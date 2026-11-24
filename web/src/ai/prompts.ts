import { guideFor, type GuideEntry } from '../domain/guide';
import { LANGS, type Lang } from '../i18n/langs';
import type { CoreAnswers, Crop, CropStage, Observation, PatternKind, QA } from '../domain/models';
import { AffectedArea, Crop as CropL, CropStage as StageL, Onset, Rainfall } from '../domain/models';

/** Everything the farmer told us for one observation. */
export interface ObservationInput {
  crop: Crop;
  plot: string;
  stage: CropStage;
  description: string;
  core: CoreAnswers;
  followUps: QA[];
  /** Downscaled JPEG, base64 without the data: prefix. */
  photoBase64: string | null;
}

export const retrievalText = (i: ObservationInput) => `${i.description} ${i.followUps.map((f) => `${f.question} ${f.answer}`).join(' ')}`;

const cropName = (c: Crop) => CropL.label(c).toLowerCase();

/**
 * Cloud-only: asks for the farmer's language. On-device prompts never get this line (Gemini Nano
 * here is English-only), and the guide-backed names and checks are translated by the app instead.
 */
const languageLines = (lang?: Lang): string[] =>
  lang && lang !== 'en' ? [`Write all text values in ${LANGS[lang].english}. Keep JSON keys, ids and enum values in English.`] : [];
const entryLine = (e: GuideEntry) => `id=${e.id} | ${e.name} | signs: ${e.signs} | tells apart: ${e.distinguish} | check: ${e.checkInField}`;

/** Prompts mirror Prompts.kt on Android and are sized for Gemini Nano's small context. */
export function questionsPrompt(i: ObservationInput, candidates: GuideEntry[], outputLang?: Lang): string {
  return [
    `You help a ${cropName(i.crop)} farmer narrow down what might be wrong in their field.`,
    'Ask at most 2 short, simple questions whose answers best tell apart the possible causes below.',
    'Each question must be answerable by looking at the plants or the soil. Give 2-4 short answer choices.',
    'Do NOT ask how much of the field is affected, about rainfall, or when it started; those are already answered.',
    '',
    `Crop stage: ${StageL.label(i.stage)}`,
    `Farmer says: ${i.description.trim()}`,
    ...(i.photoBase64 ? ['(A photo of the plant is attached.)'] : []),
    '',
    'Possible causes and how they differ:',
    ...candidates.map((e) => `- ${e.name}: ${e.distinguish}`),
    ...languageLines(outputLang),
    'Respond with JSON only.',
  ].join('\n');
}

function observationBlock(i: ObservationInput): string[] {
  return [
    'OBSERVATION',
    `Plot: ${i.plot}. Crop: ${cropName(i.crop)}, stage ${StageL.label(i.stage)}.`,
    `Farmer says: ${i.description.trim()}`,
    `How much is affected: ${AffectedArea.label(i.core.area)}. Rain in last 2 weeks: ${Rainfall.label(i.core.rainfall)}. Started: ${Onset.label(i.core.onset)}.`,
    ...i.followUps.map((f) => `Q: ${f.question} A: ${f.answer}`),
    ...(i.photoBase64 ? ['A photo is attached; treat it as supporting evidence only.'] : []),
  ];
}

export function recordPrompt(i: ObservationInput, candidates: GuideEntry[], outputLang?: Lang): string {
  return [
    `You help a ${cropName(i.crop)} farmer record a field observation. You do NOT diagnose.`,
    'List up to 3 POSSIBLE causes, most likely first, using only the guide entries below (or "other").',
    'Rules:',
    '- likelihood HIGH only if at least 2 observations support it and nothing contradicts it. Otherwise MEDIUM or LOW.',
    '- supporting: only things the farmer actually said or the photo clearly shows.',
    "- againstOrMissing: a fact that contradicts it, or a fact we still don't know (e.g. \"not said whether lower leaves are worse\"). Never a check or an action; those go in checkNext.",
    '- If the farmer reports heavy rain or flooding, weigh waterlogging and nitrogen loss by leaching seriously.',
    '- checkNext: something the farmer can check with their eyes or hands. No product names or doses.',
    '- urgency: URGENT only for a pest or disease that can spread fast, or risk to most of the field; ROUTINE if minor.',
    '- Use short, plain words.',
    '',
    'GUIDE',
    ...candidates.map(entryLine),
    '',
    ...observationBlock(i),
    ...languageLines(outputLang),
    'Respond with JSON only.',
  ].join('\n');
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function obsLine(o: Observation): string {
  const base = `id=${o.id} | ${day(o.createdAtMillis)} | plot=${o.plot} | stage=${o.cropStage} | area=${o.core.area} | rain=${o.core.rainfall} | onset=${o.core.onset} | "${o.description.slice(0, 300)}"`;
  return o.record ? `${base} | causes: ${o.record.possibleCauses.map((c) => `${c.guideId ?? c.name}=${c.likelihood}`).join('; ')}` : base;
}

export function reviewPrompt(target: Observation, plotHistory: Observation[], farmHistory: Observation[], ruleKinds: PatternKind[], outputLang?: Lang): string {
  const prior = plotHistory.filter((o) => o.id !== target.id);
  const others = farmHistory.filter((o) => o.id !== target.id && o.plotKey !== target.plotKey);
  return [
    `You are an agronomy assistant reviewing a ${cropName(target.crop)} farmer's field records. You do NOT diagnose.`,
    "Using the history, update the possible causes for TODAY's observation and suggest what to check next.",
    'Same likelihood rules: HIGH only with 2+ supporting observations and no contradiction. Keep uncertainty visible.',
    'Only describe patterns that the records below support, and cite record ids in relatedIds.',
    'No product names or doses. If the situation may need an expert (e.g. suspected virus or lethal necrosis), say to contact an extension officer.',
    ...(ruleKinds.length ? [`Patterns already found by rules (do not repeat): ${ruleKinds.join(', ')}.`] : []),
    '',
    'GUIDE',
    ...guideFor(target.crop).entries.map(entryLine),
    '',
    'TODAY',
    obsLine(target),
    ...target.followUps.map((f) => `  Q: ${f.question} A: ${f.answer}`),
    '',
    'SAME PLOT, EARLIER (newest first)',
    ...(prior.length ? prior.map(obsLine) : ['none']),
    '',
    'OTHER PLOTS, RECENT (newest first)',
    ...(others.length ? others.map(obsLine) : ['none']),
    ...languageLines(outputLang),
  ].join('\n');
}
