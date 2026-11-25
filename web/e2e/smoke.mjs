// End-to-end smoke test: real UI + real Firestore/Auth emulators + security rules, with a fake
// Chrome on-device model so the on-device path (responseConstraint, inferenceSource) is exercised.
// Cloud AI can't be emulated, so the queued-record path is checked up to "waiting for signal".
//
// Prereqs: emulators on 9099/8080 (see npm run e2e) and the dev server on 5173 with
// VITE_USE_EMULATORS=true. Usage: node e2e/smoke.mjs [screenshotDir]
import { chromium } from 'playwright-core';
import { completeSetupIfNeeded } from './setup.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const OUT = process.argv[2] ?? 'e2e/screenshots';
mkdirSync(OUT, { recursive: true });

const QUESTIONS = JSON.stringify({
  questions: [{ text: 'Are the yellow leaves at the bottom or the top of the plant?', options: ['Bottom', 'Top', 'Both'] }],
});
const RECORD = JSON.stringify({
  summary: 'Lower leaves yellowing from the tip in patches after heavy rain; plants small.',
  symptoms: ['yellow lower leaves', 'V-shaped yellowing', 'stunting'],
  possibleCauses: [
    { guideId: 'nitrogen', name: 'Nitrogen deficiency', likelihood: 'HIGH', supporting: ['Lower leaves yellow first', 'Yellowing from the tip down the middle'], againstOrMissing: ['No fertilizer record yet'], checkNext: 'Compare with a row that was top-dressed.' },
    { guideId: 'waterlogging', name: 'Waterlogging', likelihood: 'HIGH', supporting: ['Heavy rain in the last two weeks'], againstOrMissing: ['Not only in low spots'], checkNext: 'Dig up one plant and check roots for brown rot.' },
  ],
  urgency: 'SOON',
  uncertaintyNote: 'Knowing when fertilizer was last applied would change this most.',
});

