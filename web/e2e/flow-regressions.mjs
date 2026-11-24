// Regression checks for the picture-answer flow, against the dev server (npm run dev) with a fake
// Chrome on-device model. No emulators needed: the record is built but never saved.
// Usage: node e2e/flow-regressions.mjs   (BASE_URL defaults to http://localhost:5173)
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const RECORD = JSON.stringify({
  summary: 'Lower leaves yellowing.', symptoms: [],
  possibleCauses: [{ guideId: 'nitrogen', name: 'Nitrogen deficiency', likelihood: 'MEDIUM', supporting: ['Lower leaves yellow'], againstOrMissing: [], checkNext: 'Compare with a top-dressed row.' }],
  urgency: 'SOON', uncertaintyNote: 'Fertilizer timing unknown.',
});

/** Fake Prompt API: no follow-up questions, so onset is the last answer before the record. */
function fakeLanguageModel(r) {
  window.__prompts = [];
  window.LanguageModel = {
    availability: async () => 'available',
    params: async () => ({ defaultTemperature: 1, maxTemperature: 2, defaultTopK: 3, maxTopK: 8 }),
    create: async () => ({
      inputQuota: 9216, inputUsage: 0, measureInputUsage: async () => 100,
      prompt: async (input, popts) => {
        const text = typeof input === 'string' ? input : JSON.stringify(input);
        window.__prompts.push(text);
        await new Promise((res) => setTimeout(res, 100));
        return popts?.responseConstraint?.properties?.questions ? JSON.stringify({ questions: [] }) : r;
      },
      // The record is streamed in small pieces, slowly enough to see the live screen.
      promptStreaming: (input) => {
        window.__prompts.push(typeof input === 'string' ? input : JSON.stringify(input));
        const pieces = r.match(/.{1,12}/gs);
        let i = 0;
        return new ReadableStream({
          async pull(c) {
            await new Promise((res) => setTimeout(res, 60));
            if (i < pieces.length) c.enqueue(pieces[i++]); else c.close();
          },
        });
      },
      destroy() {}, clone: async function () { return this; },
    }),
  };
}

const browser = await chromium.launch({ channel: process.env.CHROME ? undefined : 'chrome', executablePath: process.env.CHROME });
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✔' : '✖'} ${msg}`); };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(fakeLanguageModel, RECORD);
  await ctx.addInitScript(() => localStorage.setItem('munda.lang', 'en'));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('.welcome .btn-main, .action-card', { timeout: 15000 });
  if (await page.locator('.welcome .btn-main').count()) await page.locator('.welcome .btn-main').click();
  await page.getByRole('button', { name: /Check a crop/ }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Check a crop/ }).click();

  await page.getByRole('button', { name: 'Type' }).click();
  await page.getByRole('textbox', { name: 'What do you see?' }).fill('The lower leaves are yellowing from the tip');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Which plot is it?' }).fill('Regression plot');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Patches' }).click();
  await page.getByRole('radio', { name: 'Heavy rain' }).click();
  await page.getByRole('radio', { name: 'This week' }).click();
  await page.getByRole('heading', { name: 'Working it out' }).waitFor({ timeout: 15000 });
  await page.locator('.live-summary').waitFor({ timeout: 15000 });
  check(true, 'live screen shows the summary while the record is streamed');
  await page.getByRole('heading', { name: 'Possible causes' }).waitFor({ timeout: 15000 });
  check(await page.getByRole('heading', { name: 'Nitrogen deficiency' }).count() > 0, 'finished record shows the leading cause');

  const recordPrompt = (await page.evaluate(() => window.__prompts)).find((p) => p.includes('POSSIBLE causes')) ?? '';
  check(recordPrompt.includes('Started: This week'), 'record prompt includes the onset answered last (no follow-ups)');
  check(recordPrompt.includes('Rain in last 2 weeks: Heavy rain'), 'record prompt includes the rain answer');
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
