import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BAL_DB_VERSION, open_kala_joshim } from './client';

describe('local database migration to v6', () => {
  it('adds dataset snapshots while preserving responses', async () => {
    const { bal_clear, bal_put } = await import('./client');
    await bal_clear('responses');
    await bal_clear('datasetSnapshots');
    await bal_put('responses', {
      id: 'snap-check::i1',
      projectId: 'p-snap',
      batchId: null,
      questionnaireId: 'q1',
      questionnaireVersion: 1,
      respondentId: 'R-001',
      itemId: 'i1',
      variableName: 'water',
      itemType: 'single_choice',
      rowId: null,
      columnId: null,
      value: ['o1'],
      codedValue: null,
      status: 'accepted',
      confidence: 0.9,
      machineValue: null,
      machineStatus: null,
      machineConfidence: null,
      manuallyReviewed: false,
      validationIssues: [],
      sourcePageId: null,
      sourceRegionRect: null,
      algorithmVersion: 'R1',
      thresholdProfileName: 'default',
      recognitionRunId: null,
      createdAt: 1,
      updatedAt: 1
    });
    await bal_put('datasetSnapshots', {
      id: 'snap-1',
      projectId: 'p-snap',
      questionnaireId: 'q1',
      questionnaireVersion: 1,
      algorithmVersion: 'R1',
      profileName: 'default',
      respondentCount: 1,
      unresolvedCount: 0,
      missingPageRespondents: 0,
      counts: { autoAccepted: 1, reviewedCorrected: 0, blank: 0, needsReview: 0, manualOnly: 0, unreadable: 0 },
      exportConfig: { format: 'csv', optionColumns: true, bom: false, includeDiagnostics: false },
      svelpVersion: '0.1.0',
      createdAt: 1
    });
    const { ken_pori_responses_by_project, ken_pori_dataset_snapshots } = await import('./response_repo');
    expect(await ken_pori_responses_by_project('p-snap')).toHaveLength(1);
    const bal_snapshots = await ken_pori_dataset_snapshots('p-snap');
    expect(bal_snapshots).toHaveLength(1);
    expect(bal_snapshots[0].counts.autoAccepted).toBe(1);
    const bal_db = await open_kala_joshim();
    expect(bal_db.version).toBe(BAL_DB_VERSION);
    expect(bal_db.objectStoreNames.contains('datasetSnapshots')).toBe(true);
    expect(bal_db.objectStoreNames.contains('responses')).toBe(true);
    bal_db.close();
  });
});
