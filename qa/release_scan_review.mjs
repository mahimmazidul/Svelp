import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { bal_base_arg, bal_start_run, bal_read_fixture } from './release_lib.mjs';

const BASE = bal_base_arg();
const BAL_RUN = `release-scan-${Date.now().toString(36)}`;
const BAL_PROJECT = `Scan Release ${Date.now().toString(36)}`;
const BAL_SOURCE = bal_read_fixture('release_basic.svelp.txt');
const bal_pdf_path = `${new URL('./artifacts/', import.meta.url).pathname}${BAL_RUN}-page1.pdf`;

let bal_ok = true;
let bal_device_pid = '';
let bal_pdf_ok = false;
let bal_mahim_ok = false;
const bal_mahim_path = `${new URL('./artifacts/', import.meta.url).pathname}${BAL_RUN}-template.mahim`;

async function bal_page_download(bal, bal_trigger) {
  try {
    const [bal_download] = await Promise.all([bal.page.waitForEvent('download', { timeout: 60000 }), bal_trigger()]);
    const bal_path = await bal_download.path();
    return readFileSync(bal_path);
  } catch {
    return null;
  }
}

const bal_browser_a = await chromium.launch();
try {
  const bal = await bal_start_run(bal_browser_a, { name: `${BAL_RUN}-a`, base: BASE, width: 390, touch: true });
  try {
    await bal.uiCreateProject(BAL_PROJECT, 'Scan pipeline release validation');
    await bal.uiApplySource(BAL_SOURCE);
    await bal.page.waitForTimeout(1500);

    await bal.gotoArea('print');
    await bal.page.waitForSelector('.page svg', { timeout: 30000 });
    await bal.page.waitForTimeout(2000);

    let bal_settings_open = false;
    for (let bal_try = 0; bal_try < 6 && !bal_settings_open; bal_try += 1) {
      bal_settings_open = await bal.page.evaluate(() => {
        const bal_btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Print settings');
        const bal_sheet_open = Array.from(document.querySelectorAll('[aria-modal="true"]')).some(
          (bal_e) => bal_e.getBoundingClientRect().height > 0 && (bal_e.textContent || '').includes('Print settings')
        );
        if (!bal_sheet_open && bal_btn) bal_btn.click();
        return bal_sheet_open;
      });
      if (!bal_settings_open) {
        bal_settings_open = await bal.page
          .waitForFunction(() => document.querySelectorAll('input[role="switch"]').length > 3, undefined, { timeout: 4000 })
          .then(() => true)
          .catch(() => false);
      }
      if (!bal_settings_open) {
        await bal.page.keyboard.press('Escape');
        await bal.page.waitForTimeout(1000);
      }
    }
    bal.check('print settings sheet opens', bal_settings_open);
    if (bal_settings_open) {
      let bal_preset_done = false;
      for (let bal_try = 0; bal_try < 5 && !bal_preset_done; bal_try += 1) {
        bal_preset_done = await bal.page.evaluate(() => {
          const bal_sheet = Array.from(document.querySelectorAll('[aria-modal="true"]')).find(
            (bal_e) => bal_e.getBoundingClientRect().height > 0 && (bal_e.textContent || '').includes('Print settings')
          );
          if (!bal_sheet) return false;
          const bal_btn = Array.from(bal_sheet.querySelectorAll('button.preset')).find((b) => (b.textContent || '').includes('Clinical A4'));
          if (bal_btn) {
            bal_btn.click();
            return true;
          }
          return false;
        });
        if (bal_preset_done) {
          const bal_scanner_on = await bal.page
            .waitForFunction(
              () => {
                const bal_sw = Array.from(document.querySelectorAll('label')).find((l) => (l.textContent || '').includes('Scanner-readable paper forms'));
                const bal_input = bal_sw ? bal_sw.querySelector('input[role="switch"]') : null;
                return bal_input && bal_input.checked;
              },
              undefined,
              { timeout: 3000 }
            )
            .then(() => true)
            .catch(() => false);
          if (bal_scanner_on) break;
          bal_preset_done = false;
          await bal.page.waitForTimeout(800);
        }
      }
      bal.check('scanner mode enabled for fixture', bal_preset_done);
      await bal.page.keyboard.press('Escape');
      await bal.page.waitForTimeout(1200);
    }
    await bal.page.waitForTimeout(2500);

    await bal.act('button:has-text("Generate batch")');
    await bal.page.waitForSelector('[aria-modal="true"] input[type="number"]', { timeout: 20000 });
    await bal.page.locator('[aria-modal="true"] input[type="number"]:visible').first().fill('2');
    await bal.act('[aria-modal="true"] button:has-text("Generate batch")');
    await bal.page.waitForSelector('button:has-text("Download batch PDF")', { timeout: 60000 });
    await bal.page.waitForTimeout(500);

    const bal_regions = await bal.page.evaluate(async () => {
      const bal_db = await new Promise((bal_res) => {
        const bal_req = indexedDB.open('svelp');
        bal_req.onsuccess = () => bal_res(bal_req.result);
      });
      const bal_rows = await new Promise((bal_res) => {
        const bal_tx = bal_db.transaction('printLayouts', 'readonly');
        const bal_q = bal_tx.objectStore('printLayouts').getAll();
        bal_q.onsuccess = () => bal_res(bal_q.result);
      });
      bal_db.close();
      const bal_layout = bal_rows[bal_rows.length - 1];
      return {
        pageCount: bal_layout.geometry.pageCount,
        regions: bal_layout.geometry.pages.flatMap((bal_p, bal_pi) =>
          bal_p.answerRegions.map((bal_r) => ({ ...bal_r, page: bal_pi + 1 }))
        )
      };
    });
    bal.check('print layout regions available', bal_regions.regions.length >= 10, `${bal_regions.regions.length} regions, ${bal_regions.pageCount} page(s)`);
    bal.check('all fixture content on page 1', bal_regions.regions.every((bal_r) => bal_r.page === 1), `${bal_regions.pageCount} page(s)`);

    const bal_fills = [];
    const bal_choices = bal_regions.regions.filter((bal_r) => bal_r.kind === 'choice' && !bal_r.rowId);
    bal.check('region plan matches fixture', bal_choices.length === 15, `${bal_choices.length} choice cells`);
    const bal_matrix_regions = bal_regions.regions.filter((bal_r) => bal_r.rowId);
    const bal_matrix_rows = [...new Set(bal_matrix_regions.map((bal_r) => bal_r.rowId))];
    bal.check('matrix rows present', bal_matrix_rows.length === 4, `${bal_matrix_rows.length} rows`);
    const bal_push = (bal_region, bal_strength) => {
      if (!bal_region) throw new Error('missing region for mark');
      bal_fills.push({ cx: bal_region.cx, cy: bal_region.cy, w: bal_region.w, h: bal_region.h, strength: bal_strength });
    };
    bal_push(bal_choices[0], 1);
    bal_push(bal_choices[3], 1);
    bal_push(bal_choices[9], 1);
    const bal_row_cells = (bal_row_index) => bal_matrix_regions.filter((bal_r) => bal_r.rowId === bal_matrix_rows[bal_row_index]);
    bal_push(bal_row_cells(0)[3], 1);
    bal_push(bal_row_cells(1)[0], 0.42);
    bal_push(bal_row_cells(2)[3], 1);
    bal_push(bal_row_cells(2)[2], 1);
    bal.check('mark plan covers accept ambiguous and multi cases', bal_fills.length === 7, `${bal_fills.length} marks planned`);

    const bal_pdf_bytes = await bal_page_download(bal, () => bal.act('button:has-text("Download batch PDF")'));
    bal.check(
      'batch pdf generated for fixture',
      bal_pdf_bytes !== null && bal_pdf_bytes.length > 4000 && bal_pdf_bytes.subarray(0, 5).toString('latin1') === '%PDF-',
      `${bal_pdf_bytes === null ? 0 : bal_pdf_bytes.length} bytes`
    );
    bal_device_pid = bal.state.lastPid ?? '';
    bal.check('project id captured for device B', Boolean(bal_device_pid), bal_device_pid);
    if (bal_pdf_bytes !== null) {
      writeFileSync(bal_pdf_path, bal_pdf_bytes);
      bal_pdf_ok = true;
    }

    await bal.page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle' });
    await bal.page.waitForSelector('button:has(span:has-text("Actions for"))', { timeout: 20000 });
    await bal.act('button:has(span:has-text("Actions for"))');
    await bal.page.waitForTimeout(500);
    await bal.act('button:has-text("Export for another device")');
    await bal.page.waitForSelector('.export-list', { timeout: 20000 });
    const bal_mahim_bytes = await bal_page_download(bal, () => bal.act('button:has-text("Download file")'));
    bal.check('MAHIM template file downloads', bal_mahim_bytes !== null && bal_mahim_bytes.subarray(0, 5).toString('latin1') === 'MAHIM', `${bal_mahim_bytes === null ? 0 : bal_mahim_bytes.length} bytes`);
    if (bal_mahim_bytes !== null) {
      writeFileSync(bal_mahim_path, bal_mahim_bytes);
      bal_mahim_ok = true;
    }
  } catch (bal_err) {
    bal_ok = false;
    bal.check(`device A crashed: ${String(bal_err).slice(0, 120)}`, false);
    await bal.dumpFailure(String(bal_err).slice(0, 120));
  }
  if (!(await bal.finish())) bal_ok = false;
} finally {
  await bal_browser_a.close();
}

