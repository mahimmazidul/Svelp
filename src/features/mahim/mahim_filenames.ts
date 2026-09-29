const BAL_INVALID_FILESYSTEM_CHARS = /[/\\:*?"<>|\u0000-\u001f]/g;
const BAL_FILENAME_MAX_CODEPOINTS = 80;

export function bal_sanitize_filename(
  bal_input: string,
  bal_extension: string
): string {
  let bal_name = bal_input.trim();
  bal_name = bal_name.replace(/\s+/g, '-');
  bal_name = bal_name.replace(BAL_INVALID_FILESYSTEM_CHARS, '');
  bal_name = bal_name.replace(/-+/g, '-');
  bal_name = bal_name.replace(/^[.-]+/, '');
  bal_name = bal_name.replace(/[.-]+$/, '');
  bal_name = Array.from(bal_name).slice(0, BAL_FILENAME_MAX_CODEPOINTS).join('');
  bal_name = bal_name.replace(/[.-]+$/, '');
  const bal_suffix = bal_extension.startsWith('.') ? bal_extension : `.${bal_extension}`;
  if (bal_name.length === 0) {
    bal_name = 'svelp';
  }
  if (bal_name.endsWith(bal_suffix)) {
    return bal_name.slice(0, bal_name.length - bal_suffix.length) + bal_suffix;
  }
  return `${bal_name}${bal_suffix}`;
}

export function bal_local_date_stamp(bal_now: Date = new Date()): string {
  const bal_year = bal_now.getFullYear();
  const bal_month = String(bal_now.getMonth() + 1).padStart(2, '0');
  const bal_day = String(bal_now.getDate()).padStart(2, '0');
  return `${bal_year}-${bal_month}-${bal_day}`;
}

export function bal_transfer_filename(
  bal_project_title: string,
  bal_version: number
): string {
  return bal_sanitize_filename(
    `${bal_project_title}-v${bal_version}`,
    '.mahim'
  );
}

export function bal_backup_filename(
  bal_project_title: string,
  bal_now: Date = new Date()
): string {
  return bal_sanitize_filename(
    `${bal_project_title}-backup-${bal_local_date_stamp(bal_now)}`,
    '.mahim'
  );
}

export function bal_questionnaire_json_filename(
  bal_project_title: string,
  bal_version: number
): string {
  return bal_sanitize_filename(
    `${bal_project_title}-v${bal_version}-questionnaire`,
    '.json'
  );
}

export function bal_print_batch_pdf_filename(
  bal_project_title: string,
  bal_version: number,
  bal_first_respondent: string,
  bal_last_respondent: string
): string {
  return bal_sanitize_filename(
    `${bal_project_title}-v${bal_version}-${bal_first_respondent}-${bal_last_respondent}`,
    '.pdf'
  );
}
