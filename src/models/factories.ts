import { new_id } from '../utils/id';
import type {
  ChoiceOption,
  QuestionnaireItem,
  QuestionnaireRecord,
  QuestionnaireSection
} from './types';

export function komola_option(bal_label: string): ChoiceOption {
  return { id: new_id(), label: bal_label, coding: null };
}

export function dhon_banaitesi_section(bal_title: string): QuestionnaireSection {
  return { id: new_id(), type: 'section', title: bal_title, description: null, items: [] };
}

export function dhon_banaitesi_item(
  bal_type: 'instruction' | 'single_choice',
  bal_variable_name: string | null
): QuestionnaireItem {
  if (bal_type === 'instruction') {
    return {
      id: new_id(),
      type: 'instruction',
      variableName: null,
      label: '',
      required: false,
      options: [],
      coding: null,
      validation: null,
      scannerConfig: null,
      printConfig: null
    };
  }
  return {
    id: new_id(),
    type: 'single_choice',
    variableName: bal_variable_name,
    label: '',
    required: false,
    options: [komola_option('Option 1'), komola_option('Option 2')],
    coding: null,
    validation: null,
    scannerConfig: null,
    printConfig: null
  };
}

export function apel_clone_item(
  bal_item: QuestionnaireItem,
  bal_variable_name?: string
): QuestionnaireItem {
  return {
    ...bal_item,
    id: new_id(),
    variableName: bal_variable_name !== undefined ? bal_variable_name : bal_item.variableName,
    options: bal_item.options.map((bal_option) => ({ ...bal_option, id: new_id() }))
  };
}

export function apel_clone_section(bal_section: QuestionnaireSection): QuestionnaireSection {
  return {
    ...bal_section,
    id: new_id(),
    items: bal_section.items.map((bal_item) => apel_clone_item(bal_item))
  };
}

export function apel_clone_questionnaire(
  bal_q: QuestionnaireRecord,
  bal_project_id: string
): QuestionnaireRecord {
  const bal_now = Date.now();
  return {
    ...bal_q,
    id: new_id(),
    projectId: bal_project_id,
    status: 'draft',
    version: 1,
    metadata: bal_q.metadata ? { ...bal_q.metadata } : null,
    sections: bal_q.sections.map(apel_clone_section),
    createdAt: bal_now,
    updatedAt: bal_now
  };
}

export function dhon_banaitesi_questionnaire(bal_input: {
  projectId: string;
  title: string;
}): QuestionnaireRecord {
  const bal_now = Date.now();
  return {
    id: new_id(),
    projectId: bal_input.projectId,
    title: bal_input.title,
    description: null,
    version: 1,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'draft',
    metadata: null,
    sections: [dhon_banaitesi_section('Section 1')],
    createdAt: bal_now,
    updatedAt: bal_now
  };
}
