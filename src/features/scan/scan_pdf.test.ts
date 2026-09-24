import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { bal_pdf_page_count, bal_render_pdf_pages } from './scan_pdf';

function bal_two_page_pdf(): ArrayBuffer {
  const bal_doc = new jsPDF({ unit: 'mm', format: 'a4' });
  bal_doc.text('Sample page one', 20, 30);
  const bal_first = bal_doc.output('arraybuffer') as ArrayBuffer;
  void bal_first;
  bal_doc.addPage();
  bal_doc.text('Sample page two', 20, 30);
  return bal_doc.output('arraybuffer') as ArrayBuffer;
}

describe('pdf ingestion', () => {
  it('counts pages of a generated pdf locally', async () => {
    expect(await bal_pdf_page_count(bal_two_page_pdf())).toBe(2);
  });

  it('renders every page through the injected renderer without trusting order', async () => {
    const bal_bytes = bal_two_page_pdf();
    const bal_source = {
      name: 'batch-a.pdf',
      bytes: new Blob([new Uint8Array(bal_bytes)], { type: 'application/pdf' })
    };
    const bal_calls: number[] = [];
    const bal_rendered = await bal_render_pdf_pages(
      bal_source,
      async (_bal_page, bal_viewport, bal_page_number) => {
        bal_calls.push(bal_page_number);
        expect(bal_viewport.width).toBeGreaterThan(1000);
        return {
          bytes: new Blob([new TextEncoder().encode(`page-${bal_page_number}`)]),
          widthPx: Math.round(bal_viewport.width),
          heightPx: Math.round(bal_viewport.height)
        };
      }
    );
    expect(bal_calls).toEqual([1, 2]);
    expect(bal_rendered).toHaveLength(2);
    expect(bal_rendered[0].name).toBe('batch-a.pdf — page 1');
    expect(bal_rendered[1].name).toBe('batch-a.pdf — page 2');
    const bal_first_text = await bal_rendered[0].bytes.text();
    expect(bal_first_text).toBe('page-1');
  });
});