const bal_browser_b = await chromium.launch();
try {
  const bal = await bal_start_run(bal_browser_b, { name: `${BAL_RUN}-b`, base: BASE, width: 390, touch: true });
  try {
    bal.check('device A handed over project, pdf and template', Boolean(bal_device_pid) && bal_pdf_ok && bal_mahim_ok, `pid=${bal_device_pid} pdf=${bal_pdf_ok} mahim=${bal_mahim_ok}`);

    await bal.page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle' });
    await bal.page.waitForSelector('button:has-text("Import")', { timeout: 30000 });
    await bal.act('button:has-text("Import")');
    await bal.page.waitForSelector('input[type="file"]', { timeout: 15000 });
    await bal.page.locator('input[type="file"]').first().setInputFiles(bal_mahim_path);
    await bal.page.waitForSelector('.import-preview', { timeout: 30000 });
    await bal.act('.import-actions button:has-text("Import")');
    await bal.page.waitForSelector('.import-done, .import-error-title', { timeout: 30000 });
    bal.check('MAHIM template imported on device B', (await bal.page.locator('.import-done').count()) > 0);
    await bal.act('.import-actions button:has-text("Done")');
    await bal.page.waitForTimeout(1000);

    const bal_clean1 = await bal_render_pdf_png(bal_browser_b, bal_pdf_path, 1, false);
    bal.check('crisp capture rendered', bal_clean1.length > 50000, `${bal_clean1.length} b64 chars`);
    const bal_dup1 = await bal_render_pdf_png(bal_browser_b, bal_pdf_path, 1, true);
    const bal_blur2 = await bal_render_pdf_png(bal_browser_b, bal_pdf_path, 2, true);
    bal.check('second respondent capture rendered', bal_blur2.length > 50000, `${bal_blur2.length} b64 chars`);
    const bal_art = new URL('./artifacts/', import.meta.url).pathname;
    const bal_captures = [
      [`${bal_art}${BAL_RUN}-capture.png`, bal_clean1],
      [`${bal_art}${BAL_RUN}-dup.png`, bal_dup1],
      [`${bal_art}${BAL_RUN}-blur2.png`, bal_blur2]
    ];
    for (const [bal_path, bal_b64] of bal_captures) writeFileSync(bal_path, Buffer.from(bal_b64, 'base64'));

    await bal.page.goto(`${BASE}/#/project/${encodeURIComponent(bal_device_pid)}/scan`, { waitUntil: 'networkidle' });
    await bal.page.waitForSelector('button:has-text("Add photos or PDFs")', { timeout: 30000 });
    await bal.page.locator('input[type="file"]').first().setInputFiles(bal_captures.map(([bal_path]) => bal_path));
    await bal.page.waitForTimeout(2500);
    const bal_stage_diag = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 500));
    bal.check('three captures staged in scan UI', /Begin processing \(3\)/.test(bal_stage_diag), bal_stage_diag.slice(0, 300));

    await bal.act('button:has-text("Begin processing")');
    const bal_scan_diag = await bal_page_scan_diag(bal, 3);
    bal.check('batch processed three captures', bal_scan_diag.total >= 3, JSON.stringify(bal_scan_diag));
    bal.check('crisp capture became ready', bal_scan_diag.ready >= 1, JSON.stringify(bal_scan_diag));
    const bal_pages_diag = await bal_page_rows_diag(bal);
    bal.check('page identified with respondent', bal_pages_diag.some((bal_p) => bal_p.status === 'ready' && bal_p.respondentId !== null && !bal_p.issues.includes('template-missing')), JSON.stringify(bal_pages_diag));
    const bal_001 = bal_pages_diag.filter((bal_p) => bal_p.respondentId === '001');
    bal.check('same-sheet recaptures flagged duplicate', bal_001.length === 2 && bal_001.every((bal_p) => !bal_p.ready && bal_p.issues.includes('duplicate')), JSON.stringify(bal_001));
    bal.check('other-respondent page stays processable', bal_pages_diag.some((bal_p) => bal_p.respondentId === '002' && (bal_p.ready || bal_p.issues.length > 0)), JSON.stringify(bal_pages_diag));

    await bal.act('.page-card:has-text("capture.png") button:has-text("Compare")');
    await bal.page.waitForSelector('[aria-modal="true"] button:has-text("Keep A")', { timeout: 20000 });
    await bal.act('[aria-modal="true"] button:has-text("Keep A")');
    await bal.page.waitForTimeout(1500);
    const bal_after_keep = await bal_page_rows_diag(bal);
    bal.check('duplicate resolution keeps one page', bal_after_keep.filter((bal_p) => bal_p.respondentId === '001' && bal_p.ready).length >= 1, JSON.stringify(bal_after_keep));
    const bal_quality = await bal.page.evaluate(async () => {
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
      return bal_rows.map((bal_p) => bal_p.quality);
    });
    bal.check('quality metrics recorded', true, JSON.stringify(bal_quality).slice(0, 300));

    await bal.page.goto(`${BASE}/#/project/${encodeURIComponent(bal_device_pid)}/responses`, { waitUntil: 'networkidle' });
    await bal.page.waitForTimeout(1200);
    await bal.page.waitForSelector('button.tab:has-text("Review queue")', { timeout: 30000 });
    await bal.act('button:has-text("Read answers")');
    await bal.page.waitForTimeout(800);
    await bal.act('button:has-text("Read answers")').catch(() => undefined);
    await bal.page
      .waitForFunction(
        () => {
          const bal_btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Read answers');
          return bal_btn && !bal_btn.disabled;
        },
        undefined,
        { timeout: 120000 }
      )
      .catch(() => undefined);
    await bal.page.waitForTimeout(1500);
    const bal_queue_head = ((await bal.page.locator('button.tab:has-text("Review queue")').textContent()) ?? '').trim();
    bal.check('review queue has entries', /\(\d+\)/.test(bal_queue_head), bal_queue_head);
    const bal_queue_text = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
    bal.check('review names a respondent', /Respondent\s+\S+/.test(bal_queue_text), bal_queue_text.slice(0, 160));

    let bal_choice_done = false;
    let bal_sheet_crop = false;
    const bal_open_buttons = bal.page.locator('.queue-card button:has-text("Open")');
    for (let bal_i = 0; bal_i < Math.min(6, await bal_open_buttons.count()); bal_i += 1) {
      await bal_open_buttons.nth(bal_i).tap();
      await bal.page.waitForTimeout(900);
      if (!bal_sheet_crop) {
        bal_sheet_crop = await bal.page.evaluate(() => document.querySelectorAll('.cell-sheet img, [class*=sheet] img, [role=dialog] img').length > 0);
      }
      const bal_choice = bal.page.locator('.choice:visible').first();
      if ((await bal_choice.count()) > 0) {
        await bal_choice.tap();
        await bal.page.waitForTimeout(900);
        bal_choice_done = await bal.page.evaluate(() => document.querySelectorAll('.choice.selected').length > 0);
        if (bal_choice_done) {
          await bal.page.keyboard.press('Escape');
          await bal.page.waitForTimeout(700);
          break;
        }
      }
      await bal.page.keyboard.press('Escape');
      await bal.page.waitForTimeout(700);
    }
    bal.check('cell sheet shows source crop', bal_sheet_crop);
    bal.check('cell sheet offers choices and accepts a correction', bal_choice_done);

    await bal.act('button.tab:has-text("Data table")');
    await bal.page.waitForTimeout(1200);
    const bal_table_text = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '));
    bal.check('data table shows variables', ['age', 'sex', 'consented'].some((bal_v) => bal_table_text.includes(bal_v)), bal_table_text.slice(0, 400));
    bal.check('data table shows respondent row', /Respondent\s*1|R1|001/.test(bal_table_text), bal_table_text.slice(0, 120));

    const bal_search = bal.page.locator('input[type="search"]').first();
    if ((await bal_search.count()) > 0) {
      await bal_search.fill('food');
      await bal.page.waitForTimeout(700);
      const bal_filtered = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? ''));
      bal.check('table search filters', bal_filtered.length < 4000 || bal_filtered.includes('food'));
      await bal_search.fill('');
      await bal.page.waitForTimeout(500);
    }

    await bal.page.goto(`${BASE}/#/project/${encodeURIComponent(bal_device_pid)}/export`, { waitUntil: 'networkidle' });
    await bal.page.waitForSelector('button:has-text("Responses CSV")', { timeout: 30000 });
    const bal_warn = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').includes('Review before exporting'));
    bal.check('export warns on unresolved cells', bal_warn);
    if (bal_warn) {
      await bal.act('button:has-text("Export anyway")');
      await bal.page.waitForTimeout(600);
    }
    const bal_exports = {};
    for (const bal_button of ['Responses CSV', 'Responses JSON', 'Diagnostics CSV', 'Audit CSV']) {
      const bal_btn = bal.page.locator(`button:has-text("${bal_button}")`).first();
      if ((await bal_btn.count()) > 0 && !(await bal_btn.isDisabled().catch(() => true))) {
        const bal_bytes = await bal_page_download(bal, () => bal_btn.tap());
        bal_exports[bal_button] = bal_bytes;
        bal.check(`export ${bal_button} downloads`, bal_bytes !== null && bal_bytes.length > 0, `${bal_bytes === null ? 0 : bal_bytes.length} bytes`);
      } else {
        bal.check(`export ${bal_button} available`, false, 'missing or disabled');
      }
    }
    const bal_csv_text = bal_exports['Responses CSV'] !== null && bal_exports['Responses CSV'] !== undefined ? bal_exports['Responses CSV'].toString('utf8') : '';
    const bal_csv_rows = bal_csv_text.length > 0 ? bal_csv_text.split(/\r?\n/).filter((bal_r) => bal_r.trim().length > 0) : [];
    bal.check('csv has header row', bal_csv_rows.length >= 2, `${bal_csv_rows.length} rows`);
    bal.check('csv header names variables', bal_csv_rows.length > 0 && ['age', 'sex', 'consented'].some((bal_v) => bal_csv_rows[0].includes(bal_v)), bal_csv_rows[0]?.slice(0, 200) ?? '');
    bal.check('csv carries respondent 001 row', bal_csv_rows.some((bal_r) => bal_r.startsWith('"001"') || bal_r.startsWith('001,')), bal_csv_rows.slice(1).map((bal_r) => bal_r.slice(0, 40)).join(' | '));
    const bal_001_row = bal_csv_rows.find((bal_r) => bal_r.startsWith('001,') || bal_r.startsWith('"001"'));
    bal.check('csv row 001 carries read values', bal_001_row !== undefined && bal_001_row.split(',').slice(1).some((bal_c) => bal_c.trim().length > 0), bal_001_row?.slice(0, 80) ?? 'missing');
    let bal_json_ok = false;
    try {
      const bal_json = JSON.parse(bal_exports['Responses JSON'].toString('utf8'));
      bal_json_ok = Array.isArray(bal_json) ? bal_json.length >= 1 : Object.keys(bal_json).length > 0;
    } catch {
      bal_json_ok = false;
    }
    bal.check('json export parses', bal_json_ok);

    await bal.reload();
    await bal.page.goto(`${BASE}/#/project/${encodeURIComponent(bal_device_pid)}/responses`, { waitUntil: 'networkidle' });
    await bal.page.waitForSelector('button.tab:has-text("Review queue")', { timeout: 30000 });
    await bal.page.waitForTimeout(1200);
    const bal_after = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? ''));
    bal.check('review state persists after reload', bal_after.length > 100 && !bal_after.includes('Nothing to review'));
  } catch (bal_err) {
    bal_ok = false;
    bal.check(`device B crashed: ${String(bal_err).slice(0, 120)}`, false);
    await bal.dumpFailure(String(bal_err).slice(0, 120));
  }
  if (!(await bal.finish())) bal_ok = false;
} finally {
  await bal_browser_b.close();
}

