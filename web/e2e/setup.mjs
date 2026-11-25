/** Exercise the real first-run controls; returning devices proceed straight to Home. */
export async function completeSetupIfNeeded(page) {
  await page.locator('.setup-shell, .scout-card').first().waitFor({timeout:15000});
  for (let i=0;i<7 && await page.locator('.setup-shell').count();i++) {
    const open=page.getByRole('button',{name:'Open my farm',exact:true});
    const guest=page.getByRole('button',{name:'Continue as guest',exact:true});
    const skip=page.getByRole('button',{name:'Skip for now',exact:true});
    const next=page.getByRole('button',{name:'Continue',exact:true});
    const before = await page.locator('.setup-nav > span').last().textContent();
    if (await open.count()) {await open.click();break;}
    if (await guest.count()) await guest.click();
    else if (await skip.count()) await skip.click();
    else if (await next.count()) await next.click();
    else throw new Error('Setup cannot advance; check authentication or connectivity.');
    await page.waitForFunction((label) => document.querySelector('.setup-nav > span:last-child')?.textContent !== label, before, {timeout:15000});
  }
  await page.getByRole('button',{name:'Check a crop',exact:true}).waitFor({timeout:15000});
}
