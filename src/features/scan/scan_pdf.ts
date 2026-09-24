export interface bal_PdfPageSource {
  name: string;
  bytes: Blob;
}

export interface bal_PdfPageRendered {
  name: string;
  pageNumber: number;
  bytes: Blob;
  widthPx: number;
  heightPx: number;
}

export async function bal_load_pdf_document(bal_bytes: ArrayBuffer) {
  const bal_pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bal_doc = await bal_pdfjs.getDocument({ data: new Uint8Array(bal_bytes) }).promise;
  return bal_doc;
}

export async function bal_pdf_page_count(bal_bytes: ArrayBuffer): Promise<number> {
  const bal_doc = await bal_load_pdf_document(bal_bytes);
  const bal_count = bal_doc.numPages;
  await bal_doc.destroy();
  return bal_count;
}

export async function bal_render_pdf_pages(
  bal_source: bal_PdfPageSource,
  bal_render_page: (
    bal_page: unknown,
    bal_viewport: { width: number; height: number },
    bal_page_number: number
  ) => Promise<{ bytes: Blob; widthPx: number; heightPx: number }>,
  bal_target_px_per_mm = 5.9
): Promise<bal_PdfPageRendered[]> {
  const bal_bytes = await bal_source.bytes.arrayBuffer();
  const bal_doc = await bal_load_pdf_document(bal_bytes);
  const bal_rendered: bal_PdfPageRendered[] = [];
  try {
    for (let bal_number = 1; bal_number <= bal_doc.numPages; bal_number++) {
      const bal_page = await bal_doc.getPage(bal_number);
      const bal_viewport = bal_page.getViewport({ scale: 1 });
      const bal_scale = (bal_target_px_per_mm * 72) / 25.4;
      const bal_scaled = bal_page.getViewport({ scale: bal_scale });
      const bal_result = await bal_render_page(
        { page: bal_page, viewport: bal_scaled, unscaled: bal_viewport },
        { width: bal_scaled.width, height: bal_scaled.height },
        bal_number
      );
      bal_rendered.push({
        name: `${bal_source.name} — page ${bal_number}`,
        pageNumber: bal_number,
        bytes: bal_result.bytes,
        widthPx: bal_result.widthPx,
        heightPx: bal_result.heightPx
      });
    }
  } finally {
    await bal_doc.destroy();
  }
  return bal_rendered;
}

export function bal_browser_pdf_page_renderer(): (
  bal_page: unknown,
  bal_viewport: { width: number; height: number },
  bal_page_number: number
) => Promise<{ bytes: Blob; widthPx: number; heightPx: number }> {
  return async (bal_page, bal_viewport) => {
    const bal_typed = bal_page as {
      page: { render: (bal_options: unknown) => { promise: Promise<void> } };
      viewport: unknown;
    };
    const bal_canvas = document.createElement('canvas');
    bal_canvas.width = Math.round(bal_viewport.width);
    bal_canvas.height = Math.round(bal_viewport.height);
    const bal_context = bal_canvas.getContext('2d') as CanvasRenderingContext2D;
    await bal_typed.page.render({ canvasContext: bal_context, viewport: bal_typed.viewport }).promise;
    const bal_blob = await new Promise<Blob | null>((bal_resolve) =>
      bal_canvas.toBlob((bal_result) => bal_resolve(bal_result), 'image/jpeg', 0.92)
    );
    if (!bal_blob) throw new Error('The PDF page could not be rendered.');
    return { bytes: bal_blob, widthPx: bal_canvas.width, heightPx: bal_canvas.height };
  };
}
