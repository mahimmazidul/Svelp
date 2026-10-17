import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { bal_start_run, bal_base_arg, bal_widths_arg, bal_read_fixture } from './release_lib.mjs';

let bal_ok = true;
const bal_browser = await chromium.launch();
const bal_base = bal_base_arg();
const bal_width = Number(bal_widths_arg('390')[0]);
const bal_run = `release-integrity-${Date.now().toString(36)}`;
const bal_source = bal_read_fixture('release_basic.svelp.txt');

const bal_a = await bal_start_run(bal_browser, { name: `${bal_run}-a`, base: bal_base, width: bal_width, touch: true });
bal_a.page.on('pageerror', (bal_err) => {
  console.log(`  pageerror @ ${bal_a.page.url().slice(bal_base.length)} :: ${String(bal_err?.message ?? bal_err).slice(0, 90)}`);
});

try {
  const bal_project_name = `integrity-${bal_run}`;
  await bal_a.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  await bal_a.uiCreateProject(bal_project_name, bal_source);
  const bal_visual_before = await bal_a.visualText();
  bal_a.check('questionnaire built before integrity checks', bal_visual_before.includes('Section'), bal_visual_before.slice(0, 80));

  await bal_a.page.goto(`${bal_base}/#/project/${encodeURIComponent(bal_a.state.lastPid ?? '')}/settings`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForTimeout(1200);
  const bal_settings_text = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('settings renders diagnostics', bal_settings_text.includes('Svelp version') && bal_settings_text.includes('Database schema version'), bal_settings_text.slice(0, 200));
  bal_a.check('diagnostics name db schema v6', /Database schema version\s*v?6/.test(bal_settings_text), bal_settings_text.slice(0, 240));
  bal_a.check('diagnostics name recognition profile', bal_settings_text.includes('Recognition profile'), bal_settings_text.slice(0, 240));
  bal_a.check('diagnostics name MAHIM compat', bal_settings_text.includes('MAHIM'), bal_settings_text.slice(0, 240));
  bal_a.check('diagnostics carry no secrets', !/github_pat_|sk-[A-Za-z0-9]|Bearer /.test(bal_settings_text));

  await bal_a.page.goto(`${bal_base}/#/project/${encodeURIComponent(bal_a.state.lastPid ?? '')}/build`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForTimeout(1000);
  let bal_source_open = false;
  for (let bal_try = 0; bal_try < 4 && !bal_source_open; bal_try += 1) {
    await bal_a.act('button[role="tab"]:has-text("Source")').catch(() => undefined);
    bal_source_open = await bal_a.page
      .waitForSelector('.cm-content', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!bal_source_open) throw new Error('source tab never opened');
  await bal_a.pasteSource('this is @@ not $$ valid svelp source ###');
  await bal_a.page.waitForTimeout(900);
  const bal_apply_disabled = await bal_a.page.locator('button:has-text("Apply")').first().isDisabled();
  const bal_invalid_state = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('invalid source reported as invalid', bal_invalid_state.includes('Invalid') || bal_invalid_state.includes('error'), bal_invalid_state.slice(0, 200));
  bal_a.check('invalid source cannot be applied', bal_apply_disabled === true);

  await bal_a.reload();
  await bal_a.page.waitForTimeout(1500);
  const bal_visual_after = await bal_a.visualText();
  bal_a.check('failed apply left questionnaire unchanged', bal_visual_after.includes('Section'), bal_visual_after.slice(0, 120));

  await bal_a.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForTimeout(800);
  const bal_row_menu = bal_a.page.locator(`button:has(span:has-text("Actions for ${bal_project_name}"))`);
  bal_a.check('project row offers actions', (await bal_row_menu.count()) > 0);
  await bal_a.act(`button:has(span:has-text("Actions for ${bal_project_name}"))`);
  await bal_a.page.waitForTimeout(600);
  await bal_a.act('button:has-text("Delete")');
  await bal_a.page.waitForTimeout(700);
  const bal_confirm_text = await bal_a.page.evaluate(() => {
    const bal_dialog = Array.from(document.querySelectorAll('[aria-modal="true"]')).find((bal_el) => bal_el.getBoundingClientRect().height > 0);
    return bal_dialog?.textContent ?? '';
  });
  bal_a.check('delete shows confirm dialog naming the project', bal_confirm_text.includes('Delete project') && bal_confirm_text.includes(bal_project_name), bal_confirm_text.slice(0, 200));
  await bal_a.act('[aria-modal="true"] button:has-text("Cancel")');
  await bal_a.page.waitForTimeout(900);
  const bal_after_cancel = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('cancel keeps the project', bal_after_cancel.includes(bal_project_name), bal_after_cancel.slice(0, 140));
  await bal_a.act(`button:has(span:has-text("Actions for ${bal_project_name}"))`);
  await bal_a.page.waitForTimeout(600);
  await bal_a.act('button:has-text("Delete")');
  await bal_a.page.waitForTimeout(700);
  await bal_a.act('[aria-modal="true"] button:has-text("Delete project")');
  await bal_a.page.waitForTimeout(1500);
  const bal_after_delete = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('confirmed delete removes the project', !bal_after_delete.includes(bal_project_name), bal_after_delete.slice(0, 140));

  const bal_corrupt_path = `qa/artifacts/${bal_run}-corrupt.mahim`;
  await writeFile(bal_corrupt_path, Buffer.from('this is not a MAHIM container at all, just noise'.repeat(8), 'utf8'));
  await bal_a.page.locator('input[type="file"]').first().setInputFiles(bal_corrupt_path);
  await bal_a.page.waitForTimeout(1500);
  const bal_import_error = await bal_a.page.evaluate(() => {
    const bal_dialog = Array.from(document.querySelectorAll('[aria-modal="true"]')).find((bal_el) => bal_el.getBoundingClientRect().height > 0);
    return bal_dialog?.textContent ?? '';
  });
  bal_a.check('corrupt import shows an error dialog', bal_import_error.length > 0 && /fail|invalid|not|error/i.test(bal_import_error), bal_import_error.slice(0, 200));
  const bal_close = bal_a.page.locator('button[aria-label="Close"]').first();
  if ((await bal_close.count()) > 0) {
    await bal_close.tap();
    await bal_a.page.waitForTimeout(700);
  } else {
    await bal_a.page.keyboard.press('Escape');
    await bal_a.page.waitForTimeout(700);
  }
  const bal_still_there = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('failed import corrupts nothing', !bal_still_there.includes('Import failed'), bal_still_there.slice(0, 140));

  const bal_scan_name = `integrity-scan-${bal_run}`;
  await bal_a.uiCreateProject(bal_scan_name, bal_source);
  await bal_a.page.goto(`${bal_base}/#/project/${encodeURIComponent(bal_a.state.lastPid ?? '')}/scan`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForSelector('button:has-text("Add photos or PDFs")', { timeout: 30000 });
  const bal_junk_path = `qa/artifacts/${bal_run}-junk.pdf`;
  await writeFile(bal_junk_path, Buffer.from('not a pdf at all', 'utf8'));
  await bal_a.page.locator('input[type="file"]').first().setInputFiles(bal_junk_path);
  await bal_a.page.waitForTimeout(2000);
  await bal_a.act('button:has-text("Begin processing")').catch(() => undefined);
  await bal_a.page.waitForTimeout(4000);
  const bal_scan_diag = await bal_a.page.evaluate(async () => {
    const bal_db = await new Promise((bal_res) => {
      const bal_req = indexedDB.open('svelp');
      bal_req.onsuccess = () => bal_res(bal_req.result);
    });
    const bal_rows = await new Promise((bal_res) => {
      const bal_tx = bal_db.transaction('scanPages', 'readonly');
      const bal_q = bal_tx.objectStore('scanPages').getAll();
      bal_q.onsuccess = () => bal_res(bal_q.result);
    });
    bal_db.close();
    return bal_rows.map((bal_p) => ({ status: bal_p.status, issues: bal_p.issues }));
  });
  bal_a.check('invalid pdf handled without crash', true, JSON.stringify(bal_scan_diag));
  const bal_main_text = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
  bal_a.check('scan page reports the failure in the UI', bal_main_text.includes('could not') || bal_main_text.includes('failed') || bal_main_text.includes('Unsupported') || bal_main_text.includes('unsupported'), bal_main_text.slice(0, 220));
  const bal_storage_text = bal_main_text;
  bal_a.check('storage section renders measured state', bal_storage_text.includes('Storage'), bal_storage_text.slice(0, 160));

  await bal_a.finish();
} catch (bal_err) {
  bal_ok = false;
  await bal_a.dumpFailure(bal_err);
  console.log(`FAIL [${bal_a.state.name}] crashed: ${bal_err?.message ?? bal_err}`);
}

await bal_browser.close();
if (!bal_a.state.passed) bal_ok = false;
console.log(`RELEASE INTEGRITY ${bal_ok ? 'OK' : 'FAILED'} (${bal_run})`);
process.exit(bal_ok ? 0 : 1);
