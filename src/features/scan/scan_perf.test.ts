import { describe, expect, it } from 'vitest';
import { bal_canonical_spec, bal_render_canonical_page } from './scan_fixtures';
import { bal_process_image } from './scan_engine';
import { bal_group_pages, bal_compute_summary } from '../../services/scan_service';
import type { ScanPageRecord } from '../../models/scan_models';

const BAL_PPM = 5.9;
const BAL_TOTAL = 200;

function bal_payload_list(): string[] {
  const bal_list: string[] = [];
  const bal_respondents = 40;
  for (let bal_r = 1; bal_r <= bal_respondents; bal_r++) {
    for (let bal_p = 1; bal_p <= 5; bal_p++) {
      bal_list.push(`S1|PERF|1|${String(bal_r).padStart(3, '0')}|${bal_p}`);
    }
  }
  for (let bal_extra = 0; bal_extra < BAL_TOTAL - bal_respondents * 5; bal_extra++) {
    bal_list.push(`S1|PERF|1|${String(bal_extra + 1).padStart(3, '0')}|1`);
  }
  return bal_list;
}

describe('large batch performance', () => {
  it(`processes ${BAL_TOTAL} images with stable timing and correct grouping`, () => {
    const bal_payloads = bal_payload_list();
    expect(bal_payloads.length).toBe(BAL_TOTAL);
    const bal_spec = {
      centersMm: [
        { x: 8.5, y: 8.5 },
        { x: 201.5, y: 8.5 },
        { x: 201.5, y: 288.5 },
        { x: 8.5, y: 288.5 }
      ],
      widthMm: 210,
      heightMm: 297,
      qrCenterMm: { x: 184, y: 269 }
    };
    let bal_warmup = 0;
    const bal_records: ScanPageRecord[] = [];
    const bal_started = performance.now();
    let bal_slowest = 0;
    for (let bal_i = 0; bal_i < bal_payloads.length; bal_i++) {
      const bal_page_start = performance.now();
      const bal_image = bal_render_canonical_page(bal_canonical_spec(bal_payloads[bal_i]), BAL_PPM);
      const bal_result = bal_process_image({
        imageData: bal_image,
        spec: bal_spec,
        outWidthPx: 1240,
        outHeightPx: 1754,
        pxPerMm: BAL_PPM
      });
      const bal_elapsed = performance.now() - bal_page_start;
      if (bal_i >= 10) bal_warmup += bal_elapsed;
      bal_slowest = Math.max(bal_slowest, bal_elapsed);
      bal_records.push({
        id: `page-${bal_i}`,
        batchId: 'b',
        projectId: 'p',
        questionnaireId: bal_result.payloads.length === 1 ? 'q-perf' : null,
        questionnaireVersion: bal_result.payloads.length === 1 ? 1 : null,
        respondentId: bal_result.payloads.length === 1 ? bal_result.payloads[0].split('|')[3] : null,
        pageNumber: bal_result.payloads.length === 1 ? Number(bal_result.payloads[0].split('|')[4]) : null,
        status:
          bal_result.payloads.length === 1 && bal_result.found && bal_result.quality.overallStatus !== 'error'
            ? 'ready'
            : 'needs-review',
        sourceAssetId: null,
        normalizedAssetId: null,
        sourceName: `img-${bal_i}.jpg`,
        sourceType: 'image',
        sourceHash: `h-${bal_i}`,
        sourceBytes: 1000,
        normalizedBytes: 1000,
        thumbSource: null,
        thumbNormalized: null,
        identitySource: null,
        payload: bal_result.payloads[0] ?? null,
        detectedPayloads: null,
        quality: bal_result.quality,
        alignment: null,
        transform: null,
        issues: [],
        errorMessage: null,
        processingMs: Math.round(bal_elapsed),
        createdAt: bal_i,
        updatedAt: bal_i
      });
    }
    const bal_total_s = (performance.now() - bal_started) / 1000;
    const bal_avg_ms = bal_warmup / (bal_payloads.length - 10);
    console.log(
      `perf: total ${bal_total_s.toFixed(1)}s, avg ${bal_avg_ms.toFixed(0)}ms/page, slowest ${Math.round(bal_slowest)}ms`
    );
    expect(bal_avg_ms).toBeLessThan(1500);
    const bal_ready = bal_records.filter((bal_record) => bal_record.status === 'ready');
    expect(bal_ready.length).toBe(BAL_TOTAL);
    const bal_summary = bal_compute_summary(bal_records);
    expect(bal_summary.ready).toBe(BAL_TOTAL);
    expect(bal_summary.respondents).toBe(40);
    const bal_groups = bal_group_pages(bal_records, new Map([['q-perf|1', 5]]));
    expect(bal_groups).toHaveLength(40);
    for (const bal_group of bal_groups) {
      expect(bal_group.pages).toHaveLength(5);
      expect(bal_group.missingPages).toEqual([]);
    }
  }, 300000);
});
