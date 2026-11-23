import { describe, expect, it } from 'vitest';
import { nextStep, prevStep, stepsFor } from '../src/ui/observe/steps';

describe('observation steps', () => {
  it('includes AI follow-ups only when there are some', () => {
    expect(stepsFor(true)).toEqual(['describe', 'plot', 'area', 'rain', 'onset', 'followups', 'result']);
    expect(stepsFor(false)).not.toContain('followups');
  });
  it('moves forward and back', () => {
    expect(nextStep('describe', false)).toBe('plot');
    expect(nextStep('onset', false)).toBe('result');
    expect(nextStep('onset', true)).toBe('followups');
    expect(nextStep('result', true)).toBeNull();
    expect(prevStep('result', false)).toBe('onset');
    expect(prevStep('describe', true)).toBeNull();
  });
});
