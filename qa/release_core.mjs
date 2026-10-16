import { chromium } from 'playwright';
import { bal_base_arg, bal_start_run, bal_widths_arg, bal_read_fixture } from './release_lib.mjs';

const BASE = bal_base_arg();
const WIDTHS = bal_widths_arg('390,1440');
const BAL_RUN = `release-core-${Date.now().toString(36)}`;
const BAL_PROJECT = `Release Core ${Date.now().toString(36)}`;

const BAL_SOURCE = bal_read_fixture('release_basic.svelp.txt');
const BAL_MATRIX_SOURCE = bal_read_fixture('release_matrix.svelp.txt');

const BAL_ROUTES = [
  ['#/projects', 'Projects'],
  ['#/scan', 'Scan']
];

let bal_ok = true;
const bal_browser = await chromium.launch();

try {
  for (const bal_width of WIDTHS) {
    const bal_touch = bal_width < 800;
    const bal = await bal_start_run(bal_browser, { name: `${BAL_RUN}`, base: BASE, width: bal_width, touch: bal_touch });

    try {
      const bal_pid = await bal.uiCreateProject(BAL_PROJECT, 'Release validation project');

      await bal.uiApplySource(BAL_SOURCE);
      await bal.tappable('button:has-text("Apply")', 'Apply');

      await bal.reload();
      await bal_page_still_there(bal);
      await bal.act('button[role="tab"]:has-text("Source")');
      await bal.page.waitForSelector('.cm-content', { timeout: 20000 });
      await bal.page.waitForTimeout(800);
      const bal_state_text = ((await bal.page.locator('.state').first().textContent().catch(() => '')) ?? '').trim();
      bal.check('source persists after reload', bal_state_text.length > 0 && !bal_state_text.toLowerCase().includes('invalid'), bal_state_text);

      await bal.act('button[role="tab"]:has-text("Visual")');
      await bal.page.waitForTimeout(900);
      const bal_visual = await bal.visualText();
      for (const bal_expected of ['Age', 'Sex', 'Consent obtained?']) {
        bal.check(`visual reflects "${bal_expected}"`, bal_visual.includes(bal_expected));
      }

      await bal.act('button[role="tab"]:has-text("Source")');
      await bal.page.waitForSelector('.cm-content', { timeout: 20000 });
      await bal.page.waitForTimeout(800);
      const bal_resrc = await bal.copySource();
      bal.check('source serializes back with title', bal_resrc.includes('Release Test Survey'), `${bal_resrc.length} chars`);
      bal.check('source round-trip keeps sections', bal_resrc.includes('section demographics') && bal_resrc.includes('section attitudes'));
      bal.check('source round-trip keeps scale use', bal_resrc.includes('use agreement'));
      bal.check('source round-trip keeps matrix rows', bal_resrc.includes('rice') && bal_resrc.includes('vegetables'));
      bal.check('round-trip preserves likert labels', bal_resrc.includes('Reducing food waste is important.') && bal_resrc.includes('Planning meals helps reduce waste.'));

      await bal.gotoArea('print');
      await bal.page.waitForSelector('button:has-text("Download PDF")', { timeout: 30000 });
      await bal.page.waitForTimeout(2500);
      const bal_pages = await bal.page.locator('.sub').first().textContent().catch(() => '');
      bal.check('print preview computes pages', /page/.test(bal_pages ?? ''), (bal_pages ?? '').trim());

      for (const bal_density of ['comfortable', 'compact', 'dense']) {
        await bal_set_density(bal, bal_density);
        await bal.page.waitForTimeout(1500);
        const bal_svg_ok = await bal.page.evaluate(() => {
          const bal_svg = document.querySelector('.page svg');
          if (!bal_svg) return { present: false, texts: 0, rects: 0 };
          return {
            present: true,
            texts: Array.from(bal_svg.querySelectorAll('text')).filter((bal_t) => (bal_t.textContent ?? '').trim().length > 0).length,
            rects: bal_svg.querySelectorAll('rect').length
          };
        });
        bal.check(`density ${bal_density} preview renders content`, bal_svg_ok.present && bal_svg_ok.texts >= 5 && bal_svg_ok.rects >= 2, JSON.stringify(bal_svg_ok));
      }

      for (const bal_preset of ['Compact A4', 'Academic A4']) {
        if ((await bal.page.locator(`button.preset:has-text("${bal_preset}")`).count()) === 0) {
          await bal.act('button[aria-label="Print settings"]');
          await bal.page.waitForTimeout(700);
        }
        await bal.act(`button.preset:visible:has-text("${bal_preset}")`);
        await bal.page.waitForTimeout(1200);
        const bal_still = await bal.page.evaluate(() => !!document.querySelector('.page svg'));
        bal.check(`preset ${bal_preset} keeps preview`, bal_still);
      }

      await bal.page.keyboard.press('Escape');
      await bal.page.waitForTimeout(600);
      const bal_pdf = await bal_page_download(bal, () => bal.act('button:has-text("Download PDF")'));
      bal.check('PDF download completes', bal_pdf !== null && bal_pdf.length > 1000, `${bal_pdf === null ? 0 : bal_pdf.length} bytes`);
      bal.check('PDF marks no stuck preparing state', !(await bal.page.locator('button:has-text("Preparing…")').count()));

      await bal.gotoArea('responses');
      await bal_page_ready(bal, 'Responses');
      await bal.gotoArea('export');
      await bal_page_ready(bal, 'Export');
      await bal.gotoArea('scan');
      await bal_page_ready(bal, 'Scan');
      await bal.gotoArea('preview');
      await bal_page_ready(bal, 'Preview');

      await bal.page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle' });
      await bal.page.waitForTimeout(800);
      for (const [bal_hash, bal_label] of BAL_ROUTES) {
        await bal.page.goto(`${BASE}/${bal_hash}`, { waitUntil: 'networkidle' });
        await bal.page.waitForTimeout(900);
        const bal_blank = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').trim().length);
        bal.check(`route ${bal_hash} renders (${bal_label})`, bal_blank > 20, `${bal_blank} chars`);
      }

      if (bal_touch) {
        await bal_bottom_nav_visible(bal);
      }

      await bal.page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle' });
      await bal.page.waitForSelector('button:has-text("New project")', { timeout: 20000 });
      await bal.tappable('button:has-text("Import")', 'Import (projects)');
      await bal.tappable('button:has-text("New project")', 'New project');

      await bal.page.goto(`${BASE}/#/project/${encodeURIComponent(bal_pid)}/build`, { waitUntil: 'networkidle' });
      await bal.page.waitForTimeout(1000);

      await bal.uiApplySource(BAL_MATRIX_SOURCE);
      await bal.reload();
      await bal_page_still_there(bal);
      await bal.act('button[role="tab"]:has-text("Source")');
      await bal.page.waitForSelector('.cm-content', { timeout: 20000 });
      await bal.page.waitForTimeout(800);
      const bal_resrc2 = await bal.copySource();
      bal.check('second source apply replaced content', bal_resrc2.includes('Matrix Release Survey') && bal_resrc2.includes('Cooked rice'));

      await bal.gotoArea('print');
      await bal.page.waitForSelector('button:has-text("Download PDF")', { timeout: 30000 });
      await bal.page.waitForTimeout(2000);
      const bal_pages2 = ((await bal.page.locator('.sub').first().textContent().catch(() => '')) ?? '').trim();
      bal.check('matrix questionnaire print-ready', /page/.test(bal_pages2), bal_pages2);
    } catch (bal_err) {
      bal_ok = false;
      bal.check(`suite crashed: ${String(bal_err).slice(0, 120)}`, false);
      await bal.dumpFailure(String(bal_err).slice(0, 120));
    }

    if (!(await bal.finish())) bal_ok = false;
  }
} finally {
  await bal_browser.close();
}

