import { bal_qr_matrix } from '../print/print_qr';

export interface bal_SyntheticImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface bal_CanonicalSpec {
  widthMm: number;
  heightMm: number;
  markerRects: { x: number; y: number; width: number; height: number }[];
  qrRect: { x: number; y: number; width: number; height: number };
  qrPayload: string;
}

export function bal_canonical_spec(
  bal_payload: string,
  bal_landscape = false
): bal_CanonicalSpec {
  const bal_width = bal_landscape ? 297 : 210;
  const bal_height = bal_landscape ? 210 : 297;
  const bal_inset = Math.max(5, 16 / 2 - 3.5);
  const bal_marker = 7;
  const bal_right = bal_width - bal_inset - bal_marker;
  const bal_bottom = bal_height - bal_inset - bal_marker;
  const bal_qr_size = 20;
  return {
    widthMm: bal_width,
    heightMm: bal_height,
    markerRects: [
      { x: bal_inset, y: bal_inset, width: bal_marker, height: bal_marker },
      { x: bal_right, y: bal_inset, width: bal_marker, height: bal_marker },
      { x: bal_inset, y: bal_bottom, width: bal_marker, height: bal_marker },
      { x: bal_right, y: bal_bottom, width: bal_marker, height: bal_marker }
    ],
    qrRect: { x: bal_width - 16 - bal_qr_size, y: bal_height - 18 - bal_qr_size, width: bal_qr_size, height: bal_qr_size },
    qrPayload: bal_payload
  };
}

export function bal_render_canonical_page(
  bal_spec: bal_CanonicalSpec,
  bal_px_per_mm: number
): bal_SyntheticImage {
  const bal_width = Math.round(bal_spec.widthMm * bal_px_per_mm);
  const bal_height = Math.round(bal_spec.heightMm * bal_px_per_mm);
  const bal_data = new Uint8ClampedArray(bal_width * bal_height * 4).fill(255);
  const bal_fill = (
    bal_rect: { x: number; y: number; width: number; height: number },
    bal_value: number
  ): void => {
    const bal_x0 = Math.round(bal_rect.x * bal_px_per_mm);
    const bal_y0 = Math.round(bal_rect.y * bal_px_per_mm);
    const bal_x1 = Math.round((bal_rect.x + bal_rect.width) * bal_px_per_mm);
    const bal_y1 = Math.round((bal_rect.y + bal_rect.height) * bal_px_per_mm);
    for (let bal_y = Math.max(0, bal_y0); bal_y < Math.min(bal_height, bal_y1); bal_y++) {
      for (let bal_x = Math.max(0, bal_x0); bal_x < Math.min(bal_width, bal_x1); bal_x++) {
        const bal_index = (bal_y * bal_width + bal_x) * 4;
        bal_data[bal_index] = bal_value;
        bal_data[bal_index + 1] = bal_value;
        bal_data[bal_index + 2] = bal_value;
      }
    }
  };
  for (let bal_i = 0; bal_i < 14; bal_i++) {
    bal_fill({ x: 18, y: 24 + bal_i * 7, width: bal_spec.widthMm - 36, height: 1.4 }, 120);
  }
  bal_fill({ x: 18, y: 130, width: 120, height: 1.4 }, 150);
  for (const bal_marker of bal_spec.markerRects) bal_fill(bal_marker, 0);

  const bal_qr = bal_qr_matrix(bal_spec.qrPayload);
  const bal_quiet = 4;
  const bal_total = bal_qr.length + bal_quiet * 2;
  const bal_module = bal_spec.qrRect.width / bal_total;
  for (let bal_row = 0; bal_row < bal_qr.length; bal_row++) {
    for (let bal_col = 0; bal_col < bal_qr.length; bal_col++) {
      if (!bal_qr[bal_row][bal_col]) continue;
      bal_fill(
        {
          x: bal_spec.qrRect.x + (bal_col + bal_quiet) * bal_module,
          y: bal_spec.qrRect.y + (bal_row + bal_quiet) * bal_module,
          width: bal_module,
          height: bal_module
        },
        0
      );
    }
  }
  return { data: bal_data, width: bal_width, height: bal_height };
}

