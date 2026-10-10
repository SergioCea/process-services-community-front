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

export const WORKFLOW_FORM_TITLE_MAX_LENGTH = 100;

const FORM_FIELD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]{0,99}$/;

export type WorkflowFormValidationCode =
  | 'title-required'
  | 'title-too-long'
  | 'title-duplicate'
  | 'schema-invalid'
  | 'component-type-required'
  | 'field-key-invalid'
  | 'field-key-duplicate'
  | 'field-validation-invalid'
  | 'field-validation-incompatible'
  | 'default-value-incompatible';

export interface WorkflowFormValidationIssue {
  code: WorkflowFormValidationCode;
  componentIndex?: number;
  fieldKey?: string;
}

export interface WorkflowFormTitleSummary {
  id: string;
  title: string;
}

export class WorkflowFormValidationError extends Error {
  constructor(readonly issue: WorkflowFormValidationIssue) {
    super(issue.code);
    this.name = 'WorkflowFormValidationError';
  }
}

export function normalizeWorkflowFormTitle(title: string): string {
  return title.trim().normalize('NFKC').toLowerCase();
}

export function validateWorkflowFormTitle(
  title: string,
  existingForms: readonly WorkflowFormTitleSummary[],
  currentFormId?: string
): WorkflowFormValidationIssue[] {
  const normalizedTitle = normalizeWorkflowFormTitle(title);
  const issues: WorkflowFormValidationIssue[] = [];

  if (!normalizedTitle) {
    issues.push({code: 'title-required'});
    return issues;
  }

  if (normalizedTitle.length > WORKFLOW_FORM_TITLE_MAX_LENGTH) {
    issues.push({code: 'title-too-long'});
  }

  if (existingForms.some((form) => form.id !== currentFormId && normalizeWorkflowFormTitle(form.title) === normalizedTitle)) {
    issues.push({code: 'title-duplicate'});
  }

  return issues;
}

export function validateWorkflowFormSchema(schema: unknown): WorkflowFormValidationIssue[] {
  const form = toRecord(schema);
  if (!form || form['type'] !== 'default' || !Array.isArray(form['components'])) {
    return [{code: 'schema-invalid'}];
  }

  const issues: WorkflowFormValidationIssue[] = [];
  const fieldKeys = new Set<string>();

  const validateComponents = (components: unknown[]) => {
    components.forEach((value, componentIndex) => {
      const component = toRecord(value);
      if (!component || typeof component['type'] !== 'string' || !component['type'].trim()) {
        issues.push({code: 'component-type-required', componentIndex});
        return;
      }

      const type = component['type'];
      const key = component['key'];
      if (key !== undefined) {
        if (typeof key !== 'string' || !FORM_FIELD_KEY_PATTERN.test(key)) {
          issues.push({code: 'field-key-invalid', componentIndex, fieldKey: typeof key === 'string' ? key : undefined});
        } else if (fieldKeys.has(key)) {
          issues.push({code: 'field-key-duplicate', componentIndex, fieldKey: key});
        } else {
          fieldKeys.add(key);
        }
      }

      validateComponentDefaults(component, type, componentIndex, issues);
      validateComponentRules(component, componentIndex, issues);

      if (component['components'] !== undefined) {
        if (Array.isArray(component['components'])) {
          validateComponents(component['components']);
        } else {
          issues.push({code: 'schema-invalid', componentIndex});
        }
      }
    });
  };

  validateComponents(form['components']);
  return issues;
}

function validateComponentRules(component: Record<string, unknown>, componentIndex: number, issues: WorkflowFormValidationIssue[]) {
  const rules = component['validate'];
  if (rules === undefined) {
    return;
  }

  const validation = toRecord(rules);
  if (!validation) {
    issues.push({code: 'field-validation-invalid', componentIndex});
    return;
  }

  if (validation['required'] !== undefined && typeof validation['required'] !== 'boolean') {
    issues.push({code: 'field-validation-invalid', componentIndex});
  }

  const minLength = validation['minLength'];
  const maxLength = validation['maxLength'];
  const min = validation['min'];
  const max = validation['max'];
  const isValidLength = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
  const isValidRange = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value));

  if (!isValidLength(minLength) || !isValidLength(maxLength) || !isValidRange(min) || !isValidRange(max)) {
    issues.push({code: 'field-validation-invalid', componentIndex});
  }

  if (
    (typeof minLength === 'number' && typeof maxLength === 'number' && minLength > maxLength) ||
    (typeof min === 'number' && typeof max === 'number' && min > max)
  ) {
    issues.push({code: 'field-validation-incompatible', componentIndex});
  }

  const pattern = validation['pattern'];
  if (pattern !== undefined) {
    if (typeof pattern !== 'string') {
      issues.push({code: 'field-validation-invalid', componentIndex});
    } else {
      try {
        new RegExp(pattern);
      } catch {
        issues.push({code: 'field-validation-invalid', componentIndex});
      }
    }
  }
}

function validateComponentDefaults(component: Record<string, unknown>, type: string, componentIndex: number, issues: WorkflowFormValidationIssue[]) {
  const value = component['defaultValue'];
  if (value === undefined || value === null) {
    return;
  }

  const isNumericValue =
    (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value)));
  const isCompatible =
    ((type === 'textfield' || type === 'textarea') && typeof value === 'string') ||
    (type === 'number' && isNumericValue) ||
    (type === 'checkbox' && typeof value === 'boolean');

  if ((type === 'textfield' || type === 'textarea' || type === 'number' || type === 'checkbox') && !isCompatible) {
    issues.push({
      code: 'default-value-incompatible',
      componentIndex,
      fieldKey: typeof component['key'] === 'string' ? component['key'] : undefined
    });
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
