import type { bal_MarkSpec, bal_MarkStyle, bal_ReadingRegion } from '../reading/reading_fixtures';
import {
  type bal_ExpectedStatus,
  type bal_GroundTruthAnswer,
  type bal_GroundTruthPage
} from './calibration_ground_truth';

export interface bal_MarkInstruction {
  variableName: string;
  optionIndex?: number;
  row?: number;
  column?: number;
  style: bal_MarkStyle;
}

export interface bal_AnswerPlan {
  variableName: string;
  row?: number;
  expected: bal_ExpectedStatus;
  expectedOptionIndexes?: number[];
}

export interface bal_PagePlanResult {
  marks: bal_MarkSpec[];
  groundTruth: bal_GroundTruthPage;
  issues: string[];
}

interface bal_GroupedItem {
  itemId: string;
  variableName: string;
  kind: string;
  optionIds: string[];
  rowIds: string[];
  columnIds: string[];
  regions: bal_ReadingRegion[];
}

export function bal_group_regions(bal_regions: bal_ReadingRegion[]): Map<string, bal_GroupedItem> {
  const bal_groups = new Map<string, bal_GroupedItem>();
  for (const bal_region of bal_regions) {
    const bal_key = bal_region.variableName ?? bal_region.itemId;
    let bal_group = bal_groups.get(bal_key);
    if (!bal_group) {
      bal_group = {
        itemId: bal_region.itemId,
        variableName: bal_key,
        kind: bal_region.kind,
        optionIds: [],
        rowIds: [],
        columnIds: [],
        regions: []
      };
      bal_groups.set(bal_key, bal_group);
    }
    if (!bal_group.regions.includes(bal_region)) bal_group.regions.push(bal_region);
    if (bal_region.kind === 'matrix') {
      if (bal_region.rowId && !bal_group.rowIds.includes(bal_region.rowId)) bal_group.rowIds.push(bal_region.rowId);
      if (bal_region.columnId && !bal_group.columnIds.includes(bal_region.columnId)) bal_group.columnIds.push(bal_region.columnId);
    } else if (bal_region.optionId && !bal_group.optionIds.includes(bal_region.optionId)) {
      bal_group.optionIds.push(bal_region.optionId);
    }
  }
  return bal_groups;
}

function bal_region_for_mark(
  bal_group: bal_GroupedItem,
  bal_instruction: bal_MarkInstruction
): bal_ReadingRegion | null {
  if (bal_instruction.row !== undefined) {
    const bal_row_id = bal_group.rowIds[bal_instruction.row];
    const bal_column_id = bal_group.columnIds[bal_instruction.column ?? 0];
    if (!bal_row_id || !bal_column_id) return null;
    return (
      bal_group.regions.find(
        (bal_region) => bal_region.rowId === bal_row_id && bal_region.columnId === bal_column_id
      ) ?? null
    );
  }
  const bal_option_id = bal_group.optionIds[bal_instruction.optionIndex ?? 0];
  if (!bal_option_id) return null;
  return bal_group.regions.find((bal_region) => bal_region.optionId === bal_option_id) ?? null;
}

export function bal_build_page_plan(
  bal_page_number: number,
  bal_qr_payload: string,
  bal_regions: bal_ReadingRegion[],
  bal_marks: bal_MarkInstruction[],
  bal_answers: bal_AnswerPlan[]
): bal_PagePlanResult {
  const bal_groups = bal_group_regions(bal_regions);
  const bal_issues: string[] = [];
  const bal_marks_out: bal_MarkSpec[] = [];
  for (const bal_instruction of bal_marks) {
    const bal_group = bal_groups.get(bal_instruction.variableName);
    if (!bal_group) {
      bal_issues.push(`unknown item ${bal_instruction.variableName}`);
      continue;
    }
    const bal_region = bal_region_for_mark(bal_group, bal_instruction);
    if (!bal_region) {
      bal_issues.push(`no region for ${bal_instruction.variableName} mark`);
      continue;
    }
    bal_marks_out.push({ regionIndex: bal_regions.indexOf(bal_region), style: bal_instruction.style });
  }

  const bal_gt_answers: bal_GroundTruthAnswer[] = [];
  for (const bal_answer of bal_answers) {
    const bal_group = bal_groups.get(bal_answer.variableName);
    if (!bal_group) {
      bal_issues.push(`unknown item ${bal_answer.variableName} in answer plan`);
      continue;
    }
    const bal_row_id = bal_answer.row !== undefined ? (bal_group.rowIds[bal_answer.row] ?? null) : null;
    let bal_expected_value: string[] = [];
    if (bal_answer.expected === 'accept') {
      bal_expected_value = (bal_answer.expectedOptionIndexes ?? []).map((bal_index) => {
        const bal_id = bal_answer.row !== undefined ? bal_group.columnIds[bal_index] : bal_group.optionIds[bal_index];
        if (!bal_id) bal_issues.push(`missing expected id for ${bal_answer.variableName} index ${bal_index}`);
        return bal_id ?? '';
      });
    } else if (bal_answer.expected === 'multiple' || bal_answer.expected === 'ambiguous') {
      bal_expected_value = (bal_answer.expectedOptionIndexes ?? []).map((bal_index) => {
        const bal_id = bal_answer.row !== undefined ? bal_group.columnIds[bal_index] : bal_group.optionIds[bal_index];
        return bal_id ?? '';
      });
    }
    bal_gt_answers.push({
      itemId: bal_group.itemId,
      rowId: bal_row_id,
      expectedStatus: bal_answer.expected,
      expectedValue: bal_expected_value
    });
  }

  return {
    marks: bal_marks_out,
    groundTruth: {
      pageNumber: bal_page_number,
      qrPayload: bal_qr_payload,
      answers: bal_gt_answers
    },
    issues: bal_issues
  };
}
