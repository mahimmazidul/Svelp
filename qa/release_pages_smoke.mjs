import { chromium } from 'playwright';
import { bal_start_run, bal_base_arg, bal_widths_arg, bal_read_fixture } from './release_lib.mjs';

let bal_ok = true;
const bal_browser = await chromium.launch();
const bal_base = bal_base_arg();
const bal_widths = bal_widths_arg('360,390,1440');
const bal_run = `release-pages-${Date.now().toString(36)}`;
const bal_source = bal_read_fixture('release_basic.svelp.txt');

const bal_global_routes = [
  ['#/projects', 'Projects'],
  ['#/scan', 'Scan']
];
const bal_project_areas = ['build', 'print', 'preview', 'responses', 'export', 'scan', 'settings'];

for (const bal_width of bal_widths) {
  const bal_touch = bal_width < 800;
  const bal_r = await bal_start_run(bal_browser, { name: `${bal_run}-${bal_width}`, base: bal_base, width: bal_width, touch: bal_touch });
  try {
    await bal_r.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
    await bal_r.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
    await bal_r.uiCreateProject(`pages-smoke-${bal_width}-${bal_run}`, bal_source);
    const bal_pid = bal_r.state.lastPid ?? '';
    bal_r.check(`project created for route smoke at ${bal_width}`, bal_pid.length > 0, bal_pid);

    for (const [bal_hash, bal_label] of bal_global_routes) {
      await bal_r.page.goto(`${bal_base}/${bal_hash}`, { waitUntil: 'networkidle' });
      await bal_r.page.waitForTimeout(1000);
      const bal_text = await bal_r.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').trim());
      const bal_stuck = await bal_r.page.evaluate(() => {
        const bal_spin = Array.from(document.querySelectorAll('main *')).filter(
          (bal_el) => (bal_el.textContent ?? '').trim() === 'Loading…' && bal_el.children.length === 0
        );
        return bal_spin.length > 0;
      });
      bal_r.check(`route ${bal_hash} renders at ${bal_width} (${bal_label})`, bal_text.length > 20 && !bal_stuck, `${bal_text.length} chars, stuck=${bal_stuck}`);
    }

    for (const bal_area of bal_project_areas) {
      await bal_r.page.goto(`${bal_base}/#/project/${encodeURIComponent(bal_pid)}/${bal_area}`, { waitUntil: 'networkidle' });
      if (bal_area === 'print') {
        await bal_r.page
          .waitForFunction(() => /(\d+) page/.test(document.querySelector('main')?.textContent ?? ''), undefined, { timeout: 30000 })
          .catch(() => undefined);
      }
      if (bal_area === 'responses') {
        await bal_r.page
          .waitForFunction(() => (document.querySelector('main')?.textContent ?? '').includes('Review queue'), undefined, { timeout: 30000 })
          .catch(() => undefined);
      }
      await bal_r.page.waitForTimeout(1200);
      const bal_text = await bal_r.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').trim());
      bal_r.check(`route project/${bal_area} renders at ${bal_width}`, bal_text.length > 20, `${bal_text.length} chars :: ${bal_text.slice(0, 60)}`);
      if (bal_area === 'print') {
        const bal_pages = await bal_r.page.evaluate(() => /(\d+) page/.test(document.querySelector('main')?.textContent ?? ''));
        bal_r.check(`print preview paginates at ${bal_width}`, bal_pages);
      }
      if (bal_area === 'responses') {
        const bal_tabs = await bal_r.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').includes('Review queue') && (document.querySelector('main')?.textContent ?? '').includes('Data table'));
        bal_r.check(`responses areas present at ${bal_width}`, bal_tabs);
      }
    }
    await bal_r.finish();
  } catch (bal_err) {
    bal_ok = false;
    await bal_r.dumpFailure(bal_err);
    console.log(`FAIL [${bal_r.state.name}] crashed: ${bal_err?.message ?? bal_err}`);
  }
  if (!bal_r.state.passed) bal_ok = false;
}

await bal_browser.close();
console.log(`RELEASE PAGES ${bal_ok ? 'OK' : 'FAILED'} (${bal_run})`);
process.exit(bal_ok ? 0 : 1);
