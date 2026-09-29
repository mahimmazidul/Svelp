import type { ResponseRecord } from '../../models/response_models';
import { dhon_scan_asset } from '../../db/scan_repo';
import type { bal_SyntheticPage } from './reading_fixtures';

export interface bal_CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BAL_CROP_CONTEXT_FACTOR = 2.4;
const BAL_CROP_MAX_EDGE = 320;

export async function bal_crop_from_blob(
  bal_blob: Blob,
  bal_rect: bal_CropRect,
  bal_max_edge = BAL_CROP_MAX_EDGE
): Promise<string | null> {
  const bal_bitmap = await createImageBitmap(bal_blob);
  try {
    const bal_margin_x = (bal_rect.width * (BAL_CROP_CONTEXT_FACTOR - 1)) / 2;
    const bal_margin_y = (bal_rect.height * (BAL_CROP_CONTEXT_FACTOR - 1)) / 2;
    const bal_x = Math.max(0, Math.round((bal_rect.x - bal_margin_x) * bal_bitmap.width));
    const bal_y = Math.max(0, Math.round((bal_rect.y - bal_margin_y) * bal_bitmap.height));
    const bal_w = Math.min(bal_bitmap.width - bal_x, Math.round((bal_rect.width + bal_margin_x * 2) * bal_bitmap.width));
    const bal_h = Math.min(bal_bitmap.height - bal_y, Math.round((bal_rect.height + bal_margin_y * 2) * bal_bitmap.height));
    if (bal_w <= 0 || bal_h <= 0) return null;
    const bal_scale = Math.min(1, bal_max_edge / Math.max(bal_w, bal_h));
    const bal_canvas = document.createElement('canvas');
    bal_canvas.width = Math.max(1, Math.round(bal_w * bal_scale));
    bal_canvas.height = Math.max(1, Math.round(bal_h * bal_scale));
    const bal_ctx = bal_canvas.getContext('2d');
    if (!bal_ctx) return null;
    bal_ctx.imageSmoothingEnabled = true;
    bal_ctx.drawImage(bal_bitmap, bal_x, bal_y, bal_w, bal_h, 0, 0, bal_canvas.width, bal_canvas.height);
    return bal_canvas.toDataURL('image/png');
  } finally {
    bal_bitmap.close();
  }
}

export async function bal_page_crop(
  bal_asset_id: string,
  bal_rect: bal_CropRect,
  bal_max_edge = BAL_CROP_MAX_EDGE
): Promise<string | null> {
  const bal_asset = await dhon_scan_asset(bal_asset_id);
  if (!bal_asset) return null;
  return await bal_crop_from_blob(bal_asset.bytes, bal_rect, bal_max_edge);
}

export async function bal_response_crop(
  bal_response: ResponseRecord,
  bal_asset_id: string | null,
  bal_max_edge = BAL_CROP_MAX_EDGE
): Promise<string | null> {
  if (!bal_response.sourceRegionRect || !bal_asset_id) return null;
  const bal_asset = await dhon_scan_asset(bal_asset_id);
  if (!bal_asset) return null;
  return await bal_crop_from_blob(bal_asset.bytes, bal_response.sourceRegionRect, bal_max_edge);
}

export function bal_image_to_page(bal_bitmap: ImageBitmap): bal_SyntheticPage {
  const bal_canvas = document.createElement('canvas');
  bal_canvas.width = bal_bitmap.width;
  bal_canvas.height = bal_bitmap.height;
  const bal_ctx = bal_canvas.getContext('2d', { willReadFrequently: true });
  if (!bal_ctx) throw new Error('Canvas is unavailable.');
  bal_ctx.drawImage(bal_bitmap, 0, 0);
  const bal_data = bal_ctx.getImageData(0, 0, bal_bitmap.width, bal_bitmap.height);
  return { data: bal_data.data, width: bal_bitmap.width, height: bal_bitmap.height };
}

export function bal_default_image_decode(
  bal_blob: Blob
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return (async () => {
    const bal_bitmap = await createImageBitmap(bal_blob);
    try {
      const bal_page = bal_image_to_page(bal_bitmap);
      return { data: bal_page.data, width: bal_page.width, height: bal_page.height };
    } finally {
      bal_bitmap.close();
    }
  })();
}
