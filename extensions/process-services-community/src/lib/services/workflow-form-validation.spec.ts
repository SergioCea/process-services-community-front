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

import {
  WORKFLOW_FORM_TITLE_MAX_LENGTH,
  validateWorkflowFormSchema,
  validateWorkflowFormTitle
} from './workflow-form-validation';

describe('workflow form validation', () => {
  it('rejects empty and whitespace-only titles', () => {
    expect(validateWorkflowFormTitle('   ', [])).toEqual([{code: 'title-required'}]);
  });

  it('rejects titles longer than the configured limit', () => {
    expect(validateWorkflowFormTitle('A'.repeat(WORKFLOW_FORM_TITLE_MAX_LENGTH + 1), [])).toContainEqual({code: 'title-too-long'});
  });

  it('detects duplicate titles case-insensitively and allows the current form to keep its title', () => {
    const forms = [{id: 'form-1', title: 'Expense request'}];

    expect(validateWorkflowFormTitle(' expense request ', forms)).toContainEqual({code: 'title-duplicate'});
    expect(validateWorkflowFormTitle('Expense request', forms, 'form-1')).toEqual([]);
  });

  it('accepts a valid title and schema', () => {
    const schema = {
      type: 'default',
      schemaVersion: 1,
      components: [{type: 'textfield', key: 'requester', validate: {required: true, minLength: 2, maxLength: 80}}]
    };

    expect(validateWorkflowFormTitle('Expense request', [])).toEqual([]);
    expect(validateWorkflowFormSchema(schema)).toEqual([]);
  });

  it('rejects malformed schemas and components without a type', () => {
    expect(validateWorkflowFormSchema({type: 'default', components: {}})).toEqual([{code: 'schema-invalid'}]);
    expect(validateWorkflowFormSchema({type: 'default', components: [{}]})).toEqual([{
      code: 'component-type-required',
      componentIndex: 0
    }]);
  });

  it('rejects invalid and duplicate field identifiers, including nested fields', () => {
    const schema = {
      type: 'default',
      components: [
        {type: 'textfield', key: 'requester name'},
        {type: 'group', components: [{type: 'textfield', key: 'requester'}]},
        {type: 'textfield', key: 'requester'}
      ]
    };

    expect(validateWorkflowFormSchema(schema)).toEqual([
      {code: 'field-key-invalid', componentIndex: 0, fieldKey: 'requester name'},
      {code: 'field-key-duplicate', componentIndex: 2, fieldKey: 'requester'}
    ]);
  });

  it('rejects incompatible validation ranges, malformed patterns, and default values for known field types', () => {
    const schema = {
      type: 'default',
      components: [
        {type: 'textfield', key: 'amount', validate: {minLength: 8, maxLength: 3}},
        {type: 'textfield', key: 'code', validate: {pattern: '['}},
        {type: 'number', key: 'count', defaultValue: 'not-a-number'}
      ]
    };

    expect(validateWorkflowFormSchema(schema)).toEqual([
      {code: 'field-validation-incompatible', componentIndex: 0},
      {code: 'field-validation-invalid', componentIndex: 1},
      {code: 'default-value-incompatible', componentIndex: 2, fieldKey: 'count'}
    ]);
  });
});
