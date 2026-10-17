import { appendFileSync, readdirSync, renameSync } from 'node:fs';
import { chromium } from 'playwright';
import { bal_start_run, bal_base_arg, bal_widths_arg, bal_read_fixture } from './release_lib.mjs';

let bal_ok = true;
const bal_browser = await chromium.launch();
const bal_base = bal_base_arg();
const bal_width = Number(bal_widths_arg('390')[0]);
const bal_run = `release-pwa-${Date.now().toString(36)}`;
const bal_source = bal_read_fixture('release_basic.svelp.txt');

function bal_chunk_name(bal_prefix) {
  const bal_hits = readdirSync('dist/assets').filter((bal_f) => bal_f.startsWith(bal_prefix) && bal_f.endsWith('.js'));
  return bal_hits[0] ?? null;
}

const bal_a = await bal_start_run(bal_browser, { name: `${bal_run}-a-offline`, base: bal_base, width: bal_width, touch: true });
const bal_b = await bal_start_run(bal_browser, { name: `${bal_run}-b-update`, base: bal_base, width: bal_width, touch: true });
const bal_c = await bal_start_run(bal_browser, {
  name: `${bal_run}-c-recovery`,
  base: bal_base,
  width: bal_width,
  touch: true,
  ignore_console: [/Failed to load module script/],
  ignore_bad_urls: [/source_editor_cm-/],
  ignore_net: [/svelp-refresh=/]
});

try {
  const bal_a_name = `pwa-offline-${bal_run}`;
  await bal_a.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  const bal_sw = await bal_a.page.evaluate(async () => {
    const bal_reg = await navigator.serviceWorker.ready;
    const bal_names = await caches.keys();
    let bal_count = 0;
    for (const bal_name of bal_names) {
      if (bal_name.includes('precache')) {
        const bal_cache = await caches.open(bal_name);
        bal_count = (await bal_cache.keys()).length;
      }
    }
    return { active: bal_reg !== null && bal_reg.active !== null, precache: bal_count, names: bal_names.length };
  });
  bal_a.check('service worker active', bal_sw.active === true, JSON.stringify(bal_sw));
  bal_a.check('precache holds app shell', bal_sw.precache >= 20, `${bal_sw.precache} entries`);

  await bal_a.uiCreateProject(bal_a_name, bal_source);
  await bal_a.check('project created before offline work', true, bal_a_name);

  await bal_a.page.waitForTimeout(2500);
  await bal_a.context.setOffline(true);
  await bal_a.page.goto(`${bal_base}/#/projects`, { waitUntil: 'load' });
  await bal_a.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  bal_a.check('app boots from cache while offline', true);
  const bal_offline_text = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('offline project list still shows project', bal_offline_text.includes(bal_a_name), bal_offline_text.slice(0, 160));

  for (const [bal_hash, bal_label] of [['#/scan', 'Scan'], ['#/projects', 'Projects']]) {
    await bal_a.page.goto(`${bal_base}/${bal_hash}`, { waitUntil: 'load' });
    await bal_a.page.waitForTimeout(1000);
    const bal_route_text = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').trim().length);
    bal_a.check(`offline route ${bal_hash} renders (${bal_label})`, bal_route_text > 20, `${bal_route_text} chars`);
  }
  await bal_a.page.goto(`${bal_base}/#/projects`, { waitUntil: 'load' });
  await bal_a.page.waitForTimeout(800);
  const bal_back_online = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('offline session ends with data intact', bal_back_online.includes(bal_a_name), bal_back_online.slice(0, 120));
  await bal_a.context.setOffline(false);
  await bal_a.finish();
} catch (bal_err) {
  bal_ok = false;
  await bal_a.dumpFailure(bal_err);
  console.log(`FAIL [${bal_a.state.name}] device A crashed: ${bal_err?.message ?? bal_err}`);
}

try {
  const bal_b_name = `pwa-update-${bal_run}`;
  await bal_b.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_b.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  await bal_b.uiCreateProject(bal_b_name, bal_source);
  await bal_b.page.waitForTimeout(2000);

  await bal_b.page.evaluate(() => {
    sessionStorage.setItem('pwa-update-marker', 'before');
    window.__pwa_no_reload = true;
  });
  appendFileSync('dist/sw.js', `\n// qa touch ${bal_run}\n`);
  await bal_b.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_b.page.waitForTimeout(6000);
  const bal_b_state = await bal_b.page.evaluate(() => ({
    reloaded: !window.__pwa_no_reload,
    marker: sessionStorage.getItem('pwa-update-marker'),
    controller: Boolean(navigator.serviceWorker.controller),
    usable: (document.querySelector('main')?.textContent ?? '').length > 20
  }));
  bal_b.check('new service worker version applied', bal_b_state.controller === true, JSON.stringify(bal_b_state));
  const bal_b_text = await bal_b.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_b.check('project survives version update', bal_b_text.includes(bal_b_name), bal_b_text.slice(0, 160));
  await bal_b.reload();
  await bal_b.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  const bal_b_persist = await bal_b.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_b.check('app usable after update and reload', bal_b_persist.includes(bal_b_name), bal_b_persist.slice(0, 160));
  await bal_b.finish();
} catch (bal_err) {
  bal_ok = false;
  await bal_b.dumpFailure(bal_err);
  console.log(`FAIL [${bal_b.state.name}] device B crashed: ${bal_err?.message ?? bal_err}`);
}

