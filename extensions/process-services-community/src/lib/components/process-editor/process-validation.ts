/*!
 * Copyright © 2005-2026 Hyland Software, Inc. and its affiliates. All rights reserved.
 *
 * Alfresco Example Content Application
 *
 * This file is part of the Alfresco Example Content Application.
 * If the software was purchased under a paid Alfresco license, the terms of
 * the paid license agreement will prevail. Otherwise, the software is
 * provided under the following open source license terms:
 *
 * The Alfresco Example Content Application is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The Alfresco Example Content Application is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * from Hyland Software. If not, see <http://www.gnu.org/licenses/>.
 */

import { validateWorkflowFormSchema } from '../../services/workflow-form-validation';

export const PROCESS_NAME_MAX_LENGTH = 120;

const PROCESS_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]{0,99}$/;
const PROCESS_DEFINITION_ID_PATTERN = /^(.+):\d+:[^:]+$/;

export type ProcessValidationField = 'name' | 'id' | 'definition' | 'form';

export type ProcessValidationCode =
  | 'process-required'
  | 'process-name-required'
  | 'process-name-too-long'
  | 'process-id-required'
  | 'process-id-invalid'
  | 'process-name-duplicate'
  | 'process-id-duplicate'
  | 'process-not-executable'
  | 'start-event-required'
  | 'element-type-required'
  | 'element-id-required'
  | 'element-id-invalid'
  | 'element-id-duplicate'
  | 'sequence-flow-invalid'
  | 'form-schema-missing'
  | 'form-schema-invalid'
  | 'duplicate-check-failed'
  | 'backend-validation'
  | 'deployment-failed';

export interface ProcessValidationIssue {
  code: ProcessValidationCode;
  field: ProcessValidationField;
  elementId?: string;
}

export interface ProcessDefinitionCandidate {
  id: string;
  name: string;
}

interface BpmnElement {
  $type?: unknown;
  id?: unknown;
  name?: unknown;
  isExecutable?: unknown;
  flowElements?: unknown;
  sourceRef?: unknown;
  targetRef?: unknown;
  get?: (property: string) => unknown;
}

export function validateProcessDefinition(definitions: unknown, formSchemas: ReadonlyMap<string, unknown>): ProcessValidationIssue[] {
  const definitionsRecord = toRecord(definitions);
  const rootElements = Array.isArray(definitionsRecord?.['rootElements']) ? definitionsRecord['rootElements'] : [];
  const processRecord = rootElements.map(toRecord).find((element) => element?.['$type'] === 'bpmn:Process');

  if (!processRecord) {
    return [{ code: 'process-required', field: 'definition' }];
  }

  const process = processRecord as unknown as BpmnElement;

  const issues: ProcessValidationIssue[] = [];
  const processId = typeof process.id === 'string' ? process.id : '';
  const processName = typeof process.name === 'string' ? process.name.trim() : '';

  if (!processId.trim()) {
    issues.push({ code: 'process-id-required', field: 'id' });
  } else if (!PROCESS_ID_PATTERN.test(processId)) {
    issues.push({ code: 'process-id-invalid', field: 'id' });
  }

  if (!processName) {
    issues.push({ code: 'process-name-required', field: 'name' });
  } else if (processName.length > PROCESS_NAME_MAX_LENGTH) {
    issues.push({ code: 'process-name-too-long', field: 'name' });
  }

  if (readProperty(process, 'isExecutable') !== true) {
    issues.push({ code: 'process-not-executable', field: 'definition' });
  }

  const flowElements = collectFlowElements(process);
  const ids = new Set<string>();
  if (processId) {
    ids.add(processId);
  }

  let startEventCount = 0;
  for (const element of flowElements) {
    const type = typeof element.$type === 'string' ? element.$type : '';
    const elementId = typeof element.id === 'string' ? element.id : '';

    if (!type) {
      issues.push({ code: 'element-type-required', field: 'definition', elementId: elementId || undefined });
    }

    if (!elementId.trim()) {
      issues.push({ code: 'element-id-required', field: 'definition' });
    } else {
      if (!PROCESS_ID_PATTERN.test(elementId)) {
        issues.push({ code: 'element-id-invalid', field: 'definition', elementId });
      }
      if (ids.has(elementId)) {
        issues.push({ code: 'element-id-duplicate', field: 'definition', elementId });
      }
      ids.add(elementId);
    }

    if (type === 'bpmn:StartEvent') {
      startEventCount++;
    }
  }

  if (startEventCount === 0) {
    issues.push({ code: 'start-event-required', field: 'definition' });
  }

  for (const element of flowElements) {
    const elementId = typeof element.id === 'string' ? element.id : undefined;
    if (element.$type === 'bpmn:SequenceFlow') {
      const sourceId = getReferenceId(readProperty(element, 'sourceRef'));
      const targetId = getReferenceId(readProperty(element, 'targetRef'));
      if (!sourceId || !targetId || !ids.has(sourceId) || !ids.has(targetId)) {
        issues.push({ code: 'sequence-flow-invalid', field: 'definition', elementId });
      }
    }

    const formKey = readProperty(element, 'activiti:formKey');
    if (typeof formKey === 'string' && formKey.trim()) {
      const schema = elementId ? formSchemas.get(elementId) : undefined;
      if (!schema) {
        issues.push({ code: 'form-schema-missing', field: 'form', elementId });
      } else if (validateWorkflowFormSchema(schema).length > 0) {
        issues.push({ code: 'form-schema-invalid', field: 'form', elementId });
      }
    }
  }

  return issues;
}

