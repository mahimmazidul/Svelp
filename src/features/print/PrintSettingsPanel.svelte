<script lang="ts">
  import Field from '../../components/ui/Field.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import type {
    Orientation,
    PaperSize,
    PrintDensity,
    PrintFontFamily,
    PrintSettings,
    PrintThemeName
  } from '../../models/types';
  import type { PrintPreset } from './print_settings';
  import {
    BAL_DENSITY_LABELS,
    BAL_PRINT_FONT_LABELS,
    BAL_PRINT_PRESETS,
    BAL_PRINT_THEME_LABELS
  } from './print_settings';

  let {
    settings,
    paperSize,
    orientation,
    onchange,
    onpaper,
    onorientation,
    onpreset
  }: {
    settings: PrintSettings;
    paperSize: PaperSize;
    orientation: Orientation;
    onchange: (bal_next: PrintSettings) => void;
    onpaper: (bal_size: PaperSize) => void;
    onorientation: (bal_orientation: Orientation) => void;
    onpreset: (bal_preset: PrintPreset) => void;
  } = $props();

  function bal_patch(bal_part: Partial<PrintSettings>): void {
    onchange({ ...settings, ...bal_part });
  }

  function bal_patch_header(bal_part: Partial<PrintSettings['header']>): void {
    onchange({ ...settings, header: { ...settings.header, ...bal_part } });
  }

  function bal_patch_footer(bal_part: Partial<PrintSettings['footer']>): void {
    onchange({ ...settings, footer: { ...settings.footer, ...bal_part } });
  }

  function bal_patch_margins(bal_part: Partial<PrintSettings['margins']>): void {
    onchange({ ...settings, margins: { ...settings.margins, ...bal_part } });
  }

  const BAL_MARGIN_FIELDS: { side: keyof PrintSettings['margins']; label: string }[] = [
    { side: 'top', label: 'Top' },
    { side: 'right', label: 'Right' },
    { side: 'bottom', label: 'Bottom' },
    { side: 'left', label: 'Left' }
  ];

  function bal_apply_theme(bal_name: PrintThemeName): void {
    onchange({
      ...settings,
      theme: {
        ...settings.theme,
        name: bal_name,
        fontFamily: theme_family(bal_name),
        baseFontSize: theme_size(bal_name),
        headingScale: theme_scale(bal_name)
      }
    });
  }

  function theme_family(bal_name: PrintThemeName): PrintFontFamily {
    const bal_map: Record<PrintThemeName, PrintFontFamily> = {
      academic: 'times',
      clinical: 'helvetica',
      minimal: 'helvetica',
      compact: 'helvetica',
      institutional: 'helvetica'
    };
    return bal_map[bal_name];
  }

  function theme_size(bal_name: PrintThemeName): number {
    const bal_map: Record<PrintThemeName, number> = {
      academic: 11,
      clinical: 10.5,
      minimal: 10.5,
      compact: 9.5,
      institutional: 11
    };
    return bal_map[bal_name];
  }

  let bal_logo_error = $state<string | null>(null);

  async function bal_load_logo(bal_file: File): Promise<void> {
    bal_logo_error = null;
    if (!['image/png', 'image/jpeg'].includes(bal_file.type)) {
      bal_logo_error = 'Use a PNG or JPEG image stored on this device.';
      return;
    }
    const bal_data_url = await new Promise<string>((bal_resolve, bal_reject) => {
      const bal_reader = new FileReader();
      bal_reader.onload = () => bal_resolve(bal_reader.result as string);
      bal_reader.onerror = () => bal_reject(new Error('Could not read the image.'));
      bal_reader.readAsDataURL(bal_file);
    });
    const bal_aspect = await new Promise<number>((bal_resolve) => {
      const bal_image = new Image();
      bal_image.onload = () =>
        bal_resolve(bal_image.naturalHeight > 0 ? bal_image.naturalWidth / bal_image.naturalHeight : 1);
      bal_image.onerror = () => bal_resolve(1);
      bal_image.src = bal_data_url;
    });
    onchange({ ...settings, logo: { dataUrl: bal_data_url, widthMm: 24, aspect: bal_aspect } });
  }

  function theme_scale(bal_name: PrintThemeName): number {
    const bal_map: Record<PrintThemeName, number> = {
      academic: 1.25,
      clinical: 1.2,
      minimal: 1.1,
      compact: 1.15,
      institutional: 1.3
    };
    return bal_map[bal_name];
  }
</script>