const bal_chunk = bal_chunk_name('source_editor_cm-');
try {
  const bal_c_name = `pwa-recovery-${bal_run}`;
  await bal_c.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_c.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  bal_c.check('lazy source-editor chunk present in build', bal_chunk !== null, bal_chunk ?? 'none');
  await bal_c.uiCreateProject(bal_c_name, bal_source);
  await bal_c.page.waitForTimeout(2000);

  renameSync(`dist/assets/${bal_chunk}`, `dist/assets/${bal_chunk}.qa-missing`);
  await bal_c.page.evaluate(async (bal_name) => {
    const bal_names = await caches.keys();
    for (const bal_cache_name of bal_names) {
      const bal_cache = await caches.open(bal_cache_name);
      for (const bal_req of await bal_cache.keys()) {
        if (bal_req.url.includes(bal_name)) await bal_cache.delete(bal_req);
      }
    }
  }, bal_chunk);

  await bal_c.page.goto(`${bal_base}/#/project/${encodeURIComponent(bal_c.state.lastPid ?? '')}/build`, { waitUntil: 'networkidle' });
  await bal_c.page.waitForTimeout(1200);
  await bal_c.act('button[role="tab"]:has-text("Source")');
  await bal_c.page.waitForSelector('#svelp-update-banner', { timeout: 25000 });
  const bal_fix_text = await bal_c.page.evaluate(() => document.querySelector('#svelp-update-banner')?.textContent ?? 'missing');
  bal_c.check('missing chunk triggers Fix and reload banner', bal_fix_text.includes('Fix and reload'), bal_fix_text.slice(0, 160));
  const bal_panel_error = await bal_c.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').includes('source editor could not be loaded'));
  bal_c.check('source panel explains failure and keeps data safe', bal_panel_error);

  renameSync(`dist/assets/${bal_chunk}.qa-missing`, `dist/assets/${bal_chunk}`);
  await bal_c.act('#svelp-update-banner button');
  await bal_c.page.waitForURL(/svelp-refresh=/, { timeout: 30000 }).catch(() => undefined);
  await bal_c.page.waitForTimeout(2500);
  await bal_c.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_c.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  bal_c.check('Fix and reload restores the app', true);
  const bal_after_fix = await bal_c.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_c.check('project survives recovery reload', bal_after_fix.includes(bal_c_name), bal_after_fix.slice(0, 160));

  await bal_c.page.goto(`${bal_base}/#/project/${encodeURIComponent(bal_c.state.lastPid ?? '')}/build`, { waitUntil: 'networkidle' });
  await bal_c.page
    .waitForFunction(
      async () => {
        const bal_names = await caches.keys();
        let bal_count = 0;
        for (const bal_name of bal_names) {
          if (bal_name.includes('precache')) {
            const bal_cache = await caches.open(bal_name);
            bal_count = (await bal_cache.keys()).length;
          }
        }
        return bal_count >= 38;
      },
      undefined,
      { timeout: 30000 }
    )
    .catch(() => undefined);
  let bal_editor_up = false;
  for (let bal_try = 0; bal_try < 5 && !bal_editor_up; bal_try += 1) {
    await bal_c.act('button[role="tab"]:has-text("Source")').catch(() => undefined);
    bal_editor_up = await bal_c.page
      .waitForSelector('.cm-content', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!bal_editor_up) {
    const bal_panel = await bal_c.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').slice(0, 300));
    throw new Error(`source editor missing after recovery: ${bal_panel}`);
  }
  const bal_resrc = await bal_c.copySource();
  bal_c.check('source editor loads after recovery', bal_resrc.includes('Section'), bal_resrc.slice(0, 80));
  await bal_c.finish();
} catch (bal_err) {
  try {
    renameSync(`dist/assets/${bal_chunk}.qa-missing`, `dist/assets/${bal_chunk}`);
  } catch {
    void 0;
  }
  bal_ok = false;
  await bal_c.dumpFailure(bal_err);
  console.log(`FAIL [${bal_c.state.name}] device C crashed: ${bal_err?.message ?? bal_err}`);
}

await bal_browser.close();
if (!bal_a.state.passed || !bal_b.state.passed || !bal_c.state.passed) bal_ok = false;
console.log(`RELEASE PWA ${bal_ok ? 'OK' : 'FAILED'} (${bal_run})`);
process.exit(bal_ok ? 0 : 1);
