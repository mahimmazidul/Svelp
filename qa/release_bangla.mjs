import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { bal_base_arg, bal_start_run, bal_read_fixture } from './release_lib.mjs';

const BASE = bal_base_arg();
const BAL_RUN = `release-bangla-${Date.now().toString(36)}`;
const BAL_PROJECT = `Release Bangla ${Date.now().toString(36)}`;
const BAL_SOURCE = bal_read_fixture('release_bangla.svelp.txt');

let bal_ok = true;
const bal_browser = await chromium.launch();

try {
  const bal = await bal_start_run(bal_browser, { name: BAL_RUN, base: BASE, width: 390, touch: true });

  try {
    await bal.uiCreateProject(BAL_PROJECT, 'Bangla release validation');
    await bal.uiApplySource(BAL_SOURCE);

    await bal.reload();
    await bal.page.waitForSelector('.save-state', { timeout: 20000 });
    await bal.act('button[role="tab"]:has-text("Source")');
    await bal.page.waitForSelector('.cm-content', { timeout: 20000 });
    await bal.page.waitForTimeout(800);
    const bal_state_text = ((await bal.page.locator('.state').first().textContent().catch(() => '')) ?? '').trim();
    bal.check('bangla source persists after reload', bal_state_text.length > 0 && !bal_state_text.toLowerCase().includes('invalid'), bal_state_text);

    await bal.act('button[role="tab"]:has-text("Visual")');
    await bal.page.waitForTimeout(900);
    const bal_visual = await bal.visualText();
    bal.check('visual shows bangla question label', bal_visual.includes('আপনার বয়স কত?'));

    await bal.act('button[role="tab"]:has-text("Source")');
    await bal.page.waitForSelector('.cm-content', { timeout: 20000 });
    await bal.page.waitForTimeout(800);
    const bal_roundtrip = await bal.copySource();
    bal.check('round-trip keeps bangla options', bal_roundtrip.includes('ভাত') && bal_roundtrip.includes('রুটি'));
    bal.check('round-trip keeps bangla matrix rows', bal_roundtrip.includes('মাছ'));
    bal.check('round-trip keeps bangla scale', bal_roundtrip.includes('প্রতিদিন'));
    bal.check('no mojibake in round-trip', !bal_roundtrip.includes('\uFFFD'));

    await bal.gotoArea('print');
    await bal.page.waitForSelector('button:has-text("Download PDF")', { timeout: 30000 });
    await bal.page.waitForTimeout(2500);
    const bal_svg = await bal.page.evaluate(() => {
      const bal_el = document.querySelector('.page svg');
      if (!bal_el) return null;
      return Array.from(bal_el.querySelectorAll('text')).map((bal_t) => (bal_t.textContent ?? '').trim());
    });
    const bal_svg_text = (bal_svg ?? []).join(' ');
    bal.check('print preview renders bangla title', bal_svg_text.includes('খাদ্য অপচয় সম্পর্কিত জরিপ'), bal_svg_text.slice(0, 120));
    bal.check('print preview renders bangla question', bal_svg_text.includes('আপনার বয়স কত?'));

    const bal_pdf = await bal_page_download(bal, () => bal.act('button:has-text("Download PDF")'));
    bal.check('bangla pdf download completes', bal_pdf !== null && bal_pdf.length > 1000, `${bal_pdf === null ? 0 : bal_pdf.length} bytes`);
    if (bal_pdf !== null) {
      const bal_head = bal_pdf.subarray(0, 5).toString('latin1');
      bal.check('bangla pdf header valid', bal_head === '%PDF-', bal_head);
    }

    await bal.gotoArea('export');
    await bal.page.waitForSelector('button:has-text("Codebook CSV")', { timeout: 30000 });
    await bal.page.waitForTimeout(1200);
    const bal_codebook = await bal_page_download(bal, () => bal.act('button:has-text("Codebook CSV")'));
    bal.check('codebook downloads', bal_codebook !== null && bal_codebook.length > 0, `${bal_codebook === null ? 0 : bal_codebook.length} bytes`);
    if (bal_codebook !== null) {
      const bal_csv = bal_codebook.toString('utf8');
      bal.check('codebook has bangla label', bal_csv.includes('আপনার বয়স কত?'));
      bal.check('codebook has bangla option', bal_csv.includes('ভাত'));
      bal.check('no mojibake replacement chars', !bal_csv.includes('\uFFFD'));
      bal.check('codebook covers all variables', ['age', 'food_waste', 'main_meal', 'weekly'].every((bal_v) => bal_csv.includes(bal_v)));
    }
  } catch (bal_err) {
    bal_ok = false;
    bal.check(`suite crashed: ${String(bal_err).slice(0, 120)}`, false);
    await bal.dumpFailure(String(bal_err).slice(0, 120));
  }

  if (!(await bal.finish())) bal_ok = false;
} finally {
  await bal_browser.close();
}

console.log(bal_ok ? 'RELEASE BANGLA OK' : 'RELEASE BANGLA FAILED');
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