console.log(bal_ok ? 'RELEASE SCAN OK' : 'RELEASE SCAN FAILED');
process.exit(bal_ok ? 0 : 1);

async function bal_render_pdf_png(bal_browser, bal_pdf_file, bal_page_number = 1, bal_blur = false) {
  const bal_page = await (await bal_browser.newContext({ viewport: { width: 500, height: 500 } })).newPage();
  try {
    await bal_page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    return await bal_page.evaluate(async ([bal_b64, bal_chunk_name, bal_worker_name, bal_page_number, bal_blur_arg]) => {
      const bal_pdfjs = await import('/assets/' + bal_chunk_name);
      bal_pdfjs.GlobalWorkerOptions.workerSrc = '/assets/' + bal_worker_name;
      const bal_bytes = Uint8Array.from(atob(bal_b64), (bal_c) => bal_c.charCodeAt(0));
      const bal_doc = await bal_pdfjs.getDocument({ data: bal_bytes }).promise;
      const bal_p = await bal_doc.getPage(bal_page_number);
      const bal_vp = bal_p.getViewport({ scale: 1240 / bal_p.getViewport({ scale: 1 }).width });
      const bal_canvas = document.createElement('canvas');
      bal_canvas.width = Math.round(bal_vp.width);
      bal_canvas.height = Math.round(bal_vp.height);
      const bal_ctx = bal_canvas.getContext('2d');
      if (bal_blur_arg) bal_ctx.filter = 'blur(2.5px)';
      await bal_p.render({ canvasContext: bal_ctx, viewport: bal_vp }).promise;
      const bal_img = bal_ctx.getImageData(0, 0, bal_canvas.width, bal_canvas.height);
      const bal_d = bal_img.data;
      for (let bal_i = 0; bal_i < bal_d.length; bal_i += 4) {
        const bal_n = (Math.random() - 0.5) * 22;
        const bal_x = ((bal_i >> 2) % bal_canvas.width) / bal_canvas.width;
        const bal_y = ((bal_i >> 2) / bal_canvas.width | 0) / bal_canvas.height;
        const bal_vig = 1 - 0.06 * Math.hypot(bal_x - 0.5, bal_y - 0.5);
        bal_d[bal_i] = Math.max(0, Math.min(255, bal_d[bal_i] * bal_vig + bal_n - 6));
        bal_d[bal_i + 1] = Math.max(0, Math.min(255, bal_d[bal_i + 1] * bal_vig + bal_n - 6));
        bal_d[bal_i + 2] = Math.max(0, Math.min(255, bal_d[bal_i + 2] * bal_vig + bal_n - 6));
      }
      bal_ctx.putImageData(bal_img, 0, 0);
      return bal_canvas.toDataURL('image/png').split(',')[1];
    }, [readFileSync(bal_pdf_file).toString('base64'), 'pdf-D4X9PViX.js', 'pdf.worker.min-C8PGFc0r.mjs', bal_page_number, bal_blur]);
  } finally {
    await bal_page.context().close();
  }
}

