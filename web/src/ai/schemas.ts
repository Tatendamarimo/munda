/**
 * Plain JSON Schemas, used twice: as `responseConstraint` for Gemini Nano in Chrome and as
 * `responseJsonSchema` for cloud Gemini. One definition keeps both paths producing the same shape.
 * Kept small: on-device output quality drops with long generations.
 */
import { Likelihood, PatternKind, Urgency } from '../domain/models';

type JsonSchema = Record<string, unknown>;

const str = (description?: string): JsonSchema => (description ? { type: 'string', description } : { type: 'string' });
const arr = (items: JsonSchema, maxItems: number, description?: string): JsonSchema => ({
  type: 'array', items, maxItems, ...(description ? { description } : {}),
});
const enumOf = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });
const obj = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: 'object', properties, required, additionalProperties: false,
});

export const questionsSchema = obj(
  {
    questions: arr(
      obj(
        {
          text: str('A short question a farmer can answer by looking at the plants.'),
          options: arr(str(), 4, '2 to 4 short answer choices'),
        },
        ['text', 'options'],
      ),
      2,
    ),
  },
  ['questions'],
);

const causeSchema = obj(
  {
    guideId: str('Id of the matching guide entry, or "other".'),
    name: str(),
    likelihood: enumOf(Likelihood.values),
    supporting: arr(str(), 3, 'Observations that support this cause'),
    againstOrMissing: arr(str(), 3, 'Observations against it, or information still missing'),
    checkNext: str('One concrete check the farmer can do in the field.'),
  },
  ['guideId', 'name', 'likelihood', 'supporting', 'againstOrMissing', 'checkNext'],
);

export const recordSchema = obj(
  {
    summary: str('One sentence, at most 25 words, describing what was observed.'),
    symptoms: arr(str(), 5),
    possibleCauses: arr(causeSchema, 3),
    urgency: enumOf(Urgency.values),
    uncertaintyNote: str('One sentence: what information would most change this assessment.'),
  },
  ['summary', 'symptoms', 'possibleCauses', 'urgency', 'uncertaintyNote'],
);

export const reviewSchema = obj(
  {
    summary: str("2 sentences max: what the history adds to today's observation."),
    patterns: arr(obj({ kind: enumOf(PatternKind.values), summary: str(), relatedIds: arr(str(), 10) }, ['kind', 'summary', 'relatedIds']), 3),
    updatedCauses: arr(causeSchema, 4),
    nextChecks: arr(str(), 4, 'Most useful first'),
  },
  ['summary', 'patterns', 'updatedCauses', 'nextChecks'],
);