export function findDuplicateProcessDefinitions(
  existingDefinitions: unknown[],
  candidate: ProcessDefinitionCandidate,
  currentDefinitionId?: string | null
): ProcessValidationIssue[] {
  const currentKey = currentDefinitionId ? getProcessDefinitionKey(currentDefinitionId) : undefined;
  const candidateName = normalizeProcessName(candidate.name);
  const issues = new Map<ProcessValidationCode, ProcessValidationIssue>();

  for (const definition of existingDefinitions) {
    const record = toRecord(definition);
    if (!record) {
      continue;
    }

    const key = getProcessDefinitionKey(record);
    if (currentKey && key === currentKey) {
      continue;
    }

    if (key && key === candidate.id) {
      issues.set('process-id-duplicate', { code: 'process-id-duplicate', field: 'id' });
    }

    const existingName = record['name'] ?? record['title'];
    if (typeof existingName === 'string' && candidateName && normalizeProcessName(existingName) === candidateName) {
      issues.set('process-name-duplicate', { code: 'process-name-duplicate', field: 'name' });
    }
  }

  return Array.from(issues.values());
}

export function mapProcessDeploymentError(error: unknown): ProcessValidationIssue[] {
  const root = toRecord(error);
  const response = toRecord(root?.['error']) ?? toRecord(root?.['body']) ?? toRecord(root?.['response']) ?? root;
  const rawIssues = response?.['validationErrors'] ?? response?.['errors'];

  if (!Array.isArray(rawIssues) || rawIssues.length === 0) {
    return [{ code: 'deployment-failed', field: 'definition' }];
  }

  const issues = new Map<string, ProcessValidationIssue>();
  for (const rawIssue of rawIssues) {
    const issue = toRecord(rawIssue);
    if (!issue) {
      continue;
    }

    const rawCode = typeof issue['code'] === 'string' ? issue['code'].toUpperCase().replace(/[\s.-]/g, '_') : '';
    const code = mapBackendValidationCode(rawCode);
    const field = mapBackendValidationField(issue['field']) ?? (code ? defaultValidationField(code) : undefined);
    if (!field) {
      continue;
    }

    const elementId = typeof issue['elementId'] === 'string' ? issue['elementId'] : undefined;
    const mappedCode = code ?? 'backend-validation';
    issues.set(`${mappedCode}:${field}:${elementId ?? ''}`, { code: mappedCode, field, ...(elementId ? { elementId } : {}) });
  }

  return issues.size > 0 ? Array.from(issues.values()) : [{ code: 'deployment-failed', field: 'definition' }];
}