async function bal_page_scan_diag(bal, bal_expected = 1) {
  const bal_deadline = Date.now() + 60000;
  let bal_diag = { total: 0, ready: 0, review: 0, failed: 0, queued: 0, statuses: [] };
  while (Date.now() < bal_deadline) {
    bal_diag = await bal_diag_once(bal);
    if (bal_diag.total >= bal_expected && bal_diag.queued === 0) return bal_diag;
    await bal.page.waitForTimeout(2000);
  }
  return bal_diag;
}

async function bal_diag_once(bal) {
  return bal.page.evaluate(async () => {
    const bal_db = await new Promise((bal_res) => {
      const bal_req = indexedDB.open('svelp');
      bal_req.onsuccess = () => bal_res(bal_req.result);
    });
    const bal_all = (bal_store) =>
      new Promise((bal_res) => {
        const bal_tx = bal_db.transaction(bal_store, 'readonly');
        const bal_q = bal_tx.objectStore(bal_store).getAll();
        bal_q.onsuccess = () => bal_res(bal_q.result);
      });
    const bal_pages = await bal_all('scanPages');
    bal_db.close();
    const bal_counts = { total: bal_pages.length, ready: 0, review: 0, failed: 0, queued: 0, statuses: [] };
    for (const bal_p of bal_pages) {
      if (bal_p.status === 'ready') bal_counts.ready += 1;
      else if (bal_p.status === 'needs-review') bal_counts.review += 1;
      else if (bal_p.status === 'failed') bal_counts.failed += 1;
      else if (bal_p.status === 'duplicate' || bal_p.status === 'unsupported') bal_counts.failed += 1;
      else bal_counts.queued += 1;
      bal_counts.statuses.push(String(bal_p.status));
    }
    return bal_counts;
  });
}

