import type { BlankReferenceRecord } from '../../models/response_models';
import { bal_build_print_document, type bal_PrintDocument, type bal_PrintRenderPage } from '../print/print_layout';
import { bal_page_svg } from '../print/print_svg';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';

export const BAL_BLANK_PX_PER_MM = 5.9;

export type bal_BlankRenderer = (
  bal_page: bal_PrintRenderPage,
  bal_doc: bal_PrintDocument
) => Promise<Blob>;

export function bal_blank_reference_id(bal_fingerprint: string, bal_page_number: number): string {
  return `${bal_fingerprint}:${bal_page_number}`;
}

async function bal_rasterize_svg(bal_svg: string, bal_width: number, bal_height: number): Promise<Blob> {
  const bal_url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bal_svg)}`;
  const bal_bitmap = await new Promise<ImageBitmap>((bal_resolve, bal_reject) => {
    const bal_image = new Image();
    bal_image.onload = () => {
      bal_resolve(bal_image as unknown as ImageBitmap);
    };
    bal_image.onerror = () => bal_reject(new Error('Blank page rendering failed.'));
    bal_image.src = bal_url;
  });
  const bal_canvas = document.createElement('canvas');
  bal_canvas.width = bal_width;
  bal_canvas.height = bal_height;
  const bal_ctx = bal_canvas.getContext('2d');
  if (!bal_ctx) throw new Error('Canvas is unavailable for blank rendering.');
  bal_ctx.fillStyle = '#ffffff';
  bal_ctx.fillRect(0, 0, bal_width, bal_height);
  bal_ctx.drawImage(bal_bitmap as CanvasImageSource, 0, 0, bal_width, bal_height);
  return await new Promise<Blob>((bal_resolve, bal_reject) => {
    bal_canvas.toBlob((bal_blob) => {
      if (bal_blob) bal_resolve(bal_blob);
      else bal_reject(new Error('Blank page encoding failed.'));
    }, 'image/png');
  });
}

export function bal_default_blank_renderer(): bal_BlankRenderer {
  return async (bal_page, bal_doc) => {
    const bal_svg = bal_page_svg(bal_page, bal_doc, null);
    const bal_width = Math.round(bal_page.regions.width * BAL_BLANK_PX_PER_MM);
    const bal_height = Math.round(bal_page.regions.height * BAL_BLANK_PX_PER_MM);
    return await bal_rasterize_svg(bal_svg, bal_width, bal_height);
  };
}

export async function bal_ensure_blank_references(
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[],
  bal_respondent_id: string,
  bal_cached: BlankReferenceRecord[],
  bal_render: bal_BlankRenderer
): Promise<BlankReferenceRecord[]> {
  const bal_doc = bal_build_print_document({
    questionnaire: bal_questionnaire,
    scales: bal_scales,
    respondentId: bal_respondent_id
  });
  const bal_by_id = new Map(bal_cached.map((bal_record) => [bal_record.id, bal_record]));
  const bal_result: BlankReferenceRecord[] = [];
  for (const bal_page of bal_doc.pages) {
    const bal_id = bal_blank_reference_id(bal_doc.fingerprint, bal_page.pageNumber);
    const bal_existing = bal_by_id.get(bal_id);
    if (
      bal_existing &&
      bal_existing.widthPx === Math.round(bal_page.regions.width * BAL_BLANK_PX_PER_MM) &&
      bal_existing.heightPx === Math.round(bal_page.regions.height * BAL_BLANK_PX_PER_MM)
    ) {
      bal_result.push(bal_existing);
      continue;
    }
    const bal_bytes = await bal_render(bal_page, bal_doc);
    bal_result.push({
      id: bal_id,
      fingerprint: bal_doc.fingerprint,
      pageNumber: bal_page.pageNumber,
      questionnaireVersion: bal_doc.questionnaireVersion,
      mime: bal_bytes.type || 'image/png',
      bytes: bal_bytes,
      widthPx: Math.round(bal_page.regions.width * BAL_BLANK_PX_PER_MM),
      heightPx: Math.round(bal_page.regions.height * BAL_BLANK_PX_PER_MM),
      createdAt: Date.now()
    });
  }
  return bal_result;
}