console.log(bal_ok ? 'RELEASE CORE OK' : 'RELEASE CORE FAILED');
process.exit(bal_ok ? 0 : 1);

async function bal_page_ready(bal, bal_label) {
  await bal.page.waitForTimeout(1200);
  const bal_chars = await bal.page.evaluate(() => (document.querySelector('main')?.textContent ?? '').trim().length);
  bal.check(`${bal_label} area renders`, bal_chars > 20, `${bal_chars} chars`);
}

async function bal_page_still_there(bal) {
  await bal.page.waitForSelector('.save-state', { timeout: 20000 });
}

async function bal_set_density(bal, bal_density) {
  let bal_sel = bal.page.locator('select:has(option[value="comfortable"]):visible');
  if ((await bal_sel.count()) === 0) {
    await bal.act('button[aria-label="Print settings"]');
    await bal.page.waitForTimeout(700);
    bal_sel = bal.page.locator('select:has(option[value="comfortable"]):visible');
  }
  await bal_sel.first().selectOption(bal_density);
  await bal.page.waitForTimeout(1500);
}

async function bal_bottom_nav_visible(bal) {
  const bal_nav = await bal.page.evaluate(() => {
    const bal_el = document.querySelector('nav[aria-label*="Primary" i], .bottomnav, nav.bottom-nav');
    if (!bal_el) {
      const bal_fixed = Array.from(document.querySelectorAll('nav')).filter((bal_n) => getComputedStyle(bal_n).position === 'fixed');
      return bal_fixed.length > 0 ? 'fixed-nav' : 'none';
    }
    return 'found';
  });
  bal.check('bottom navigation present on mobile', bal_nav !== 'none', bal_nav);
}

async function bal_page_download(bal, bal_trigger) {
  try {
    const [bal_download] = await Promise.all([bal.page.waitForEvent('download', { timeout: 60000 }), bal_trigger()]);
    const bal_path = await bal_download.path();
    const { readFileSync } = await import('node:fs');
    return readFileSync(bal_path);
  } catch {
    return null;
  }
}