async function bal_page_rows_diag(bal) {
  return bal.page.evaluate(async () => {
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
    return bal_rows.map((bal_p) => ({
      respondentId: bal_p.respondentId,
      pageNumber: bal_p.pageNumber,
      status: bal_p.status,
      issues: bal_p.issues,
      ready: bal_p.status === 'ready'
    }));
  });
}

async function bal_page_issue_diag(bal, bal_index = 0) {
  return bal.page.evaluate(async (bal_index) => {
    const bal_db = await new Promise((bal_res) => {
      const bal_req = indexedDB.open('svelp');
      bal_req.onsuccess = () => bal_res(bal_req.result);
    });
    const bal_all = (bal_store) =>
      new Promise((bal_res) => {
        const bal_tx = bal_db.transaction(bal_store, 'readonly');
        const bal_q = bal_tx.objectStore(bal_store).getAll();
        bal_q.onsuccess = () => bal_res(bal_q.result);
      });
    const bal_pages = await bal_all('scanPages');
    const bal_responses = await bal_all('responses');
    bal_db.close();
    const bal_p = bal_pages[bal_index] ?? bal_pages[0];
    return {
      issues: bal_p?.issues ?? [],
      errorMessage: bal_p?.errorMessage ?? null,
      identity: bal_p?.identitySource ?? null,
      responses: bal_responses.length,
      respondent: bal_p?.respondentId ?? null,
      ready: bal_p?.status === 'ready'
    };
  }, bal_index);
}
