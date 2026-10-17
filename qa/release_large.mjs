import { chromium } from 'playwright';
import { bal_start_run, bal_base_arg, bal_widths_arg, bal_read_fixture } from './release_lib.mjs';

let bal_ok = true;
const bal_browser = await chromium.launch();
const bal_base = bal_base_arg();
const bal_width = Number(bal_widths_arg('390')[0]);
const bal_run = `release-large-${Date.now().toString(36)}`;
const bal_large_source = bal_read_fixture('release_large.svelp.txt');
const bal_basic_source = bal_read_fixture('release_basic.svelp.txt');

const bal_a = await bal_start_run(bal_browser, { name: `${bal_run}-a-large`, base: bal_base, width: bal_width, touch: true });
const bal_b = await bal_start_run(bal_browser, { name: `${bal_run}-b-batch`, base: bal_base, width: bal_width, touch: true });

try {
  const bal_large_name = `large-${bal_run}`;
  await bal_a.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_a.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });

  const bal_apply_started = Date.now();
  await bal_a.uiCreateProject(bal_large_name, bal_large_source);
  const bal_apply_ms = Date.now() - bal_apply_started;
  bal_a.check('large source applied and saved', true, `${bal_apply_ms} ms`);
  bal_a.check('large apply finishes in under 90 seconds', bal_apply_ms < 90000, `${bal_apply_ms} ms`);

  await bal_a.page.waitForTimeout(1500);
  let bal_clip = '';
  for (let bal_try = 0; bal_try < 4 && !bal_clip.includes('foods60'); bal_try += 1) {
    await bal_a.act('button[role="tab"]:has-text("Source")').catch(() => undefined);
    await bal_a.page.waitForSelector('.cm-content', { timeout: 20000 }).catch(() => undefined);
    await bal_a.page.locator('.cm-content').first().click().catch(() => undefined);
    await bal_a.page.keyboard.press('Control+a').catch(() => undefined);
    await bal_a.page.evaluate(async (bal_src) => {
      const bal_dt = new DataTransfer();
      bal_dt.setData('text/plain', bal_src);
      document.querySelector('.cm-content')?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: bal_dt, bubbles: true, cancelable: true }));
    }, bal_large_source);
    await bal_a.page.waitForTimeout(1200);
    await bal_a.act('button:has-text("Apply")').catch(async () => {
      await bal_a.page.evaluate(() => {
        const bal_btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Apply');
        bal_btn?.click();
      });
    });
    await bal_a.page.waitForTimeout(2000);
    await bal_a.page.evaluate(() => {
      const bal_btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Copy');
      bal_btn?.click();
    });
    await bal_a.page.waitForTimeout(900);
    bal_clip = await bal_a.page.evaluate(() => navigator.clipboard.readText());
  }
  bal_a.check('applied questionnaire round-trips with 60-row matrix', bal_clip.includes('foods60') && bal_clip.includes('rice "Rice"'), `${bal_clip.length} chars, ${bal_clip.slice(0, 80)}`);
  bal_a.check('full large source survives round-trip', bal_clip.length >= bal_large_source.length && bal_clip.includes('foods60'), `${bal_clip.length} of ${bal_large_source.length} chars`);

  const bal_switch_started = Date.now();
  await bal_a.act('button[role="tab"]:has-text("Visual")');
  await bal_a.page.waitForTimeout(200);
  const bal_visual_ok = (await bal_a.visualText()).length > 100;
  const bal_switch_ms = Date.now() - bal_switch_started;
  bal_a.check('editor stays responsive at large size', bal_visual_ok && bal_switch_ms < 15000, `${bal_switch_ms} ms`);

  await bal_a.gotoArea('print');
  const bal_open_settings = async () => {
    for (let bal_try = 0; bal_try < 6; bal_try += 1) {
      await bal_a.act('button[aria-label="Print settings"]').catch(async () => {
        await bal_a.page.evaluate(() => {
          const bal_btn = document.querySelector('button[aria-label="Print settings"]');
          bal_btn?.click();
        });
      });
      const bal_opened = await bal_a.page
        .waitForSelector('[aria-modal="true"] .preset', { timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      if (bal_opened) return;
      await bal_a.page.keyboard.press('Escape').catch(() => undefined);
      await bal_a.page.waitForTimeout(900);
    }
    throw new Error('print settings sheet never opened');
  };
  const bal_pick_preset = async (bal_label) => {
    await bal_open_settings();
    await bal_a.page.evaluate((bal_text) => {
      const bal_sheet = Array.from(document.querySelectorAll('[aria-modal="true"]')).find((bal_el) => bal_el.getBoundingClientRect().height > 0);
      const bal_btn = Array.from(bal_sheet.querySelectorAll('button.preset')).find((b) => (b.textContent || '').includes(bal_text));
      bal_btn?.click();
    }, bal_label);
    await bal_a.page.waitForTimeout(1200);
    await bal_a.page.keyboard.press('Escape');
    await bal_a.page.waitForTimeout(1500);
  };
  const bal_read_pages = async () =>
    bal_a.page.evaluate(() => {
      const bal_match = (document.querySelector('main')?.textContent ?? '').match(/(\d+) page/);
      return bal_match ? Number(bal_match[1]) : 0;
    });
  await bal_pick_preset('Compact A4');
  const bal_compact_pages = await bal_read_pages();
  bal_a.check('compact preview paginates the large questionnaire', bal_compact_pages >= 2, `${bal_compact_pages} pages`);

  await bal_pick_preset('Clinical A4');
  const bal_clinical_pages = await bal_read_pages();
  bal_a.check('clinical preset repaginates within a bounded range', bal_clinical_pages >= 2 && bal_clinical_pages <= bal_compact_pages + 30, `${bal_clinical_pages} pages vs compact ${bal_compact_pages}`);

  await bal_a.reload();
  await bal_a.page.waitForTimeout(1500);
  const bal_still = await bal_a.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').slice(0, 100));
  bal_a.check('large project state persists', bal_still.length > 20, bal_still);
  await bal_a.finish();
} catch (bal_err) {
  bal_ok = false;
  await bal_a.dumpFailure(bal_err);
  console.log(`FAIL [${bal_a.state.name}] crashed: ${bal_err?.message ?? bal_err}`);
}

try {
  const bal_batch_name = `batch-${bal_run}`;
  await bal_b.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_b.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  await bal_b.uiCreateProject(bal_batch_name, bal_basic_source);

  await bal_b.gotoArea('print');
  const bal_open_batch = async () => {
    for (let bal_try = 0; bal_try < 6; bal_try += 1) {
      await bal_b.act('button:has-text("Generate batch")').catch(async () => {
        await bal_b.page.evaluate(() => {
          const bal_btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Generate batch'));
          bal_btn?.click();
        });
      });
      const bal_opened = await bal_b.page
        .waitForSelector('[aria-modal="true"] input[type="number"]', { timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      if (bal_opened) return;
      await bal_b.page.keyboard.press('Escape').catch(() => undefined);
      await bal_b.page.waitForTimeout(900);
    }
    throw new Error('batch sheet never opened');
  };
  await bal_open_batch();
  await bal_b.page.locator('[aria-modal="true"] input[type="number"]:visible').first().fill('1000');
  let bal_generation_up = false;
  for (let bal_try = 0; bal_try < 6 && !bal_generation_up; bal_try += 1) {
    await bal_b.act('[aria-modal="true"] button:has-text("Generate batch")').catch(async () => {
      await bal_b.page.evaluate(() => {
        const bal_sheet = Array.from(document.querySelectorAll('[aria-modal="true"]')).find((b) => b.getBoundingClientRect().height > 0);
        const bal_btn = Array.from(bal_sheet.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Generate batch');
        bal_btn?.click();
      });
    });
    for (let bal_poll = 0; bal_poll < 10 && !bal_generation_up; bal_poll += 1) {
      const bal_text = await bal_b.page.evaluate(() => (document.querySelector('[aria-modal="true"]')?.textContent ?? ''));
      if (/Generated \d+ of 1000/.test(bal_text) || bal_text.includes('Batch saved')) bal_generation_up = true;
      else await bal_b.page.waitForTimeout(300);
    }
  }
  bal_b.check('1000-copy generation starts', bal_generation_up);
  await bal_b.page.waitForSelector('text=Batch saved', { timeout: 180000 });
  bal_b.check('1000-respondent batch completes and saves', true);
  const bal_scale_rows = await bal_b.page.evaluate(async () => {
    const bal_db = await new Promise((bal_res) => {
      const bal_req = indexedDB.open('svelp');
      bal_req.onsuccess = () => bal_res(bal_req.result);
    });
    const bal_rows = await new Promise((bal_res) => {
      const bal_tx = bal_db.transaction('printBatches', 'readonly');
      const bal_q = bal_tx.objectStore('printBatches').getAll();
      bal_q.onsuccess = () => bal_res(bal_q.result);
    });
    bal_db.close();
    return bal_rows.map((bal_r) => bal_r.respondentIds.length);
  });
  bal_b.check('completed batch holds all 1000 respondents', bal_scale_rows.some((bal_n) => bal_n === 1000), JSON.stringify(bal_scale_rows));

  await bal_b.act('[aria-modal="true"] button:has-text("Close")').catch(async () => {
    await bal_b.page.keyboard.press('Escape');
  });
  await bal_b.page.waitForTimeout(900);

  const bal_cancel_name = `large-cancel-${bal_run}`;
  await bal_b.page.goto(`${bal_base}/#/projects`, { waitUntil: 'networkidle' });
  await bal_b.page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
  await bal_b.uiCreateProject(bal_cancel_name, bal_large_source);
  await bal_b.gotoArea('print');
  await bal_open_batch();
  await bal_b.page.locator('[aria-modal="true"] input[type="number"]:visible').first().fill('1000');
  let bal_stop_outcome = 'none';
  let bal_progress_text = '';
  for (let bal_try = 0; bal_try < 3 && bal_stop_outcome !== 'clicked'; bal_try += 1) {
    if (bal_try > 0) {
      await bal_b.act('[aria-modal="true"] button:has-text("Close")').catch(async () => {
        await bal_b.page.keyboard.press('Escape');
      });
      await bal_b.page.waitForTimeout(900);
      await bal_open_batch();
      await bal_b.page.locator('[aria-modal="true"] input[type="number"]:visible').first().fill('1000');
    }
    await bal_b.act('[aria-modal="true"] button:has-text("Generate batch")').catch(async () => {
      await bal_b.page.evaluate(() => {
        const bal_sheet = Array.from(document.querySelectorAll('[aria-modal="true"]')).find((b) => b.getBoundingClientRect().height > 0);
        const bal_btn = Array.from(bal_sheet.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Generate batch');
        bal_btn?.click();
      });
    });
    const bal_watch = await bal_b.page.evaluate(
      async () =>
        await new Promise((bal_resolve) => {
          const bal_started = Date.now();
          let bal_last_progress = '';
          const bal_timer = setInterval(() => {
            const bal_text = document.querySelector('[aria-modal="true"]')?.textContent ?? '';
            const bal_flat = bal_text.replace(/\s+/g, ' ');
            if (/Generated \d+ of 1000/.test(bal_flat)) bal_last_progress = bal_flat.slice(0, 1200);
            if (/Generated \d+ of 1000/.test(bal_flat)) {
              const bal_stop = Array.from(document.querySelectorAll('[aria-modal="true"] button')).find((b) => (b.textContent || '').trim() === 'Stop');
              clearInterval(bal_timer);
              if (bal_stop) {
                bal_stop.click();
                bal_resolve({ outcome: 'clicked', text: bal_last_progress });
              } else {
                bal_resolve({ outcome: 'no-stop', text: bal_last_progress });
              }
              return;
            }
            if (bal_text.includes('Batch saved') || Date.now() - bal_started > 240000) {
              clearInterval(bal_timer);
              bal_resolve({ outcome: 'finished', text: bal_last_progress });
            }
          }, 40);
        })
    );
    bal_stop_outcome = bal_watch.outcome;
    bal_progress_text = bal_watch.text;
  }
  bal_b.check('stop clicked mid-generation', bal_stop_outcome === 'clicked', `${bal_stop_outcome} :: ${bal_progress_text.slice(0, 120)}`);
  bal_b.check('batch reports live progress', /Generated \d+ of 1000/.test(bal_progress_text), bal_progress_text.slice(0, 200));
  bal_b.check('batch shows eta estimate', bal_progress_text.includes('left'), bal_progress_text.slice(0, 200));
  let bal_cancelled = false;
  for (let bal_poll = 0; bal_poll < 60 && !bal_cancelled; bal_poll += 1) {
    const bal_text = await bal_b.page.evaluate(() => (document.querySelector('[aria-modal="true"]')?.textContent ?? ''));
    if (bal_text.includes('Batch cancelled')) bal_cancelled = true;
    else await bal_b.page.waitForTimeout(1000);
  }
  bal_b.check('cancel stops the batch cleanly', bal_cancelled);
  const bal_batches_after_cancel = await bal_b.page.evaluate(async () => {
    const bal_db = await new Promise((bal_res) => {
      const bal_req = indexedDB.open('svelp');
      bal_req.onsuccess = () => bal_res(bal_req.result);
    });
    const bal_rows = await new Promise((bal_res) => {
      const bal_tx = bal_db.transaction('printBatches', 'readonly');
      const bal_q = bal_tx.objectStore('printBatches').getAll();
      bal_q.onsuccess = () => bal_res(bal_q.result);
    });
    bal_db.close();
    return bal_rows.map((bal_r) => bal_r.respondentIds.length);
  });
  bal_b.check('cancelled batch leaves no partial batch records', bal_batches_after_cancel.length === 1 && bal_batches_after_cancel[0] === 1000, JSON.stringify(bal_batches_after_cancel));

  await bal_b.act('[aria-modal="true"] button:has-text("Close")').catch(async () => {
    await bal_b.page.keyboard.press('Escape');
  });
  await bal_b.page.waitForTimeout(900);
  await bal_open_batch();
  await bal_b.page.locator('[aria-modal="true"] input[type="number"]:visible').first().fill('3');
  let bal_small_done = false;
  for (let bal_try = 0; bal_try < 6 && !bal_small_done; bal_try += 1) {
    await bal_b.act('[aria-modal="true"] button:has-text("Generate batch")').catch(async () => {
      await bal_b.page.evaluate(() => {
        const bal_sheet = Array.from(document.querySelectorAll('[aria-modal="true"]')).find((b) => b.getBoundingClientRect().height > 0);
        const bal_btn = Array.from(bal_sheet.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Generate batch');
        bal_btn?.click();
      });
    });
    bal_small_done = await bal_b.page
      .waitForSelector('text=Batch saved', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!bal_small_done) throw new Error('small batch never completed');
  bal_b.check('small batch completes after a cancellation', true);
  const bal_pdf_bytes = await bal_page_download_pdf(bal_b);
  bal_b.check('batch pdf downloads with valid magic', bal_pdf_bytes !== null && bal_pdf_bytes.length > 4000 && bal_pdf_bytes.slice(0, 5).toString() === '%PDF-', `${bal_pdf_bytes === null ? 0 : bal_pdf_bytes.length} bytes`);

  await bal_b.reload();
  await bal_b.page.waitForTimeout(1500);
  const bal_still = await bal_b.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').slice(0, 100));
  bal_b.check('state persists after large operations', bal_still.length > 20, bal_still);
  await bal_b.finish();
} catch (bal_err) {
  bal_ok = false;
  await bal_b.dumpFailure(bal_err);
  console.log(`FAIL [${bal_b.state.name}] crashed: ${bal_err?.message ?? bal_err}`);
}

await bal_browser.close();
if (!bal_a.state.passed || !bal_b.state.passed) bal_ok = false;
console.log(`RELEASE LARGE ${bal_ok ? 'OK' : 'FAILED'} (${bal_run})`);
process.exit(bal_ok ? 0 : 1);

async function bal_page_download_pdf(bal) {
  return new Promise((bal_resolve) => {
    const bal_timeout = setTimeout(() => {
      bal_cleanup();
      bal_resolve(null);
    }, 30000);
    const bal_handler = async (bal_download) => {
      try {
        const bal_path = await bal_download.path();
        const { readFileSync } = await import('node:fs');
        bal_resolve(readFileSync(bal_path));
      } catch {
        bal_resolve(null);
      } finally {
        bal_cleanup();
      }
    };
    const bal_cleanup = () => {
      clearTimeout(bal_timeout);
      bal.page.removeListener('download', bal_handler);
    };
    bal.page.on('download', bal_handler);
    bal.act('button:has-text("Download batch PDF")').catch(() => {
      bal_cleanup();
      bal_resolve(null);
    });
  });
}
