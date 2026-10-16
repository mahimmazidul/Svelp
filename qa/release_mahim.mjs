import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { bal_base_arg, bal_start_run, bal_read_fixture } from './release_lib.mjs';

const BASE = bal_base_arg();
const BAL_RUN = `release-mahim-${Date.now().toString(36)}`;
const BAL_PROJECT = `Mahim Release ${Date.now().toString(36)}`;
const BAL_SOURCE = bal_read_fixture('release_basic.svelp.txt');
const BAL_ART = new URL('./artifacts/', import.meta.url).pathname;

mkdirSync(BAL_ART, { recursive: true });
const BAL_MAHIM_FILE = `${BAL_ART}${BAL_RUN}.mahim`;

let bal_ok = true;
const bal_browser = await chromium.launch();

try {
  const bal_a = await bal_start_run(bal_browser, { name: `${BAL_RUN}-a`, base: BASE, width: 1440 });
  try {
    await bal_a.uiCreateProject(BAL_PROJECT, 'MAHIM transfer source device');
    await bal_a.uiApplySource(BAL_SOURCE);
    await bal_a.page.waitForTimeout(1500);

    await bal_a.page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle' });
    await bal_a.page.waitForSelector('button:has(span:has-text("Actions for"))', { timeout: 20000 });
    await bal_a.act('button:has(span:has-text("Actions for"))');
    await bal_a.page.waitForTimeout(500);
    await bal_a.act('button:has-text("Export for another device")');
    await bal_a.page.waitForSelector('.export-list', { timeout: 20000 });
    const bal_summary = await bal_a.page.locator('.export-list').innerText();
    bal_a.check('export dialog lists questionnaire', /Release Test Survey|questionnaire/i.test(bal_summary), bal_summary.replace(/\s+/g, ' ').slice(0, 100));

    const bal_bytes = await bal_page_download(bal_a, () => bal_a.act('button:has-text("Download file")'));
    bal_a.check('MAHIM file downloads', bal_bytes !== null && bal_bytes.length > 100, `${bal_bytes === null ? 0 : bal_bytes.length} bytes`);
    if (bal_bytes !== null) {
      bal_a.check('MAHIM magic header', bal_bytes.subarray(0, 5).toString('latin1') === 'MAHIM', bal_bytes.subarray(0, 8).toString('latin1'));
      writeFileSync(BAL_MAHIM_FILE, bal_bytes);
    }
  } catch (bal_err) {
    bal_ok = false;
    bal_a.check(`device A crashed: ${String(bal_err).slice(0, 120)}`, false);
    await bal_a.dumpFailure(String(bal_err).slice(0, 120));
  }
  if (!(await bal_a.finish())) bal_ok = false;

  const bal_b = await bal_start_run(bal_browser, { name: `${BAL_RUN}-b`, base: BASE, width: 390, touch: true });
  try {
    await bal_b.page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle' });
    await bal_b.page.waitForSelector('button:has-text("Import")', { timeout: 30000 });

    await bal_import_and_expect_error(bal_b, 'garbage', Buffer.from('this is not a mahim file at all'));
    await bal_import_and_expect_error(bal_b, 'truncated', Buffer.concat([Buffer.from('MAHIM'), Buffer.from('0000')]));
    const bal_real = readFileSync(BAL_MAHIM_FILE);
    const bal_corrupt = Buffer.from(bal_real);
    bal_corrupt[40] = bal_corrupt[40] ^ 0xff;
    await bal_import_and_expect_error(bal_b, 'bitflip', bal_corrupt);

    const bal_projects_before = await bal_b.page.evaluate(async () => {
      const bal_db = await new Promise((bal_res) => {
        const bal_req = indexedDB.open('svelp');
        bal_req.onsuccess = () => bal_res(bal_req.result);
      });
      const bal_rows = await new Promise((bal_res) => {
        const bal_tx = bal_db.transaction('projects', 'readonly');
        const bal_q = bal_tx.objectStore('projects').getAll();
        bal_q.onsuccess = () => bal_res(bal_q.result);
      });
      bal_db.close();
      return bal_rows.length;
    });
    bal_b.check('failed imports left projects untouched', bal_projects_before === 0, `${bal_projects_before} projects`);

    await bal_b.act('button:has-text("Import")');
    await bal_b.page.waitForSelector('input[type="file"]', { timeout: 15000 });
    await bal_b.page.locator('input[type="file"]').first().setInputFiles(BAL_MAHIM_FILE);
    await bal_b.page.waitForSelector('.import-preview', { timeout: 30000 });
    const bal_preview = await bal_b.page.locator('.import-preview').innerText();
    bal_b.check('import preview shows project', bal_preview.includes(BAL_PROJECT), bal_preview.replace(/\s+/g, ' ').slice(0, 100));
    await bal_b.act('.import-actions button:has-text("Import")');
    await bal_b.page.waitForSelector('.import-done, .import-error-title', { timeout: 30000 });
    const bal_done = await bal_b.page.locator('.import-done').count();
    bal_b.check('import completes', bal_done > 0);
    await bal_b.act('.import-actions button:has-text("Done")');
    await bal_b.page.waitForTimeout(1200);

    await bal_b.page.waitForSelector(`text=${BAL_PROJECT}`, { timeout: 20000 });
    bal_b.check('project appears on device B', true);
    await bal_b.act(`text=${BAL_PROJECT}`);
    await bal_b.page.waitForSelector('.mode-switch button[role="tab"]', { timeout: 20000 });
    await bal_b.act('button[role="tab"]:has-text("Source")');
    await bal_b.page.waitForSelector('.cm-content', { timeout: 20000 });
    await bal_b.page.waitForTimeout(800);
    const bal_src_b = await bal_b.copySource();
    bal_b.check('questionnaire identity survives transfer', bal_src_b.includes('Release Test Survey'));
    bal_b.check('variables survive transfer', ['age', 'sex', 'consented', 'food_attitude_1'].every((bal_v) => bal_src_b.includes(bal_v)));
    bal_b.check('scale survives transfer', bal_src_b.includes('scale agreement'));

    await bal_b.reload();
    await bal_b.page.waitForSelector('.save-state', { timeout: 20000 });
    bal_b.check('transferred project persists after reload', true);
  } catch (bal_err) {
    bal_ok = false;
    bal_b.check(`device B crashed: ${String(bal_err).slice(0, 120)}`, false);
    await bal_b.dumpFailure(String(bal_err).slice(0, 120));
  }
  if (!(await bal_b.finish())) bal_ok = false;
} finally {
  await bal_browser.close();
}

