import type {
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type { PrintLayoutRecord } from '../../models/print_models';

export function bal_project(): ProjectRecord {
  return {
    id: 'proj-1',
    title: 'Water Survey 2026',
    description: 'Community water access survey',
    status: 'active',
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

export function bal_scale(): ResponseScaleRecord {
  return {
    id: 'scale-agree',
    name: 'Agreement',
    options: [
      { id: 'o1', label: 'Strongly agree', coding: '5' },
      { id: 'o2', label: 'Agree', coding: '4' },
      { id: 'o3', label: 'Neutral', coding: '3' },
      { id: 'o4', label: 'Disagree', coding: '2' },
      { id: 'o5', label: 'Strongly disagree', coding: '1' }
    ],
    createdAt: 1727600000000,
    updatedAt: 1727600000000
  };
}

export function bal_questionnaire(): QuestionnaireRecord {
  return {
    id: 'q-1',
    projectId: 'proj-1',
    title: 'Water Survey',
    description: null,
    version: 3,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'published',
    metadata: null,
    printSettings: null,
    sections: [
      {
        id: 's1',
        type: 'section',
        title: 'Background',
        description: null,
        printConfig: null,
        metadata: null,
        items: [
          {
            id: 'i1',
            type: 'single_choice',
            variableName: 'water_source',
            label: 'Main water source',
            required: true,
            options: [
              { id: 'o1', label: 'Piped', coding: '1' },
              { id: 'o2', label: 'Well', coding: '2' }
            ],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: 'scale-agree',
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [],
            columns: [],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          }
        ]
      }
    ],
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

export function bal_layout(): PrintLayoutRecord {
  return {
    id: 'layout-1',
    questionnaireId: 'q-1',
    projectId: 'proj-1',
    questionnaireVersion: 3,
    fingerprint: 'fp-a37792f7',
    paperSize: 'a4',
    orientation: 'portrait',
    settingsSnapshot: {
      margins: { top: 12, right: 10.5, bottom: 12, left: 10.5 },
      theme: { name: 'academic', fontFamily: 'helvetica', baseFontSize: 10.5, headingScale: 1.2, lineWeight: 0.5 },
      density: 'standard',
      questionSpacing: 6,
      header: {
        showTitle: true,
        showInstitution: false,
        institution: '',
        showStudyCode: true,
        studyCode: 'WS2026',
        showVersion: true,
        showRespondentId: true,
        respondentIdLabel: 'Respondent ID'
      },
      footer: {
        showPageNumbers: true,
        showStudyCode: true,
        confidentialityNote: '',
        showHumanIdentifier: false
      },
      showMachineIdentifier: true,
      scannerMode: true,
      marker: { diameterMm: 3.2, regionPaddingMm: 1.4 },
      identifier: { sizeMm: 16, errorCorrection: 'M' },
      respondentArea: { enabled: true, label: 'Respondent ID' },
      logo: null
    },
    geometry: {
      questionnaireId: 'q-1',
      questionnaireVersion: 3,
      fingerprint: 'fp-a37792f7',
      paperSize: 'a4',
      orientation: 'portrait',
      scannerMode: true,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          width: 210,
          height: 297,
          margins: { top: 12, right: 10.5, bottom: 12, left: 10.5 },
          contentBounds: { x: 10.5, y: 12, width: 189, height: 273 },
          safeBounds: { x: 10.5, y: 12, width: 189, height: 273 },
          headerBounds: { x: 10.5, y: 12, width: 189, height: 20 },
          footerBounds: null,
          respondentIdBounds: { x: 150, y: 20, width: 40, height: 11 },
          identifier: {
            payload: 'S1|WS2026|3||1',
            humanReadable: 'WS2026- P1/1',
            qrBounds: { x: 12, y: 266, width: 16, height: 16 },
            normalized: { x: 0.0571, y: 0.8956, width: 0.0762, height: 0.0539 },
            moduleCount: 29,
            quietZoneModules: 4,
            textBounds: null
          },
          alignmentMarkers: [
            {
              corner: 'topLeft',
              rect: { x: 7, y: 7, width: 3.2, height: 3.2 },
              normalized: { x: 0.0333, y: 0.0236, width: 0.0152, height: 0.0108 }
            },
            {
              corner: 'topRight',
              rect: { x: 199.8, y: 7, width: 3.2, height: 3.2 },
              normalized: { x: 0.9514, y: 0.0236, width: 0.0152, height: 0.0108 }
            },
            {
              corner: 'bottomLeft',
              rect: { x: 7, y: 286.8, width: 3.2, height: 3.2 },
              normalized: { x: 0.0333, y: 0.9657, width: 0.0152, height: 0.0108 }
            },
            {
              corner: 'bottomRight',
              rect: { x: 199.8, y: 286.8, width: 3.2, height: 3.2 },
              normalized: { x: 0.9514, y: 0.9657, width: 0.0152, height: 0.0108 }
            }
          ],
          itemBounds: [
            {
              itemId: 'i1',
              sectionId: 's1',
              itemType: 'single_choice',
              chunkKind: 'question',
              pageNumber: 1,
              rect: { x: 14, y: 50, width: 120, height: 8 },
              normalized: { x: 0.0667, y: 0.1684, width: 0.5714, height: 0.0269 }
            }
          ],
          answerRegions: [
            {
              itemId: 'i1',
              variableName: 'water_source',
              itemType: 'single_choice',
              kind: 'choice',
              optionId: 'o1',
              optionCode: '1',
              rowId: null,
              columnId: null,
              markerType: 'bubble',
              selection: 'single',
              pageNumber: 1,
              rect: { x: 30.4, y: 56.5, width: 3.2, height: 3.2 },
              normalized: { x: 0.1448, y: 0.1902, width: 0.0152, height: 0.0108 }
            }
          ]
        }
      ]
    },
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}