<div class="panel">
  <section class="group">
    <h3>Presets</h3>
    <div class="preset-row">
      {#each BAL_PRINT_PRESETS as bal_preset (bal_preset.name)}
        <button type="button" class="preset" onclick={() => onpreset(bal_preset)}>
          {bal_preset.label}
        </button>
      {/each}
    </div>
  </section>

  <section class="group">
    <h3>Paper</h3>
    <Field label="Paper size">
      <select
        class="select"
        value={paperSize}
        onchange={(bal_event) =>
          onpaper((bal_event.currentTarget as HTMLSelectElement).value as PaperSize)}
      >
        <option value="a4">A4 (210 × 297 mm)</option>
        <option value="letter">US Letter (215.9 × 279.4 mm)</option>
      </select>
    </Field>
    <Field label="Orientation">
      <select
        class="select"
        value={orientation}
        onchange={(bal_event) =>
          onorientation((bal_event.currentTarget as HTMLSelectElement).value as Orientation)}
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
    </Field>
    <div class="margin-grid">
      {#each BAL_MARGIN_FIELDS as bal_field (bal_field.side)}
        <label class="margin-field">
          <span>{bal_field.label} (mm)</span>
          <input
            class="ti"
            type="number"
            min="10"
            max="40"
            step="0.5"
            value={settings.margins[bal_field.side]}
            oninput={(bal_event) => {
              const bal_value = Number((bal_event.currentTarget as HTMLInputElement).value);
              if (Number.isFinite(bal_value)) {
                bal_patch_margins({ [bal_field.side]: bal_value });
              }
            }}
          />
        </label>
      {/each}
    </div>
  </section>

  <section class="group">
    <h3>Theme</h3>
    <Field label="Print theme">
      <select
        class="select"
        value={settings.theme.name}
        onchange={(bal_event) =>
          bal_apply_theme((bal_event.currentTarget as HTMLSelectElement).value as PrintThemeName)}
      >
        {#each Object.entries(BAL_PRINT_THEME_LABELS) as [bal_name, bal_label] (bal_name)}
          <option value={bal_name}>{bal_label}</option>
        {/each}
      </select>
    </Field>
    <Field label="Font">
      <select
        class="select"
        value={settings.theme.fontFamily}
        onchange={(bal_event) =>
          bal_patch({
            theme: {
              ...settings.theme,
              fontFamily: (bal_event.currentTarget as HTMLSelectElement).value as PrintFontFamily
            }
          })}
      >
        {#each Object.entries(BAL_PRINT_FONT_LABELS) as [bal_name, bal_label] (bal_name)}
          <option value={bal_name}>{bal_label}</option>
        {/each}
      </select>
    </Field>
    <Field label="Base font size (pt)">
      <input
        class="ti"
        type="number"
        min="8"
        max="14"
        step="0.5"
        value={settings.theme.baseFontSize}
        oninput={(bal_event) => {
          const bal_value = Number((bal_event.currentTarget as HTMLInputElement).value);
          if (Number.isFinite(bal_value)) {
            bal_patch({ theme: { ...settings.theme, baseFontSize: bal_value } });
          }
        }}
      />
    </Field>
    <Field label="Density">
      <select
        class="select"
        value={settings.density}
        onchange={(bal_event) =>
          bal_patch({ density: (bal_event.currentTarget as HTMLSelectElement).value as PrintDensity })}
      >
        {#each Object.entries(BAL_DENSITY_LABELS) as [bal_name, bal_label] (bal_name)}
          <option value={bal_name}>{bal_label}</option>
        {/each}
      </select>
    </Field>
    <Field label="Question spacing (mm)">
      <input
        class="ti"
        type="number"
        min="2"
        max="14"
        step="0.5"
        value={settings.questionSpacing}
        oninput={(bal_event) => {
          const bal_value = Number((bal_event.currentTarget as HTMLInputElement).value);
          if (Number.isFinite(bal_value)) bal_patch({ questionSpacing: bal_value });
        }}
      />
    </Field>
  </section>

  <section class="group">
    <h3>Header</h3>
    <Switch
      checked={settings.header.showTitle}
      label="Show questionnaire title"
      onchange={(bal_checked) => bal_patch_header({ showTitle: bal_checked })}
    />
    <Switch
      checked={settings.header.showInstitution}
      label="Show institution"
      onchange={(bal_checked) => bal_patch_header({ showInstitution: bal_checked })}
    />
    {#if settings.header.showInstitution}
      <TextInput
        value={settings.header.institution}
        placeholder="Institution name"
        oninput={(bal_value) => bal_patch_header({ institution: bal_value })}
      />
    {/if}
    <Switch
      checked={settings.header.showStudyCode}
      label="Show study code"
      onchange={(bal_checked) => bal_patch_header({ showStudyCode: bal_checked })}
    />
    {#if settings.header.showStudyCode}
      <TextInput
        value={settings.header.studyCode}
        placeholder="Short code, letters and digits"
        maxlength={8}
        oninput={(bal_value) => bal_patch_header({ studyCode: bal_value.toUpperCase() })}
      />
    {/if}
    <Switch
      checked={settings.header.showVersion}
      label="Show questionnaire version"
      onchange={(bal_checked) => bal_patch_header({ showVersion: bal_checked })}
    />
    <Switch
      checked={settings.header.showRespondentId}
      label="Respondent ID box"
      onchange={(bal_checked) => bal_patch_header({ showRespondentId: bal_checked })}
    />
    {#if settings.header.showRespondentId}
      <TextInput
        value={settings.respondentArea.label}
        placeholder="Respondent ID"
        oninput={(bal_value) =>
          bal_patch({ respondentArea: { ...settings.respondentArea, label: bal_value } })}
      />
    {/if}
    <Field label="Logo" hint="PNG or JPEG from this device. Shown in the header.">
      <input
        class="file"
        type="file"
        accept="image/png,image/jpeg"
        onchange={(bal_event) => {
          const bal_input = bal_event.currentTarget as HTMLInputElement;
          const bal_file = bal_input.files?.[0];
          bal_input.value = '';
          if (bal_file) void bal_load_logo(bal_file);
        }}
      />
    </Field>
    {#if bal_logo_error}
      <p class="logo-error" role="alert">{bal_logo_error}</p>
    {/if}
    {#if settings.logo}
      <div class="logo-row">
        <img class="logo-thumb" src={settings.logo.dataUrl} alt="Logo preview" />
        <span class="logo-size">{settings.logo.widthMm} mm wide</span>
        <button
          type="button"
          class="logo-remove"
          onclick={() => onchange({ ...settings, logo: null })}
        >
          Remove
        </button>
      </div>
    {/if}
  </section>

  <section class="group">
    <h3>Footer</h3>
    <Switch
      checked={settings.footer.showPageNumbers}
      label="Page numbers"
      onchange={(bal_checked) => bal_patch_footer({ showPageNumbers: bal_checked })}
    />
    <Switch
      checked={settings.footer.showHumanIdentifier}
      label="Readable page code"
      onchange={(bal_checked) => bal_patch_footer({ showHumanIdentifier: bal_checked })}
    />
    <Switch
      checked={settings.footer.showStudyCode}
      label="Study code in footer"
      onchange={(bal_checked) => bal_patch_footer({ showStudyCode: bal_checked })}
    />
    <TextInput
      value={settings.footer.confidentialityNote}
      placeholder="Confidentiality note (optional)"
      oninput={(bal_value) => bal_patch_footer({ confidentialityNote: bal_value })}
    />
  </section>

  <section class="group">
    <h3>Identifiers and scanning</h3>
    <Switch
      checked={settings.showMachineIdentifier}
      label="Machine-readable page code"
      hint="Prints a QR code in the footer of every page."
      onchange={(bal_checked) => bal_patch({ showMachineIdentifier: bal_checked })}
    />
    {#if settings.showMachineIdentifier}
      <Field label="Page code size (mm)" hint="Below 18 mm phone photos may struggle.">
        <input
          class="ti"
          type="number"
          min="12"
          max="30"
          step="0.5"
          value={settings.identifier.sizeMm}
          oninput={(bal_event) => {
            const bal_value = Number((bal_event.currentTarget as HTMLInputElement).value);
            if (Number.isFinite(bal_value)) {
              bal_patch({ identifier: { ...settings.identifier, sizeMm: bal_value } });
            }
          }}
        />
      </Field>
    {/if}
    <Switch
      checked={settings.scannerMode}
      label="Scanner-readable paper forms"
      hint="Enforces safe margins, alignment markers, and mark size rules."
      onchange={(bal_checked) => bal_patch({ scannerMode: bal_checked })}
    />
    {#if settings.scannerMode}
      <Field label="Answer mark size (mm)">
        <input
          class="ti"
          type="number"
          min="3.6"
          max="6"
          step="0.1"
          value={settings.marker.diameterMm}
          oninput={(bal_event) => {
            const bal_value = Number((bal_event.currentTarget as HTMLInputElement).value);
            if (Number.isFinite(bal_value)) {
              bal_patch({ marker: { ...settings.marker, diameterMm: bal_value } });
            }
          }}
        />
      </Field>
    {/if}
  </section>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .group h3 {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-muted, var(--color-ink));
    opacity: 0.72;
  }

  .select {
    height: var(--control-height);
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-ink);
  }

  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .preset {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius-full);
    padding: 0.3rem 0.8rem;
    font-size: var(--text-xs);
    color: var(--color-ink);
    cursor: pointer;
  }

  .preset:hover {
    border-color: var(--color-accent);
  }

  .margin-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .margin-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: var(--text-xs);
    color: var(--color-ink);
    opacity: 0.85;
  }

  .file {
    font-size: var(--text-xs);
    color: var(--color-ink);
    max-width: 100%;
  }

  .logo-error {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-danger);
  }

  .logo-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
  }

  .logo-thumb {
    max-height: 2rem;
    max-width: 4rem;
    object-fit: contain;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: #ffffff;
    padding: 2px;
  }

  .logo-remove {
    border: none;
    background: none;
    color: var(--color-danger);
    font-size: var(--text-xs);
    cursor: pointer;
    padding: 0.2rem 0.4rem;
  }

  .ti {
    height: var(--control-height);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
    background: var(--color-surface);
    color: var(--color-ink);
  }
</style>
