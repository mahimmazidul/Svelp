export interface ExternalOverlayRequest {
  pdfBytes: Uint8Array;
  geometry: () => Promise<import('./print_layout').PrintLayoutGeometry>;
  includeIdentifiers: boolean;
  includeAlignmentMarkers: boolean;
}

export interface ExternalOverlayResult {
  pdfBytes: Uint8Array;
  stampedPages: number;
}

export async function vorki_prepare_external_overlay(
  _bal_request: ExternalOverlayRequest
): Promise<ExternalOverlayResult> {
  throw new Error('Overlaying identifiers onto external PDFs arrives in a later release.');
}

export function vorki_is_supported(): boolean {
  return false;
}
