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

import { TestBed } from '@angular/core/testing';
import { WorkflowFormsService, WORKFLOW_FORMS_NODES_API, WORKFLOW_FORMS_VERSIONS_API } from './workflow-forms.service';
import { WorkflowFormValidationError } from './workflow-form-validation';

describe('WorkflowFormsService', () => {
  let service: WorkflowFormsService;
  let nodesApi: {
    createNode: jest.Mock;
    deleteNode: jest.Mock;
    getNodeContent: jest.Mock;
    listNodeChildren: jest.Mock;
    updateNode: jest.Mock;
    updateNodeContent: jest.Mock;
  };
  let versionsApi: { listVersionHistory: jest.Mock; revertVersion: jest.Mock };

  beforeEach(() => {
    nodesApi = {
      createNode: jest.fn(),
      deleteNode: jest.fn(),
      getNodeContent: jest.fn(),
      listNodeChildren: jest.fn(),
      updateNode: jest.fn(),
      updateNodeContent: jest.fn()
    };
    versionsApi = {
      listVersionHistory: jest.fn().mockResolvedValue({ list: { entries: [] } }),
      revertVersion: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        WorkflowFormsService,
        { provide: WORKFLOW_FORMS_NODES_API, useValue: nodesApi },
        { provide: WORKFLOW_FORMS_VERSIONS_API, useValue: versionsApi }
      ]
    });
    service = TestBed.inject(WorkflowFormsService);
  });

  it('loads form definitions from shared repository content', async () => {
    nodesApi.listNodeChildren.mockImplementation((nodeId: string) => {
      if (nodeId === '-shared-') {
        return Promise.resolve({ list: { entries: [{ entry: { id: 'forms-folder', name: 'Workflow Commander Forms' } }], pagination: {} } });
      }
      return Promise.resolve({
        list: {
          entries: [{ entry: { id: 'form-node', name: 'form-form-1.json', nodeType: 'cm:content' } }],
          pagination: {}
        }
      });
    });
    nodesApi.getNodeContent.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify({ id: 'form-1', title: 'Expense request', schema: { type: 'default', components: [] } }))
    });

    await expect(service.listForms()).resolves.toEqual([
      {
        id: 'form-1',
        title: 'Expense request',
        schema: { type: 'default', components: [] },
        repositoryNodeId: 'form-node'
      }
    ]);
    expect(nodesApi.getNodeContent).toHaveBeenCalledWith('form-node');
  });

  it('finds the current form definition by its stable id', async () => {
    nodesApi.listNodeChildren.mockImplementation((nodeId: string) =>
      Promise.resolve({
        list: {
          entries:
            nodeId === '-shared-'
              ? [{ entry: { id: 'forms-folder', name: 'Workflow Commander Forms' } }]
              : [{ entry: { id: 'form-node', name: 'form-form-1.json', nodeType: 'cm:content' } }],
          pagination: {}
        }
      })
    );
    nodesApi.getNodeContent.mockResolvedValue({
      text: () =>
        Promise.resolve(JSON.stringify({ id: 'form-1', title: 'Updated request', schema: { type: 'default', components: [{ key: 'latest' }] } }))
    });

    await expect(service.getFormById('form-1')).resolves.toMatchObject({
      id: 'form-1',
      title: 'Updated request',
      schema: { type: 'default', components: [{ key: 'latest' }] }
    });
  });

  it('creates a shared folder and stores a new form as JSON content', async () => {
    nodesApi.listNodeChildren.mockResolvedValue({ list: { entries: [], pagination: {} } });
    nodesApi.createNode.mockImplementation((_parentId: string, body: { nodeType: string }) =>
      Promise.resolve({ entry: { id: body.nodeType === 'cm:folder' ? 'forms-folder' : 'form-node' } })
    );

    const result = await service.saveForm({
      title: 'Leave request',
      schema: { type: 'default', components: [] }
    });

    expect(nodesApi.createNode).toHaveBeenNthCalledWith(1, '-shared-', { name: 'Workflow Commander Forms', nodeType: 'cm:folder' });
    expect(nodesApi.createNode).toHaveBeenNthCalledWith(2, 'forms-folder', {
      name: `form-${result.id}.json`,
      nodeType: 'cm:content',
      properties: { 'cm:title': 'Leave request' }
    });
    expect(nodesApi.updateNodeContent).toHaveBeenCalledWith(
      'form-node',
      JSON.stringify({ id: result.id, title: 'Leave request', schema: { type: 'default', components: [] } }),
      { majorVersion: false, comment: 'Created workflow form' }
    );
    expect(result).toMatchObject({ title: 'Leave request', repositoryNodeId: 'form-node' });
  });

  it('rejects blank titles and invalid form schemas before writing to the repository', async () => {
    await expect(service.saveForm({ title: '   ', schema: { type: 'default', components: [] } })).rejects.toMatchObject({
      issue: { code: 'title-required' }
    });
    await expect(service.saveForm({ title: 'Leave request', schema: { type: 'default', components: {} } })).rejects.toMatchObject({
      issue: { code: 'schema-invalid' }
    });

    expect(nodesApi.listNodeChildren).not.toHaveBeenCalled();
    expect(nodesApi.createNode).not.toHaveBeenCalled();
  });

  it('rejects duplicate form titles without modifying the repository', async () => {
    nodesApi.listNodeChildren.mockImplementation((nodeId: string) =>
      Promise.resolve({
        list: {
          entries:
            nodeId === '-shared-'
              ? [{ entry: { id: 'forms-folder', name: 'Workflow Commander Forms' } }]
              : [{ entry: { id: 'form-node', name: 'form-form-1.json', nodeType: 'cm:content' } }],
          pagination: {}
        }
      })
    );
    nodesApi.getNodeContent.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify({ id: 'form-1', title: 'Expense request', schema: { type: 'default', components: [] } }))
    });

    await expect(service.saveForm({ title: ' expense request ', schema: { type: 'default', components: [] } })).rejects.toBeInstanceOf(
      WorkflowFormValidationError
    );
    await expect(service.saveForm({ title: 'Expense request', schema: { type: 'default', components: [] } })).rejects.toMatchObject({
      issue: { code: 'title-duplicate' }
    });
    expect(nodesApi.createNode).not.toHaveBeenCalled();
    expect(nodesApi.updateNodeContent).not.toHaveBeenCalled();
  });

  it('updates the JSON content and title of an existing form', async () => {
    nodesApi.listNodeChildren.mockImplementation((nodeId: string) =>
      Promise.resolve({
        list: {
          entries:
            nodeId === '-shared-'
              ? [{ entry: { id: 'forms-folder', name: 'Workflow Commander Forms' } }]
              : [{ entry: { id: 'form-node', name: 'form-form-1.json', nodeType: 'cm:content' } }],
          pagination: {}
        }
      })
    );
    nodesApi.getNodeContent.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify({ id: 'form-1', title: 'Current request', schema: { type: 'default', components: [] } }))
    });

    await service.saveForm({ id: 'form-1', title: 'Updated request', schema: { type: 'default', components: [] } });

    expect(nodesApi.updateNodeContent).toHaveBeenCalledWith(
      'form-node',
      JSON.stringify({ id: 'form-1', title: 'Updated request', schema: { type: 'default', components: [] } }),
      { majorVersion: false, comment: 'Updated workflow form' }
    );
    expect(nodesApi.updateNode).toHaveBeenCalledWith('form-node', { properties: { 'cm:title': 'Updated request' } });
    expect(nodesApi.createNode).not.toHaveBeenCalled();
  });

  it('removes an incomplete form file when content upload fails', async () => {
    nodesApi.listNodeChildren.mockResolvedValue({ list: { entries: [], pagination: {} } });
    nodesApi.createNode.mockImplementation((_parentId: string, body: { nodeType: string }) =>
      Promise.resolve({ entry: { id: body.nodeType === 'cm:folder' ? 'forms-folder' : 'form-node' } })
    );
    nodesApi.updateNodeContent.mockRejectedValue(new Error('upload failed'));

    await expect(service.saveForm({ title: 'Leave request', schema: { type: 'default', components: [] } })).rejects.toThrow('upload failed');
    expect(nodesApi.deleteNode).toHaveBeenCalledWith('form-node');
  });

  it('moves a deleted form to the repository trashcan', async () => {
    const form = {
      id: 'form-1',
      title: 'Request',
      schema: { type: 'default', components: [] },
      repositoryNodeId: 'form-node'
    };

    await service.deleteForm(form);

    expect(nodesApi.deleteNode).toHaveBeenCalledWith('form-node');
  });

  it('lists a form version history with the current version identified', async () => {
    versionsApi.listVersionHistory.mockResolvedValue({
      list: {
        entries: [
          { entry: { id: '2.0', modifiedAt: new Date('2026-09-27T10:00:00Z'), modifiedByUser: { displayName: 'Ada' } } },
          { entry: { id: '1.0', modifiedAt: new Date('2026-09-26T10:00:00Z'), versionComment: 'Created' } }
        ]
      }
    });
    const form = {
      id: 'form-1',
      title: 'Request',
      schema: { type: 'default', components: [] },
      repositoryNodeId: 'form-node'
    };

    await expect(service.listFormVersions(form)).resolves.toEqual([
      { id: '2.0', modifiedAt: new Date('2026-09-27T10:00:00Z'), modifiedBy: 'Ada', comment: undefined, isCurrent: true },
      { id: '1.0', modifiedAt: new Date('2026-09-26T10:00:00Z'), modifiedBy: undefined, comment: 'Created', isCurrent: false }
    ]);
    expect(versionsApi.listVersionHistory).toHaveBeenCalledWith('form-node', { maxItems: 100 });
  });

  it('restores an earlier form version and synchronizes its repository title', async () => {
    nodesApi.getNodeContent.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify({ id: 'form-1', title: 'Earlier request', schema: { type: 'default', components: [] } }))
    });
    const form = {
      id: 'form-1',
      title: 'Current request',
      schema: { type: 'default', components: [] },
      repositoryNodeId: 'form-node'
    };

    await expect(service.restoreFormVersion(form, '1.0')).resolves.toMatchObject({ title: 'Earlier request' });

    expect(versionsApi.revertVersion).toHaveBeenCalledWith('form-node', '1.0', {
      majorVersion: false,
      comment: 'Restored workflow form version 1.0'
    });
    expect(nodesApi.updateNode).toHaveBeenCalledWith('form-node', { properties: { 'cm:title': 'Earlier request' } });
  });
});