export function bal_rotate_image(
  bal_image: bal_SyntheticImage,
  bal_degrees: 0 | 90 | 180 | 270
): bal_SyntheticImage {
  if (bal_degrees === 0) return bal_image;
  const bal_swap = bal_degrees === 90 || bal_degrees === 270;
  const bal_width = bal_swap ? bal_image.height : bal_image.width;
  const bal_height = bal_swap ? bal_image.width : bal_image.height;
  const bal_out = new Uint8ClampedArray(bal_width * bal_height * 4).fill(255);
  for (let bal_y = 0; bal_y < bal_image.height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_image.width; bal_x++) {
      let bal_nx = 0;
      let bal_ny = 0;
      if (bal_degrees === 90) {
        bal_nx = bal_image.height - 1 - bal_y;
        bal_ny = bal_x;
      } else if (bal_degrees === 180) {
        bal_nx = bal_image.width - 1 - bal_x;
        bal_ny = bal_image.height - 1 - bal_y;
      } else {
        bal_nx = bal_y;
        bal_ny = bal_image.width - 1 - bal_x;
      }
      const bal_from = (bal_y * bal_image.width + bal_x) * 4;
      const bal_to = (bal_ny * bal_width + bal_nx) * 4;
      bal_out[bal_to] = bal_image.data[bal_from];
      bal_out[bal_to + 1] = bal_image.data[bal_from + 1];
      bal_out[bal_to + 2] = bal_image.data[bal_from + 2];
      bal_out[bal_to + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_width, height: bal_height };
}

export function bal_box_blur(bal_image: bal_SyntheticImage, bal_radius: number): bal_SyntheticImage {
  const bal_gray = bal_to_gray(bal_image);
  const bal_out = new Uint8ClampedArray(bal_image.data);
  const bal_size = bal_radius * 2 + 1;
  for (let bal_y = bal_radius; bal_y < bal_image.height - bal_radius; bal_y++) {
    for (let bal_x = bal_radius; bal_x < bal_image.width - bal_radius; bal_x++) {
      let bal_sum = 0;
      for (let bal_dy = -bal_radius; bal_dy <= bal_radius; bal_dy++) {
        for (let bal_dx = -bal_radius; bal_dx <= bal_radius; bal_dx++) {
          bal_sum += bal_gray[(bal_y + bal_dy) * bal_image.width + bal_x + bal_dx];
        }
      }
      const bal_value = Math.round(bal_sum / (bal_size * bal_size));
      const bal_index = (bal_y * bal_image.width + bal_x) * 4;
      bal_out[bal_index] = bal_value;
      bal_out[bal_index + 1] = bal_value;
      bal_out[bal_index + 2] = bal_value;
    }
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_scale_image(
  bal_image: bal_SyntheticImage,
  bal_factor: number
): bal_SyntheticImage {
  const bal_width = Math.max(1, Math.round(bal_image.width * bal_factor));
  const bal_height = Math.max(1, Math.round(bal_image.height * bal_factor));
  const bal_out = new Uint8ClampedArray(bal_width * bal_height * 4).fill(255);
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      const bal_sx = Math.min(bal_image.width - 1, Math.round(bal_x / bal_factor));
      const bal_sy = Math.min(bal_image.height - 1, Math.round(bal_y / bal_factor));
      const bal_from = (bal_sy * bal_image.width + bal_sx) * 4;
      const bal_to = (bal_y * bal_width + bal_x) * 4;
      bal_out[bal_to] = bal_image.data[bal_from];
      bal_out[bal_to + 1] = bal_image.data[bal_from + 1];
      bal_out[bal_to + 2] = bal_image.data[bal_from + 2];
      bal_out[bal_to + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_width, height: bal_height };
}

export function bal_shift_exposure(bal_image: bal_SyntheticImage, bal_delta: number): bal_SyntheticImage {
  const bal_out = new Uint8ClampedArray(bal_image.data.length);
  for (let bal_i = 0; bal_i < bal_image.data.length; bal_i += 4) {
    const bal_value = Math.max(0, Math.min(255, bal_image.data[bal_i] + bal_delta));
    bal_out[bal_i] = bal_value;
    bal_out[bal_i + 1] = bal_value;
    bal_out[bal_i + 2] = bal_value;
    bal_out[bal_i + 3] = 255;
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_crop_image(
  bal_image: bal_SyntheticImage,
  bal_inset: number
): bal_SyntheticImage {
  const bal_width = bal_image.width - bal_inset;
  const bal_height = bal_image.height;
  const bal_out = new Uint8ClampedArray(bal_width * bal_height * 4).fill(255);
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      const bal_from = (bal_y * bal_image.width + bal_x) * 4;
      const bal_to = (bal_y * bal_width + bal_x) * 4;
      bal_out[bal_to] = bal_image.data[bal_from];
      bal_out[bal_to + 1] = bal_image.data[bal_from + 1];
      bal_out[bal_to + 2] = bal_image.data[bal_from + 2];
      bal_out[bal_to + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_width, height: bal_height };
}

export function bal_add_glare_spot(
  bal_image: bal_SyntheticImage,
  bal_cx: number,
  bal_cy: number,
  bal_radius: number
): bal_SyntheticImage {
  const bal_out = new Uint8ClampedArray(bal_image.data);
  for (let bal_y = Math.max(0, bal_cy - bal_radius); bal_y < Math.min(bal_image.height, bal_cy + bal_radius); bal_y++) {
    for (let bal_x = Math.max(0, bal_cx - bal_radius); bal_x < Math.min(bal_image.width, bal_cx + bal_radius); bal_x++) {
      const bal_distance = Math.hypot(bal_x - bal_cx, bal_y - bal_cy);
      if (bal_distance > bal_radius) continue;
      const bal_index = (bal_y * bal_image.width + bal_x) * 4;
      bal_out[bal_index] = 255;
      bal_out[bal_index + 1] = 255;
      bal_out[bal_index + 2] = 255;
    }
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_to_gray(bal_image: bal_SyntheticImage): Uint8Array {
  const bal_gray = new Uint8Array(bal_image.width * bal_image.height);
  for (let bal_i = 0, bal_j = 0; bal_i < bal_image.data.length; bal_i += 4, bal_j++) {
    bal_gray[bal_j] = Math.round(
      0.299 * bal_image.data[bal_i] + 0.587 * bal_image.data[bal_i + 1] + 0.114 * bal_image.data[bal_i + 2]
    );
  }
  return bal_gray;
}