export function isBlockingProcessValidationIssue(issue: ProcessValidationIssue): boolean {
  return issue.code !== 'duplicate-check-failed' && issue.code !== 'deployment-failed';
}

function collectFlowElements(container: BpmnElement): BpmnElement[] {
  if (!Array.isArray(container.flowElements)) {
    return [];
  }

  const elements: BpmnElement[] = [];
  for (const value of container.flowElements) {
    const element = toRecord(value) as BpmnElement | null;
    if (!element) {
      continue;
    }
    elements.push(element);
    elements.push(...collectFlowElements(element));
  }
  return elements;
}

function readProperty(element: BpmnElement, property: string): unknown {
  if (typeof element.get === 'function') {
    const value = element.get(property);
    if (value !== undefined) {
      return value;
    }
  }
  return (element as unknown as Record<string, unknown>)[property];
}

function getReferenceId(reference: unknown): string | undefined {
  if (typeof reference === 'string') {
    return reference;
  }
  const record = toRecord(reference);
  return typeof record?.['id'] === 'string' ? record['id'] : undefined;
}

function getProcessDefinitionKey(definition: unknown): string | undefined {
  const record = typeof definition === 'string' ? undefined : toRecord(definition);
  const explicitKey = record?.['key'] ?? record?.['processDefinitionKey'];
  if (typeof explicitKey === 'string' && explicitKey) {
    return explicitKey;
  }

  const id = typeof definition === 'string' ? definition : (record?.['id'] ?? record?.['processId']);
  if (typeof id !== 'string' || !id) {
    return undefined;
  }

  return id.match(PROCESS_DEFINITION_ID_PATTERN)?.[1] ?? id;
}

function normalizeProcessName(name: string): string {
  return name.trim().normalize('NFKC').toLowerCase();
}

function mapBackendValidationCode(code: string): ProcessValidationCode | undefined {
  const codes: Record<string, ProcessValidationCode> = {
    PROCESS_NAME_REQUIRED: 'process-name-required',
    PROCESS_NAME_TOO_LONG: 'process-name-too-long',
    PROCESS_NAME_DUPLICATE: 'process-name-duplicate',
    DUPLICATE_PROCESS_NAME: 'process-name-duplicate',
    PROCESS_ID_REQUIRED: 'process-id-required',
    PROCESS_ID_INVALID: 'process-id-invalid',
    PROCESS_ID_DUPLICATE: 'process-id-duplicate',
    DUPLICATE_PROCESS_ID: 'process-id-duplicate',
    PROCESS_NOT_EXECUTABLE: 'process-not-executable',
    START_EVENT_REQUIRED: 'start-event-required',
    INVALID_SEQUENCE_FLOW: 'sequence-flow-invalid',
    FORM_SCHEMA_MISSING: 'form-schema-missing',
    FORM_NOT_FOUND: 'form-schema-missing',
    FORM_SCHEMA_INVALID: 'form-schema-invalid',
    INVALID_FORM_SCHEMA: 'form-schema-invalid'
  };
  return codes[code];
}

function mapBackendValidationField(field: unknown): ProcessValidationField | undefined {
  if (typeof field !== 'string') {
    return undefined;
  }

  switch (field.toLowerCase().replace(/[^a-z]/g, '')) {
    case 'name':
    case 'processname':
      return 'name';
    case 'id':
    case 'key':
    case 'processid':
    case 'processkey':
      return 'id';
    case 'form':
    case 'forms':
    case 'formkey':
      return 'form';
    case 'bpmn':
    case 'definition':
    case 'xml':
    case 'process':
    case 'bpmnxml':
    case 'processxml':
    case 'processdefinition':
      return 'definition';
    default:
      return undefined;
  }
}

function defaultValidationField(code: ProcessValidationCode): ProcessValidationField {
  if (code.includes('name')) {
    return 'name';
  }
  if (code.includes('id')) {
    return 'id';
  }
  if (code.includes('form')) {
    return 'form';
  }
  return 'definition';
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
