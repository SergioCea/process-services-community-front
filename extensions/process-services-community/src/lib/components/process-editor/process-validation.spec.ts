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
  findDuplicateProcessDefinitions,
  isBlockingProcessValidationIssue,
  mapProcessDeploymentError,
  PROCESS_NAME_MAX_LENGTH,
  validateProcessDefinition
} from './process-validation';

describe('process validation', () => {
  const startEvent = { $type: 'bpmn:StartEvent', id: 'StartEvent_1' };

  function definitions(flowElements: unknown[] = [startEvent], overrides: Record<string, unknown> = {}) {
    return {
      rootElements: [
        {
          $type: 'bpmn:Process',
          id: 'Process_1',
          name: 'Expense approval',
          isExecutable: true,
          flowElements,
          ...overrides
        }
      ]
    };
  }

  it('accepts the smallest executable diagram supported by the editor', () => {
    expect(validateProcessDefinition(definitions(), new Map())).toEqual([]);
  });

  it('rejects missing or invalid process names and identifiers', () => {
    expect(validateProcessDefinition(definitions([], { id: 'bad process', name: '   ' }), new Map())).toEqual(
      expect.arrayContaining([
        { code: 'process-id-invalid', field: 'id' },
        { code: 'process-name-required', field: 'name' },
        { code: 'start-event-required', field: 'definition' }
      ])
    );
  });

  it('rejects a missing process identifier and a name beyond the supported length', () => {
    expect(validateProcessDefinition(definitions([startEvent], { id: '', name: 'A'.repeat(PROCESS_NAME_MAX_LENGTH + 1) }), new Map())).toEqual(
      expect.arrayContaining([
        { code: 'process-id-required', field: 'id' },
        { code: 'process-name-too-long', field: 'name' }
      ])
    );
  });

  it('requires an executable process and at least one start event', () => {
    expect(validateProcessDefinition(definitions([], { isExecutable: false }), new Map())).toEqual(
      expect.arrayContaining([
        { code: 'process-not-executable', field: 'definition' },
        { code: 'start-event-required', field: 'definition' }
      ])
    );
  });

  it('validates unique element identifiers and sequence-flow references', () => {
    const flowElements = [
      startEvent,
      { $type: 'bpmn:Task', id: 'Task_1' },
      { $type: 'bpmn:Task', id: 'Task_1' },
      { $type: 'bpmn:SequenceFlow', id: 'Flow_1', sourceRef: startEvent, targetRef: { id: 'Missing_1' } }
    ];

    expect(validateProcessDefinition(definitions(flowElements), new Map())).toEqual(
      expect.arrayContaining([
        { code: 'element-id-duplicate', field: 'definition', elementId: 'Task_1' },
        { code: 'sequence-flow-invalid', field: 'definition', elementId: 'Flow_1' }
      ])
    );
  });

  it('requires a valid schema when a BPMN element has a form key', () => {
    const formStartEvent = {
      ...startEvent,
      get: (property: string) => (property === 'activiti:formKey' ? 'request-form' : undefined)
    };

    expect(validateProcessDefinition(definitions([formStartEvent]), new Map())).toContainEqual({
      code: 'form-schema-missing',
      field: 'form',
      elementId: 'StartEvent_1'
    });
    expect(
      validateProcessDefinition(
        definitions([formStartEvent]),
        new Map([['StartEvent_1', { type: 'default', components: [{ type: 'textfield', key: 'bad key' }] }]])
      )
    ).toContainEqual({ code: 'form-schema-invalid', field: 'form', elementId: 'StartEvent_1' });
  });

  it('detects duplicate process keys and names but permits the current process version', () => {
    const existing = [
      { id: 'expense:2:deployment-2', key: 'expense', name: 'Expense approval', version: 2 },
      { id: 'leave:1:deployment-1', key: 'leave', name: 'Leave request', version: 1 }
    ];

    expect(findDuplicateProcessDefinitions(existing, { id: 'expense', name: 'Different name' })).toContainEqual({
      code: 'process-id-duplicate',
      field: 'id'
    });
    expect(findDuplicateProcessDefinitions(existing, { id: 'new-process', name: ' leave request ' })).toContainEqual({
      code: 'process-name-duplicate',
      field: 'name'
    });
    expect(findDuplicateProcessDefinitions(existing, { id: 'expense', name: 'Expense approval' }, 'expense:2:deployment-2')).toEqual([]);
  });

  it('maps structured server errors to safe field-level messages instead of exposing exception text', () => {
    expect(
      mapProcessDeploymentError({
        error: {
          validationErrors: [
            { field: 'processId', code: 'DUPLICATE_PROCESS_ID', message: 'java.lang.IllegalStateException' },
            { field: 'bpmnXml', code: 'INVALID_BPMN', message: 'internal stack trace' }
          ]
        }
      })
    ).toEqual([
      { code: 'process-id-duplicate', field: 'id' },
      { code: 'backend-validation', field: 'definition' }
    ]);
    expect(mapProcessDeploymentError(new Error('HTTP 500 internal stack'))).toEqual([{ code: 'deployment-failed', field: 'definition' }]);
    expect(isBlockingProcessValidationIssue({ code: 'deployment-failed', field: 'definition' })).toBe(false);
  });
});
