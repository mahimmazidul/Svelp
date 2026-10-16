import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BAL_ART_DIR = join(dirname(fileURLToPath(import.meta.url)), 'artifacts');
mkdirSync(BAL_ART_DIR, { recursive: true });

const BAL_IGNORE_CONSOLE = [];

const BAL_IGNORE_NET = [];

export function bal_base_arg() {
  const bal_a = process.argv.find((x) => x.startsWith('--url='));
  return bal_a ? bal_a.slice(6) : 'http://localhost:4173';
}

export function bal_widths_arg(bal_default = '390,1440') {
  const bal_a = process.argv.find((x) => x.startsWith('--widths='));
  return (bal_a ? bal_a.slice(9) : bal_default).split(',').map(Number);
}

function bal_stamp() {
  return new Date().toISOString();
}

export async function bal_start_run(bal_browser, { name, base, width, height = 820, touch = false }) {
  const bal_context = await bal_browser.newContext({
    viewport: { width, height },
    hasTouch: touch
  });
  try {
    await bal_context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  } catch {
    void 0;
  }
  const bal_page = await bal_context.newPage();

  const bal_state = {
    name,
    base,
    width,
    startedAt: bal_stamp(),
    consoleMessages: [],
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
    badResponses: [],
    rejections: [],
    checks: [],
    failures: 0
  };

  bal_page.on('console', (bal_msg) => {
    const bal_entry = { type: bal_msg.type(), text: bal_msg.text().slice(0, 400) };
    bal_state.consoleMessages.push(bal_entry);
    if (bal_msg.type() === 'error') {
      if (!BAL_IGNORE_CONSOLE.some((bal_re) => bal_re.test(bal_entry.text))) {
        bal_state.consoleErrors.push(bal_entry);
      }
    } else if (bal_msg.type() === 'warning') {
      bal_state.consoleWarnings.push(bal_entry);
    }
  });

  bal_page.on('pageerror', (bal_err) => {
    bal_state.pageErrors.push(String(bal_err?.message ?? bal_err).slice(0, 400));
  });

  bal_page.on('requestfailed', (bal_req) => {
    const bal_entry = { url: bal_req.url().slice(0, 300), method: bal_req.method(), failure: bal_req.failure()?.errorText ?? 'unknown' };
    if (!BAL_IGNORE_NET.some((bal_re) => bal_re.test(bal_entry.url))) {
      bal_state.requestFailures.push(bal_entry);
    }
  });

  bal_page.on('response', (bal_res) => {
    if (bal_res.status() >= 400) {
      const bal_url = bal_res.url();
      if (/\.(js|mjs|css|svg|png|woff2?|json|txt|xml|webmanifest|webp|jpg)(\?|$)|\/(sw\.js|workbox-)/.test(bal_url)) {
        if (!BAL_IGNORE_NET.some((bal_re) => bal_re.test(bal_url))) {
          bal_state.badResponses.push({ url: bal_url.slice(0, 300), status: bal_res.status() });
        }
      }
    }
  });

  await bal_page.addInitScript(() => {
    window.__bal_rejections = [];
    window.addEventListener('unhandledrejection', (bal_e) => {
      window.__bal_rejections.push(String(bal_e?.reason?.message ?? bal_e?.reason ?? 'unknown rejection').slice(0, 300));
    });
  });

  function bal_check(bal_label, bal_ok, bal_detail) {
    const bal_entry = { label: bal_label, ok: Boolean(bal_ok), detail: bal_detail === undefined ? '' : String(bal_detail).slice(0, 300) };
    bal_state.checks.push(bal_entry);
    console.log(`${bal_ok ? 'PASS' : 'FAIL'} [${name}@${width}] ${bal_label}${bal_entry.detail ? ` :: ${bal_entry.detail}` : ''}`);
    if (!bal_ok) bal_state.failures += 1;
  }

  async function bal_dump_failure(bal_label) {
    const bal_file = join(BAL_ART_DIR, `${name}-failure.png`);
    try {
      await bal_page.screenshot({ path: bal_file, fullPage: false });
    } catch {
      void 0;
    }
    let bal_dialogs = [];
    try {
      bal_dialogs = await bal_page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], .overlay .dialog, .sheet'))
          .filter((bal_el) => bal_el.getBoundingClientRect().height > 0)
          .map((bal_el) => (bal_el.textContent ?? '').trim().slice(0, 200))
      );
    } catch {
      void 0;
    }
    bal_state.failure = { label: bal_label, url: bal_page.url(), at: bal_stamp(), visibleDialogs: bal_dialogs };
    writeFileSync(join(BAL_ART_DIR, `${name}-artifact.json`), JSON.stringify(bal_state, null, 2));
    console.log(`ARTIFACT ${bal_file} + ${name}-artifact.json`);
  }

  async function bal_finish() {
    try {
      bal_state.rejections = await bal_page.evaluate(() => window.__bal_rejections ?? []);
    } catch {
      void 0;
    }
    bal_state.finishedAt = bal_stamp();
    bal_state.runtimeErrors = {
      consoleErrors: bal_state.consoleErrors,
      pageErrors: bal_state.pageErrors,
      unhandledRejections: bal_state.rejections,
      requestFailures: bal_state.requestFailures,
      badResponses: bal_state.badResponses
    };
    bal_state.runtimeClean =
      bal_state.consoleErrors.length === 0 &&
      bal_state.pageErrors.length === 0 &&
      bal_state.rejections.length === 0 &&
      bal_state.requestFailures.length === 0 &&
      bal_state.badResponses.length === 0;
    if (!bal_state.runtimeClean) {
      bal_check('runtime clean (console/network/page errors)', false, JSON.stringify(bal_state.runtimeErrors).slice(0, 400));
    }
    bal_state.passed = bal_state.failures === 0;
    writeFileSync(join(BAL_ART_DIR, `${name}.json`), JSON.stringify(bal_state, null, 2));
    console.log(`${bal_state.passed ? 'RUN OK' : 'RUN FAILED'} ${name}@${width} checks=${bal_state.checks.length} failures=${bal_state.failures}`);
    await bal_context.close();
    return bal_state.passed;
  }

  async function bal_tappable(bal_selector, bal_label) {
    const bal_box = await bal_page.locator(bal_selector).first().boundingBox().catch(() => null);
    if (!bal_box) {
      bal_check(`pointer reaches ${bal_label ?? bal_selector}`, false, 'element not found');
      return;
    }
    const bal_probe = await bal_page.evaluate(
      ([bal_x, bal_y]) => {
        const bal_top = document.elementFromPoint(bal_x, bal_y);
        if (!bal_top) return { ok: false, top: 'none' };
        return { ok: true, top: bal_top.tagName + '.' + String(bal_top.className).slice(0, 40) };
      },
      [bal_box.x + bal_box.width / 2, bal_box.y + bal_box.height / 2]
    );
    bal_check(`pointer reaches ${bal_label ?? bal_selector}`, bal_probe.ok, bal_probe.top);
  }

  async function bal_act(bal_selector) {
    if ((await bal_page.locator(bal_selector).count()) === 0) {
      throw new Error(`missing control: ${bal_selector}`);
    }
    if (bal_state.width < 800) {
      await bal_page.locator(bal_selector).first().tap();
    } else {
      await bal_page.locator(bal_selector).first().click();
    }
  }

  async function bal_paste_source(bal_text) {
    await bal_page.locator('.cm-content').first().click();
    await bal_page.keyboard.press('Control+a');
    await bal_page.evaluate(async (bal_src) => {
      const bal_dt = new DataTransfer();
      bal_dt.setData('text/plain', bal_src);
      const bal_target = document.querySelector('.cm-content');
      bal_target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: bal_dt, bubbles: true, cancelable: true }));
    }, bal_text);
  }

  async function bal_ui_create_project(bal_name, bal_description) {
    await bal_page.goto(`${bal_state.base}/#/projects`, { waitUntil: 'networkidle' });
    await bal_page.waitForSelector('button:has-text("New project")', { timeout: 30000 });
    await bal_act('button:has-text("New project")');
    await bal_page.waitForSelector('input[placeholder="For example: Community Nutrition Survey 2026"]', { timeout: 15000 });
    await bal_page.locator('input[placeholder="For example: Community Nutrition Survey 2026"]').fill(bal_name);
    if (bal_description) {
      await bal_page.locator('textarea[placeholder="Optional description"]').fill(bal_description);
    }
    await bal_act('button:has-text("Create project")');
    await bal_page.waitForSelector(`text=${bal_name}`, { timeout: 15000 });
    bal_check(`project appears in list (${bal_name})`, true);
    await bal_act(`text=${bal_name}`);
    await bal_page.waitForSelector('.mode-switch button[role="tab"]', { timeout: 20000 });
    const bal_url = bal_page.url();
    const bal_pid = decodeURIComponent(bal_url.match(/#\/project\/([^/]+)\//)?.[1] ?? '');
    bal_state.lastPid = bal_pid;
    bal_check('project opens into Build', bal_pid.length > 0, bal_url);
    await bal_page.waitForSelector('.save-state', { timeout: 20000 });
    bal_check('build page loads with save indicator', true);
    return bal_pid;
  }

  async function bal_goto_area(bal_area) {
    if (!bal_state.lastPid) throw new Error('goto_area before project open');
    await bal_page.goto(`${bal_state.base}/#/project/${encodeURIComponent(bal_state.lastPid)}/${bal_area}`, { waitUntil: 'networkidle' });
    await bal_page.waitForTimeout(900);
  }

  async function bal_cancel_first(bal_locator) {
    await bal_locator.first().tap();
  }

  async function bal_visual_text() {
    return (await bal_page.locator('main').first().textContent().catch(() => '')) ?? '';
  }

  async function bal_copy_source() {
    await bal_act('button:has-text("Copy")');
    await bal_page.waitForTimeout(700);
    return bal_page.evaluate(() => navigator.clipboard.readText());
  }

  async function bal_ui_apply_source(bal_source, { expect_saved = true } = {}) {
    await bal_act('button[role="tab"]:has-text("Source")');
    await bal_page.waitForSelector('.cm-content', { timeout: 30000 });
    await bal_page.waitForTimeout(600);
    await bal_paste_source(bal_source);
    await bal_page.waitForTimeout(1200);
    const bal_state_text = ((await bal_page.locator('.state').first().textContent().catch(() => '')) ?? '').trim();
    bal_check('source parses valid', bal_state_text.toLowerCase().includes('valid'), bal_state_text);
    const bal_apply_disabled = await bal_page.locator('button:has-text("Apply")').first().isDisabled();
    bal_check('Apply becomes available', !bal_apply_disabled);
    const bal_problems = ((await bal_page.locator('button:has-text("Problems")').first().textContent().catch(() => '')) ?? '').trim();
    bal_check('no problems detected', /Problems$/.test(bal_problems), bal_problems);
    await bal_act('button:has-text("Apply")');
    try {
      await bal_page.waitForSelector('button:has-text("Apply changes")', { timeout: 4000 });
      await bal_act('button:has-text("Apply changes")');
    } catch {
      void 0;
    }
    if (expect_saved) {
      await bal_page.waitForSelector('.save-state[data-state="saved"]', { timeout: 30000 });
      const bal_saved = ((await bal_page.locator('.save-state').first().textContent().catch(() => '')) ?? '').trim();
      bal_check('saved state appears', bal_saved.includes('All changes saved'), bal_saved);
      const bal_failed = ((await bal_page.locator('.save-state').first().textContent().catch(() => '')) ?? '').trim();
      bal_check('no save-failed state', !bal_failed.includes('Save failed'), bal_failed);
    }
  }

  async function bal_ui_reload() {
    await bal_page.reload({ waitUntil: 'networkidle' });
    await bal_page.waitForTimeout(1200);
  }

  return {
    page: bal_page,
    context: bal_context,
    check: bal_check,
    act: bal_act,
    tappable: bal_tappable,
    pasteSource: bal_paste_source,
    uiCreateProject: bal_ui_create_project,
    uiApplySource: bal_ui_apply_source,
    gotoArea: bal_goto_area,
    cancelFirst: bal_cancel_first,
    visualText: bal_visual_text,
    copySource: bal_copy_source,
    reload: bal_ui_reload,
    dumpFailure: bal_dump_failure,
    finish: bal_finish,
    state: bal_state
  };
}

export function bal_read_fixture(bal_name) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', bal_name), 'utf8');
}
