import type { AnswerMarkerType } from '../../models/item_catalog';
import type {
  ItemTypeName,
  PrintSettings,
  QuestionnaireItem,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import { derive_numbering } from '../../models/numbering';
import { dhon_matrix_columns } from '../../models/scale_options';
import { bal_wrap_text } from './print_fonts';
import { bal_normalize_print_settings } from './print_settings';
import {
  bal_alignment_marker_layouts,
  bal_normalized_rect,
  type AlignmentMarkerLayout,
  type NormalizedRect,
  type PageRegions,
  type PhysicalRect
} from './print_paper';
import { bal_paginate, type bal_PlacedChunk } from './print_paginate';
import type {
  bal_ConsentAckChunk,
  bal_MatrixRowChunk,
  bal_QuestionChunk
} from './print_blocks';
import {
  bal_clean_study_code,
  bal_human_readable,
  bal_identifier_payload,
  bal_qr_matrix
} from './print_qr';
import { bal_questionnaire_fingerprint } from './print_batch';

export interface AlignmentMarkerBox {
  corner: AlignmentMarkerLayout['corner'];
  rect: PhysicalRect;
  normalized: NormalizedRect;
}

export type AnswerRegionKind =
  | 'choice'
  | 'matrix'
  | 'consent'
  | 'text'
  | 'number'
  | 'date'
  | 'respondent';

export interface AnswerRegion {
  itemId: string;
  variableName: string | null;
  itemType: ItemTypeName;
  kind: AnswerRegionKind;
  optionId: string | null;
  optionCode: string | null;
  rowId: string | null;
  columnId: string | null;
  markerType: AnswerMarkerType;
  selection: 'single' | 'multiple' | 'written';
  pageNumber: number;
  rect: PhysicalRect;
  normalized: NormalizedRect;
}

export interface ItemBounds {
  itemId: string;
  sectionId: string;
  itemType: ItemTypeName;
  chunkKind: string;
  pageNumber: number;
  rect: PhysicalRect;
  normalized: NormalizedRect;
}

export interface PageIdentifierInfo {
  payload: string;
  humanReadable: string | null;
  qrBounds: PhysicalRect | null;
  normalized: NormalizedRect | null;
  moduleCount: number;
  quietZoneModules: number;
  textBounds: PhysicalRect | null;
}

export interface PageGeometry {
  pageNumber: number;
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
  contentBounds: PhysicalRect;
  safeBounds: PhysicalRect;
  headerBounds: PhysicalRect | null;
  footerBounds: PhysicalRect | null;
  respondentIdBounds: PhysicalRect | null;
  identifier: PageIdentifierInfo | null;
  alignmentMarkers: AlignmentMarkerBox[];
  itemBounds: ItemBounds[];
  answerRegions: AnswerRegion[];
}

export interface PrintLayoutGeometry {
  questionnaireId: string;
  questionnaireVersion: number;
  fingerprint: string;
  paperSize: QuestionnaireRecord['paperSize'];
  orientation: QuestionnaireRecord['orientation'];
  scannerMode: boolean;
  pageCount: number;
  pages: PageGeometry[];
}

export interface bal_HeaderRender {
  titleText: string | null;
  institutionText: string | null;
  versionText: string | null;
  studyCodeText: string | null;
  respondentBox: PhysicalRect | null;
  respondentLabel: string | null;
}

export interface bal_FooterRender {
  pageText: string | null;
  studyCodeText: string | null;
  confidentialityLines: string[];
  humanReadable: string | null;
}

export interface bal_PrintRenderPage {
  pageNumber: number;
  regions: PageRegions;
  chunks: bal_PlacedChunk[];
  header: bal_HeaderRender | null;
  footer: bal_FooterRender | null;
  identifier: PageIdentifierInfo | null;
  qrModules: boolean[][] | null;
  alignmentMarkers: AlignmentMarkerBox[];
  respondentIdBounds: PhysicalRect | null;
  geometry: PageGeometry;
}

export interface bal_PrintDocument {
  questionnaireTitle: string;
  questionnaireVersion: number;
  studyCode: string;
  fingerprint: string;
  settings: PrintSettings;
  pageCount: number;
  matrixMultipleItemIds: string[];
  pages: bal_PrintRenderPage[];
  geometry: PrintLayoutGeometry;
}

interface bal_MatrixContext {
  columns: { id: string; label: string; coding: string | null }[];
  multiple: boolean;
  variableName: string | null;
}

function bal_question_marker(
  bal_type: ItemTypeName
): { marker: AnswerMarkerType; selection: 'single' | 'multiple' } {
  if (bal_type === 'multiple_choice') return { marker: 'checkbox', selection: 'multiple' };
  return { marker: 'bubble', selection: 'single' };
}

function bal_written_kind(bal_type: ItemTypeName): AnswerRegionKind {
  if (bal_type === 'number') return 'number';
  if (bal_type === 'date') return 'date';
  return 'text';
}

export function bal_build_print_document(bal_input: {
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  respondentId?: string;
}): bal_PrintDocument {
  const bal_settings = bal_normalize_print_settings(bal_input.questionnaire.printSettings);
  const bal_respondent = bal_input.respondentId ?? '';
  const bal_fingerprint = bal_questionnaire_fingerprint(bal_input.questionnaire);
  const bal_layout = bal_paginate({
    questionnaire: bal_input.questionnaire,
    scales: bal_input.scales,
    margins: bal_settings.margins
  });
  const bal_numbering = derive_numbering(bal_input.questionnaire);
  const bal_code = bal_clean_study_code(
    bal_settings.header.studyCode || bal_input.questionnaire.title || 'SVE'
  );

  const bal_item_map = new Map<string, QuestionnaireItem>();
  for (const bal_section of bal_input.questionnaire.sections) {
    for (const bal_item of bal_section.items) bal_item_map.set(bal_item.id, bal_item);
  }
  const bal_matrix_context = new Map<string, bal_MatrixContext>();
  for (const bal_section of bal_input.questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      if (bal_item.type === 'matrix') {
        bal_matrix_context.set(bal_item.id, {
          columns: dhon_matrix_columns(bal_item, bal_input.scales),
          multiple: bal_item.selectionMode === 'multiple',
          variableName: bal_item.variableName
        });
      }
    }
  }

  const bal_pages: bal_PrintRenderPage[] = [];

  for (const bal_page of bal_layout.pages) {
    const bal_regions = bal_page.regions;
    const bal_header: bal_HeaderRender | null = bal_regions.header
      ? {
          titleText: bal_settings.header.showTitle
            ? bal_input.questionnaire.title
            : null,
          institutionText:
            bal_settings.header.showInstitution && bal_settings.header.institution.trim()
              ? bal_settings.header.institution.trim()
              : null,
          versionText: bal_settings.header.showVersion
            ? `Version ${bal_input.questionnaire.version}`
            : null,
          studyCodeText:
            bal_settings.header.showStudyCode && bal_settings.header.studyCode.trim()
              ? `Code ${bal_settings.header.studyCode.trim()}`
              : null,
          respondentBox:
            bal_settings.header.showRespondentId && bal_settings.respondentArea.enabled
              ? {
                  x: bal_regions.header.x + bal_regions.header.width - 40,
                  y: bal_regions.header.y + 0.5,
                  width: 40,
                  height: bal_regions.header.height - 1
                }
              : null,
          respondentLabel:
            bal_settings.header.showRespondentId && bal_settings.respondentArea.enabled
              ? bal_settings.respondentArea.label || bal_settings.header.respondentIdLabel
              : null
        }
      : null;

    const bal_page_count = bal_layout.pages.length;
    let bal_identifier: PageIdentifierInfo | null = null;
    let bal_qr_modules: boolean[][] | null = null;
    if (bal_settings.showMachineIdentifier && bal_regions.footer) {
      const bal_qr_size = bal_settings.identifier.sizeMm;
      const bal_identifier_input = {
        studyCode: bal_code,
        respondentId: bal_respondent,
        version: bal_input.questionnaire.version,
        pageNumber: bal_page.pageNumber,
        pageCount: bal_page_count
      };
      const bal_payload = bal_identifier_payload(bal_identifier_input);
      bal_qr_modules = bal_qr_matrix(bal_payload);
      const bal_qr_bounds: PhysicalRect = {
        x: bal_regions.footer.x + bal_regions.footer.width - bal_qr_size,
        y: bal_regions.footer.y + (bal_regions.footer.height - bal_qr_size) / 2,
        width: bal_qr_size,
        height: bal_qr_size
      };
      const bal_human = bal_settings.footer.showHumanIdentifier
        ? bal_human_readable(bal_identifier_input)
        : null;
      bal_identifier = {
        payload: bal_payload,
        humanReadable: bal_human,
        qrBounds: bal_qr_bounds,
        normalized: bal_normalized_rect(bal_qr_bounds, bal_regions.width, bal_regions.height),
        moduleCount: bal_qr_modules.length,
        quietZoneModules: 4,
        textBounds: bal_human
          ? {
              x: bal_regions.footer.x,
              y: bal_regions.footer.y + (bal_regions.footer.height - 10) / 2,
              width: Math.min(52, bal_regions.footer.width - bal_qr_size - 4),
              height: 5
            }
          : null
      };
    }

    const bal_footer: bal_FooterRender | null = bal_regions.footer
      ? {
          pageText: bal_settings.footer.showPageNumbers
            ? `Page ${bal_page.pageNumber} of ${bal_page_count}`
            : null,
          studyCodeText:
            bal_settings.footer.showStudyCode && bal_settings.header.studyCode.trim()
              ? bal_settings.header.studyCode.trim()
              : null,
          confidentialityLines:
            bal_settings.footer.confidentialityNote.trim().length > 0
              ? bal_wrap_text(
                  bal_settings.footer.confidentialityNote,
                  { family: bal_settings.theme.fontFamily, bold: false },
                  bal_settings.theme.baseFontSize,
                  Math.min(70, bal_regions.footer.width * 0.45)
                ).slice(0, 2)
              : [],
          humanReadable: bal_identifier?.humanReadable ?? null
        }
      : null;

    const bal_markers: AlignmentMarkerBox[] = bal_settings.scannerMode
      ? bal_alignment_marker_layouts(
          bal_regions.width,
          bal_regions.height,
          bal_settings.margins
        ).map((bal_m) => ({
          corner: bal_m.corner,
          rect: bal_m.rect,
          normalized: bal_normalized_rect(bal_m.rect, bal_regions.width, bal_regions.height)
        }))
      : [];

    const bal_item_bounds: ItemBounds[] = [];
    const bal_answer_regions: AnswerRegion[] = [];
    const bal_push_region = (
      bal_region: Omit<AnswerRegion, 'normalized' | 'pageNumber'> & { pageNumber?: number }
    ): void => {
      bal_answer_regions.push({
        ...bal_region,
        pageNumber: bal_page.pageNumber,
        normalized: bal_normalized_rect(bal_region.rect, bal_regions.width, bal_regions.height)
      });
    };

    if (bal_header?.respondentBox) {
      bal_push_region({
        itemId: 'respondent-id',
        variableName: null,
        itemType: 'short_text',
        kind: 'respondent',
        optionId: null,
        optionCode: null,
        rowId: null,
        columnId: null,
        markerType: 'line',
        selection: 'written',
        rect: bal_header.respondentBox
      });
    }

    for (const bal_placed of bal_page.chunks) {
      const bal_chunk = bal_placed.chunk;
      const bal_x = bal_regions.content.x;
      const bal_chunk_rect: PhysicalRect = {
        x: bal_x,
        y: bal_placed.y,
        width: bal_regions.content.width,
        height: bal_chunk.height
      };
      if (bal_chunk.itemId) {
        bal_item_bounds.push({
          itemId: bal_chunk.itemId,
          sectionId: bal_chunk.sectionId,
          itemType: bal_chunk.itemType,
          chunkKind: bal_chunk.kind,
          pageNumber: bal_page.pageNumber,
          rect: bal_chunk_rect,
          normalized: bal_normalized_rect(bal_chunk_rect, bal_regions.width, bal_regions.height)
        });
      }

      if (bal_chunk.kind === 'question') {
        const bal_q = bal_chunk as bal_QuestionChunk;
        const bal_marker_info = bal_question_marker(bal_chunk.itemType);
        for (const bal_row of bal_q.optionRows) {
          bal_push_region({
            itemId: bal_q.itemId as string,
            variableName: bal_q.variableName,
            itemType: bal_chunk.itemType,
            kind: 'choice',
            optionId: bal_row.optionId,
            optionCode: bal_row.optionCode,
            rowId: null,
            columnId: null,
            markerType: bal_marker_info.marker,
            selection: bal_marker_info.selection,
            rect: {
              x: bal_x + bal_row.region.x,
              y: bal_placed.y + bal_row.region.y,
              width: bal_row.region.width,
              height: bal_row.region.height
            }
          });
        }
        if (bal_q.tail !== 'none') {
          bal_push_region({
            itemId: bal_q.itemId as string,
            variableName: bal_q.variableName,
            itemType: bal_chunk.itemType,
            kind: bal_written_kind(bal_chunk.itemType),
            optionId: null,
            optionCode: null,
            rowId: null,
            columnId: null,
            markerType: bal_chunk.itemType === 'long_text' ? 'box' : 'line',
            selection: 'written',
            rect: {
              x: bal_x + bal_q.stemIndent,
              y: bal_placed.y + bal_q.tailTop,
              width: bal_q.tailWidth,
              height: bal_q.tailHeight
            }
          });
        }
      }

      if (bal_chunk.kind === 'matrix-row') {
        const bal_row = bal_chunk as bal_MatrixRowChunk;
        const bal_ctx = bal_matrix_context.get(bal_row.itemId as string);
        if (bal_ctx) {
          const bal_marker_size =
            bal_settings.marker.diameterMm + bal_settings.marker.regionPaddingMm * 2;
          bal_ctx.columns.forEach((bal_col, bal_col_index) => {
            const bal_col_width = bal_row.columnWidths[bal_col_index] ?? bal_row.columnWidths[0];
            const bal_cell_center_x =
              bal_x + bal_row.labelColumnWidth + bal_col_index * bal_col_width + bal_col_width / 2;
            const bal_cell_center_y = bal_placed.y + bal_row.rowHeight / 2;
            bal_push_region({
              itemId: bal_row.itemId as string,
              variableName: bal_row.variableName,
              itemType: 'matrix',
              kind: 'matrix',
              optionId: null,
              optionCode: bal_col.coding,
              rowId: bal_row.rowId,
              columnId: bal_col.id,
              markerType: bal_ctx.multiple ? 'checkbox' : 'bubble',
              selection: bal_ctx.multiple ? 'multiple' : 'single',
              rect: {
                x: bal_cell_center_x - bal_marker_size / 2,
                y: bal_cell_center_y - bal_marker_size / 2,
                width: bal_marker_size,
                height: bal_marker_size
              }
            });
          });
        }
      }

      if (bal_chunk.kind === 'consent-ack') {
        const bal_ack = bal_chunk as bal_ConsentAckChunk;
        bal_push_region({
          itemId: bal_ack.itemId as string,
          variableName: null,
          itemType: 'consent',
          kind: 'consent',
          optionId: null,
          optionCode: null,
          rowId: null,
          columnId: null,
          markerType: 'checkbox',
          selection: 'written',
          rect: {
            x: bal_x + bal_ack.region.x,
            y: bal_placed.y + bal_ack.region.y,
            width: bal_ack.region.width,
            height: bal_ack.region.height
          }
        });
      }
    }

    const bal_geometry: PageGeometry = {
      pageNumber: bal_page.pageNumber,
      width: bal_regions.width,
      height: bal_regions.height,
      margins: bal_regions.margins,
      contentBounds: bal_regions.content,
      safeBounds: bal_regions.safe,
      headerBounds: bal_regions.header,
      footerBounds: bal_regions.footer,
      respondentIdBounds: bal_header?.respondentBox ?? null,
      identifier: bal_identifier,
      alignmentMarkers: bal_markers,
      itemBounds: bal_item_bounds,
      answerRegions: bal_answer_regions
    };

    bal_pages.push({
      pageNumber: bal_page.pageNumber,
      regions: bal_regions,
      chunks: bal_page.chunks,
      header: bal_header,
      footer: bal_footer,
      identifier: bal_identifier,
      qrModules: bal_qr_modules,
      alignmentMarkers: bal_markers,
      respondentIdBounds: bal_header?.respondentBox ?? null,
      geometry: bal_geometry
    });
  }

  const bal_geometry: PrintLayoutGeometry = {
    questionnaireId: bal_input.questionnaire.id,
    questionnaireVersion: bal_input.questionnaire.version,
    fingerprint: bal_fingerprint,
    paperSize: bal_input.questionnaire.paperSize,
    orientation: bal_input.questionnaire.orientation,
    scannerMode: bal_settings.scannerMode,
    pageCount: bal_pages.length,
    pages: bal_pages.map((bal_p) => bal_p.geometry)
  };

  void bal_numbering;

  return {
    questionnaireTitle: bal_input.questionnaire.title,
    questionnaireVersion: bal_input.questionnaire.version,
    studyCode: bal_code,
    fingerprint: bal_fingerprint,
    settings: bal_settings,
    pageCount: bal_pages.length,
    matrixMultipleItemIds: [...bal_matrix_context.entries()]
      .filter((bal_entry) => bal_entry[1].multiple)
      .map((bal_entry) => bal_entry[0]),
    pages: bal_pages,
    geometry: bal_geometry
  };
}