console.log(bal_ok ? 'RELEASE MAHIM OK' : 'RELEASE MAHIM FAILED');
process.exit(bal_ok ? 0 : 1);

async function bal_page_download(bal, bal_trigger) {
  try {
    const [bal_download] = await Promise.all([bal.page.waitForEvent('download', { timeout: 60000 }), bal_trigger()]);
    const bal_path = await bal_download.path();
    return readFileSync(bal_path);
  } catch {
    return null;
  }
}

async function bal_import_and_expect_error(bal, bal_label, bal_bytes) {
  const bal_path = `${BAL_ART}${BAL_RUN}-bad-${bal_label}.bin`;
  writeFileSync(bal_path, bal_bytes);
  await bal.act('button:has-text("Import")');
  await bal.page.waitForSelector('input[type="file"]', { timeout: 15000 });
  await bal.page.locator('input[type="file"]').first().setInputFiles(bal_path);
  await bal.page.waitForSelector('.import-error-title, .result-text, .import-preview', { timeout: 30000 });
  const bal_mahim_error = await bal.page.locator('.import-error-title').count();
  const bal_generic_error = await bal.page.locator('.result-text').count();
  bal.check(`corrupt import rejected (${bal_label})`, bal_mahim_error > 0 || bal_generic_error > 0);
  if (bal_mahim_error > 0) {
    const bal_detail = ((await bal.page.locator('.import-error-detail').textContent().catch(() => '')) ?? '').trim();
    bal.check(`error explains failure (${bal_label})`, bal_detail.length > 10, bal_detail.slice(0, 90));
  } else if (bal_generic_error > 0) {
    const bal_detail = ((await bal.page.locator('.result-text').textContent().catch(() => '')) ?? '').trim();
    bal.check(`error explains failure (${bal_label})`, bal_detail.length > 10, bal_detail.slice(0, 90));
  }
  const bal_cancel = bal.page.locator(
    '.import-actions button:has-text("Close"), .import-actions button:has-text("Cancel"), .import-actions button:has-text("Done"), dialog button[aria-label="Close"], button[aria-label="Close"]'
  );
  if ((await bal_cancel.count()) > 0) {
    await bal.cancelFirst(bal_cancel);
  }
  await bal.page.waitForSelector('.import-actions, [role="dialog"]', { state: 'detached', timeout: 8000 }).catch(() => undefined);
  await bal.page.waitForTimeout(500);
}
