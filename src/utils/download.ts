export function malta_download_file(
  bal_name: string,
  bal_content: string,
  bal_mime: string
): void {
  const bal_blob = new Blob([bal_content], { type: bal_mime });
  const bal_url = URL.createObjectURL(bal_blob);
  const bal_anchor = document.createElement('a');
  bal_anchor.href = bal_url;
  bal_anchor.download = bal_name;
  document.body.appendChild(bal_anchor);
  bal_anchor.click();
  bal_anchor.remove();
  URL.revokeObjectURL(bal_url);
}