/** Fake Chrome Prompt API: records prompts and answers by schema shape. */
function fakeLanguageModel({ q, r }) {
  window.__prompts = [];
  window.LanguageModel = {
    availability: async () => 'available',
    params: async () => ({ defaultTemperature: 1, maxTemperature: 2, defaultTopK: 3, maxTopK: 8 }),
    create: async (opts) => ({
      inputQuota: 9216, inputUsage: 0,
      measureInputUsage: async () => 100,
      prompt: async (input, popts) => {
        window.__prompts.push({ input, constraint: popts?.responseConstraint, opts });
        await new Promise((res) => setTimeout(res, 150));
        return popts?.responseConstraint?.properties?.questions ? q : r;
      },
      promptStreaming: () => { throw new Error('not used'); },
      destroy() {},
      clone: async function () { return this; },
    }),
  };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✔' : '✖'} ${msg}`); };

try {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(fakeLanguageModel, { q: QUESTIONS, r: RECORD });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE);
  await page.locator('.setup-shell').waitFor();
  await page.screenshot({ path: `${OUT}/0-welcome.png`, fullPage: true });
  await completeSetupIfNeeded(page);
  await page.getByText('Offline AI ready').waitFor({ timeout: 15000 });
  check(true, 'activation signs in (Auth emulator) and detects on-device AI');
  await page.screenshot({ path: `${OUT}/1-home.png` });

  // ----- On-device flow, while "offline" -----
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByLabel('No signal').waitFor();
  await page.getByRole('button', { name: /New observation/ }).click();
  await page.getByLabel('Plot').fill('River plot');
  await page.getByRole('radio', { name: 'Early growth' }).click();
  await page.getByLabel('What you see').fill('The lower leaves are yellowing from the tip down the middle and the plants are small');
  check(await page.getByText('Runs on this device. Private, and works without signal.').isVisible(), 'route note says on-device before tapping');
  await page.screenshot({ path: `${OUT}/2-describe.png` });
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByText('Munda also asks').waitFor({ timeout: 10000 });
  await page.getByRole('radio', { name: 'Patches' }).click();
  await page.getByRole('radio', { name: 'Heavy rain' }).click();
  await page.getByRole('radio', { name: 'This week' }).click();
  await page.getByRole('radio', { name: 'Bottom' }).click();
  check(await page.getByText('On this device').first().isVisible(), 'follow-up questions generated on-device');
  await page.screenshot({ path: `${OUT}/3-questions.png`, fullPage: true });
  await page.getByRole('button', { name: 'Show possible causes' }).click();

  await page.getByText('Nitrogen deficiency').waitFor({ timeout: 10000 });
  const likely = await page.getByText('Likely', { exact: true }).count();
  check(likely === 1, `exactly one "Likely" cause enforced in code (got ${likely})`);
  check(await page.getByText('Possible', { exact: true }).count() === 1, 'second cause downgraded to "Possible" (one supporting sign only)');
  check(await page.locator('.cause-check').count() === 2, 'every cause has a check');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/4-result.png`, fullPage: true });

  const prompts = await page.evaluate(() => window.__prompts);
  check(prompts.length === 2, `two single-turn on-device prompts (got ${prompts.length})`);
  check(Boolean(prompts[1]?.constraint?.properties?.possibleCauses), 'JSON schema passed to Nano as responseConstraint');
  const recPrompt = JSON.stringify(prompts[1]?.input ?? '');
  check(recPrompt.includes('id=nitrogen') && recPrompt.includes('id=waterlogging'), 'retrieved guide entries included in on-device prompt');
  check(recPrompt.includes('Are the yellow leaves at the bottom'), 'follow-up answers included in record prompt');

  await page.getByRole('button', { name: 'Save field record' }).click();
  await page.getByRole('heading', { name: 'River plot' }).waitFor();
  check(page.url().includes('#/o/'), 'saving opens the saved record');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Synced').first().waitFor({ timeout: 10000 });
  check(true, 'observation accepted by Firestore security rules (synced)');
  // The rule-based history review still completes when cloud AI is unavailable (as here).
  await page.getByText(/Based on \d+ earlier/).waitFor({ timeout: 20000 });
  check(true, 'history review completes from rules even when cloud AI is unavailable');
  await page.waitForTimeout(1500); // let queued writes reach the emulator before storage is cloned below
  await page.screenshot({ path: `${OUT}/5-detail.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('heading', { name: 'Observations' }).waitFor();
  await page.screenshot({ path: `${OUT}/6-list.png` });

  // ----- Desktop workspace (the MacBook demo layout) -----
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: await ctx.storageState({ indexedDB: true }) });
  await desk.addInitScript(fakeLanguageModel, { q: QUESTIONS, r: RECORD });
  const d = await desk.newPage();
  await d.goto(BASE);
  await d.getByRole('heading', { name: /Pick an observation/ }).waitFor({ timeout: 15000 });
  check(await d.getByRole('complementary', { name: 'Observations' }).isVisible(), 'desktop shows two-pane workspace');
  await d.screenshot({ path: `${OUT}/d1-workspace.png` });
  await d.getByRole('link', { name: /River plot/ }).first().click();
  await d.getByRole('heading', { name: 'River plot' }).waitFor();
  await d.screenshot({ path: `${OUT}/d2-detail.png` });
  await desk.close();
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fresh.addInitScript(fakeLanguageModel, { q: QUESTIONS, r: RECORD });
  const w = await fresh.newPage();
  await w.goto(BASE);
  await w.locator('.setup-shell').waitFor();
  await w.waitForTimeout(900);
  await w.screenshot({ path: `${OUT}/d0-welcome.png` });
  await fresh.close();

  // ----- No local model + no signal: save and queue -----
  // Firebase Auth persists in IndexedDB, so carry it over; hide any built-in model to simulate
  // a device without on-device AI (e.g. a phone browser).
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, storageState: await ctx.storageState({ indexedDB: true }) });
  await ctx2.addInitScript(() => { Object.defineProperty(window, 'LanguageModel', { value: undefined, configurable: true }); });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE);
  await p2.getByText('Cloud AI only').waitFor({ timeout: 15000 });
  await p2.evaluate(() => window.dispatchEvent(new Event('offline')));
  await p2.getByRole('button', { name: /New observation/ }).click();
  await p2.getByLabel('Plot').fill('Hill plot');
  await p2.getByLabel('What you see').fill('Ragged holes in the leaves and sawdust in the funnel');
  await p2.getByRole('button', { name: 'Continue' }).click();
  await p2.getByRole('button', { name: 'Continue' }).click();
  await p2.getByRole('button', { name: 'Save for later' }).click();
  await p2.getByText('Finishes when online').first().waitFor();
  check(true, 'no model + no signal: observation saved and queued');
  await p2.screenshot({ path: `${OUT}/7-queued.png` });

  await page.waitForTimeout(8000); // let any duplicate-send check finish before judging errors
  const unexpected = errors.filter((e) => !/App Check|appCheck|FIREBASE_APPCHECK|reCAPTCHA|AI Logic|generativelanguage|firebasevertexai|net::ERR|Failed to load resource|Cloud call failed|Remote Config|remote-config/i.test(e));
  check(unexpected.length === 0, `no unexpected page errors${unexpected.length ? `: ${unexpected.slice(0, 3).join(' | ')}` : ''}`);
} catch (e) {
  failures.push(String(e));
  console.error(e);
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures.length ? 1 : 0);
