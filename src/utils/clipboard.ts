export async function bal_copy_text(bal_text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(bal_text);
      return true;
    }
  } catch {
    void bal_text;
  }
  try {
    const bal_area = document.createElement('textarea');
    bal_area.value = bal_text;
    bal_area.setAttribute('readonly', 'readonly');
    bal_area.style.position = 'fixed';
    bal_area.style.left = '-9999px';
    document.body.appendChild(bal_area);
    bal_area.select();
    const bal_ok = document.execCommand('copy');
    document.body.removeChild(bal_area);
    return bal_ok;
  } catch {
    return false;
  }
}
