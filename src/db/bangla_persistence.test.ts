import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bal_clear } from './client';
import { bal_save_questionnaire, dhon_questionnaire_by_project } from './questionnaires_repo';
import { bal_save_project, dhon_project } from './projects_repo';
import { bal_save_scale, ken_pori_scales } from './scales_repo';
import type { QuestionnaireRecord } from '../models/types';
import {
  BAL_BN_DESCRIPTION,
  BAL_BN_MATRIX_COLUMNS,
  BAL_BN_MATRIX_ROWS,
  BAL_BN_Q_MATRIX,
  BAL_BN_SECTION,
  BAL_BN_SHAPING_WORDS,
  BAL_BN_TITLE,
  BAL_BN_UNIT_YEARS,
  bal_bangla_survey,
  bal_frequency_scale_bn
} from '../test/bangla_fixtures';

async function bal_reset(): Promise<void> {
  await bal_clear('projects');
  await bal_clear('questionnaires');
  await bal_clear('responseScales');
}

describe('bangla questionnaire persistence', () => {
  beforeEach(async () => {
    await bal_reset();
  });

  it('stores and reloads a full bangla questionnaire with exact unicode', async () => {
    await bal_save_project({
      id: 'p-bn',
      title: 'খাদ্য অপচয় গবেষণা',
      description: BAL_BN_DESCRIPTION,
      status: 'active',
      createdAt: 1,
      updatedAt: 1
    });
    const bal_scale = bal_frequency_scale_bn();
    await bal_save_scale(bal_scale);
    const bal_q = bal_bangla_survey();
    await bal_save_questionnaire(bal_q);

    const bal_reloaded = await dhon_questionnaire_by_project('p-bn');
    expect(bal_reloaded).toBeDefined();
    expect(bal_reloaded?.title).toBe(BAL_BN_TITLE);
    expect(bal_reloaded?.description).toBe(BAL_BN_DESCRIPTION);
    expect(bal_reloaded?.sections[0].title).toBe(BAL_BN_SECTION);

    const bal_flat = (bal_reloaded?.sections ?? []).flatMap((bal_s) => bal_s.items);
    const bal_matrix = bal_flat.find((bal_i) => bal_i.variableName === 'food_frequency_bn');
    expect(bal_matrix?.label).toBe(BAL_BN_Q_MATRIX);
    expect(bal_matrix?.rows.map((bal_r) => bal_r.label)).toEqual(BAL_BN_MATRIX_ROWS);
    expect(bal_matrix?.columns.map((bal_c) => bal_c.label)).toEqual(BAL_BN_MATRIX_COLUMNS);

    const bal_age = bal_flat.find((bal_i) => bal_i.variableName === 'age');
    expect(bal_age?.unitLabel).toBe(BAL_BN_UNIT_YEARS);
    expect(bal_age?.label).toContain('বয়স');

    const bal_consent = bal_flat.find((bal_i) => bal_i.type === 'consent');
    expect(bal_consent?.consent?.introduction).toContain('স্বেচ্ছায়');
    expect(bal_consent?.consent?.sections[0].body).toContain('ক্ষয়ক্ষতি');

    const bal_scales = await ken_pori_scales();
    const bal_bn_scale = bal_scales.find((bal_s) => bal_s.id === 'scale-bn-frequency');
    expect(bal_bn_scale?.options.map((bal_o) => bal_o.label)).toEqual([
      'কখনও না',
      'মাসে ১–৩ বার',
      'সপ্তাহে একবার',
      'সপ্তাহে ২–৪ বার',
      'প্রতিদিন'
    ]);
  });

  it('keeps ids and ascii variable names stable while labels stay bangla', async () => {
    const bal_q = bal_bangla_survey();
    await bal_save_questionnaire(bal_q);
    const bal_reloaded = await dhon_questionnaire_by_project('p-bn');
    const bal_before = (bal_reloaded?.sections ?? []).flatMap((bal_s) => bal_s.items);

    const bal_edited = JSON.parse(JSON.stringify(bal_q)) as QuestionnaireRecord;
    const bal_flat_edited = bal_edited.sections.flatMap((bal_s) => bal_s.items);
    bal_flat_edited[0].label = `${'বয়স পরিবর্তিত'} (age changed)`;
    await bal_save_questionnaire(bal_edited);
    const bal_after = ((await dhon_questionnaire_by_project('p-bn'))?.sections ?? []).flatMap(
      (bal_s) => bal_s.items
    );
    expect(bal_after.map((bal_i) => bal_i.id)).toEqual(bal_before.map((bal_i) => bal_i.id));
    for (const bal_item of bal_after) {
      if (bal_item.variableName !== null) {
        expect(bal_item.variableName).toMatch(/^[a-z_][a-z0-9_]*$/);
      }
    }
  });

  it('retains shaping stress words byte for byte after persistence', async () => {
    await bal_save_project({
      id: 'p-shape',
      title: BAL_BN_SHAPING_WORDS.join(' · '),
      description: BAL_BN_SHAPING_WORDS[BAL_BN_SHAPING_WORDS.length - 1],
      status: 'active',
      createdAt: 1,
      updatedAt: 1
    });
    const bal_project = await dhon_project('p-shape');
    expect([...(bal_project?.title ?? '')].length).toBeGreaterThan(40);
    expect(bal_project?.title.split(' · ')).toEqual(BAL_BN_SHAPING_WORDS);
    const bal_codepoints = [...(bal_project?.title ?? '')].map((bal_ch) => bal_ch.codePointAt(0));
    expect(bal_codepoints).toEqual([...BAL_BN_SHAPING_WORDS.join(' · ')].map((bal_ch) => bal_ch.codePointAt(0)));
  });
});
