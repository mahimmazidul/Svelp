export interface bal_ScanMinimums {
  bubbleDiameterMm: number;
  bubbleCellMm: number;
  bubbleCenterGapMm: number;
  matrixRowHeightMm: number;
  optionRowHeightMm: number;
  qrSizeMm: number;
  qrQuietZoneMm: number;
  alignmentMarkerMm: number;
  alignmentMarkerInsetMm: number;
  marginMm: number;
  markRegionGapMm: number;
}

export const BAL_SCAN_MIN: bal_ScanMinimums = {
  bubbleDiameterMm: 3.6,
  bubbleCellMm: 5.2,
  bubbleCenterGapMm: 2.4,
  matrixRowHeightMm: 6,
  optionRowHeightMm: 5.2,
  qrSizeMm: 12,
  qrQuietZoneMm: 2,
  alignmentMarkerMm: 5,
  alignmentMarkerInsetMm: 5,
  marginMm: 15,
  markRegionGapMm: 1.6
};

export interface bal_DensityMarkProfile {
  bubbleDiameterMm: number;
  bubbleCellMm: number;
  qrSizeMm: number;
  alignmentMarkerMm: number;
}

export const BAL_DENSITY_MARKS: Record<string, bal_DensityMarkProfile> = {
  comfortable: { bubbleDiameterMm: 4.8, bubbleCellMm: 7.6, qrSizeMm: 20, alignmentMarkerMm: 7 },
  compact: { bubbleDiameterMm: 4.4, bubbleCellMm: 6.4, qrSizeMm: 18, alignmentMarkerMm: 7 },
  dense: { bubbleDiameterMm: 3.8, bubbleCellMm: 5.4, qrSizeMm: 14, alignmentMarkerMm: 6 }
};

export function bal_effective_marks(bal_density: string): bal_DensityMarkProfile {
  return BAL_DENSITY_MARKS[bal_density] ?? BAL_DENSITY_MARKS.compact;
}
