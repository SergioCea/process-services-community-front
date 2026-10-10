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

import {Injectable, InjectionToken, inject} from '@angular/core';
import {AlfrescoApiService} from '@alfresco/adf-content-services';
import {NodesApi, VersionsApi} from '@alfresco/js-api';
import type {FormSchema} from '../components/process-editor/form-schemas';
import {
  validateWorkflowFormSchema,
  validateWorkflowFormTitle,
  WorkflowFormValidationError
} from './workflow-form-validation';

const SHARED_FOLDER_ID = '-shared-';
const FORMS_FOLDER_NAME = 'Workflow Commander Forms';
const FORM_FILE_PREFIX = 'form-';
const PAGE_SIZE = 100;

export const WORKFLOW_FORMS_NODES_API = new InjectionToken<NodesApi>('workflow forms nodes API', {
  providedIn: 'root',
  factory: () => new NodesApi(inject(AlfrescoApiService).getInstance())
});

export const WORKFLOW_FORMS_VERSIONS_API = new InjectionToken<VersionsApi>('workflow forms versions API', {
  providedIn: 'root',
  factory: () => new VersionsApi(inject(AlfrescoApiService).getInstance())
});

export interface WorkflowForm {
  id: string;
  title: string;
  schema: FormSchema;
  repositoryNodeId?: string;
}

export interface WorkflowFormVersion {
  id: string;
  modifiedAt: Date;
  modifiedBy?: string;
  comment?: string;
  isCurrent: boolean;
}

@Injectable({providedIn: 'root'})
export class WorkflowFormsService {
  private readonly nodesApi = inject(WORKFLOW_FORMS_NODES_API);
  private readonly versionsApi = inject(WORKFLOW_FORMS_VERSIONS_API);

  async listForms(): Promise<WorkflowForm[]> {
    const folderId = await this.findFormsFolder();
    if (!folderId) {
      return [];
    }

    const entries = await this.listAllChildren(folderId);
    const formEntries = entries.filter(
      (entry: any) => entry.entry?.nodeType === 'cm:content' && entry.entry.name?.startsWith(FORM_FILE_PREFIX) && entry.entry.name.endsWith('.json')
    );
    const forms = await Promise.all(formEntries.map((entry: any) => this.readForm(entry.entry)));

    return forms.filter((form): form is WorkflowForm => form !== null).sort((left, right) => left.title.localeCompare(right.title));
  }

  async getFormById(id: string): Promise<WorkflowForm | null> {
    return (await this.listForms()).find((form) => form.id === id) || null;
  }

  async deleteForm(form: WorkflowForm): Promise<void> {
    const nodeId = await this.getRepositoryNodeId(form);
    await this.nodesApi.deleteNode(nodeId);
  }

  async listFormVersions(form: WorkflowForm): Promise<WorkflowFormVersion[]> {
    const nodeId = await this.getRepositoryNodeId(form);
    const response = await this.versionsApi.listVersionHistory(nodeId, {maxItems: PAGE_SIZE});
    return (response.list?.entries ?? []).flatMap((versionEntry, index) => {
      const version = versionEntry.entry;
      if (!version?.id) {
        return [];
      }

      return [
        {
          id: version.id,
          modifiedAt: version.modifiedAt,
          modifiedBy: version.modifiedByUser?.displayName,
          comment: version.versionComment,
          isCurrent: index === 0
        }
      ];
    });
  }

  async restoreFormVersion(form: WorkflowForm, versionId: string): Promise<WorkflowForm> {
    const nodeId = await this.getRepositoryNodeId(form);
    await this.versionsApi.revertVersion(nodeId, versionId, {
      majorVersion: false,
      comment: `Restored workflow form version ${versionId}`
    });

    const restored = await this.readForm({id: nodeId});
    if (!restored) {
      throw new Error('The restored form could not be read from the repository.');
    }

    await this.nodesApi.updateNode(nodeId, {properties: {'cm:title': restored.title}});
    return restored;
  }

  async saveForm(form: Pick<WorkflowForm, 'title' | 'schema'> & Partial<Pick<WorkflowForm, 'id'>>): Promise<WorkflowForm> {
    const title = form.title.trim();
    const titleIssue = validateWorkflowFormTitle(title, [], form.id)[0];
    if (titleIssue) {
      throw new WorkflowFormValidationError(titleIssue);
    }

    const schemaIssue = validateWorkflowFormSchema(form.schema)[0];
    if (schemaIssue) {
      throw new WorkflowFormValidationError(schemaIssue);
    }

    const duplicateTitleIssue = validateWorkflowFormTitle(title, await this.listForms(), form.id).find((issue) => issue.code === 'title-duplicate');
    if (duplicateTitleIssue) {
      throw new WorkflowFormValidationError(duplicateTitleIssue);
    }

    const id = form.id || this.createFormId();
    const fileName = `${FORM_FILE_PREFIX}${id}.json`;
    const folderId = await this.getOrCreateFormsFolder();
    const existing = (await this.listAllChildren(folderId)).find((entry: any) => entry.entry?.name === fileName)?.entry;
    if (form.id && !existing) {
      throw new Error('The form no longer exists in the repository.');
    }

    const content = JSON.stringify({id, title, schema: form.schema});
    if (existing) {
      await this.nodesApi.updateNodeContent(existing.id, content, {
        majorVersion: false,
        comment: 'Updated workflow form'
      });
      await this.nodesApi.updateNode(existing.id, {properties: {'cm:title': title}});
      return {id, title, schema: form.schema, repositoryNodeId: existing.id};
    }

    const created = await this.nodesApi.createNode(folderId, {
      name: fileName,
      nodeType: 'cm:content',
      properties: {'cm:title': title}
    });
    const nodeId = (created as any).entry?.id;
    if (!nodeId) {
      throw new Error('The form file could not be created in the repository.');
    }

    try {
      await this.nodesApi.updateNodeContent(nodeId, content, {majorVersion: false, comment: 'Created workflow form'});
    } catch (error) {
      await Promise.resolve(this.nodesApi.deleteNode(nodeId)).catch(() => undefined);
      throw error;
    }

    return {id, title, schema: form.schema, repositoryNodeId: nodeId};
  }

  private createFormId(): string {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (randomUUID) {
      return randomUUID.call(globalThis.crypto);
    }
    return `form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private async getRepositoryNodeId(form: WorkflowForm): Promise<string> {
    if (form.repositoryNodeId) {
      return form.repositoryNodeId;
    }

    const existing = await this.getFormById(form.id);
    if (!existing?.repositoryNodeId) {
      throw new Error('The form no longer exists in the repository.');
    }

    return existing.repositoryNodeId;
  }

  private async readForm(entry: any): Promise<WorkflowForm | null> {
    try {
      const content = await this.nodesApi.getNodeContent(entry.id);
      const stored = JSON.parse(await content.text());
      if (
        typeof stored.id !== 'string' ||
        typeof stored.title !== 'string' ||
        !stored.schema ||
        typeof stored.schema !== 'object' ||
        Array.isArray(stored.schema)
      ) {
        return null;
      }

      return {
        id: stored.id,
        title: stored.title,
        schema: stored.schema as FormSchema,
        repositoryNodeId: entry.id
      };
    } catch {
      return null;
    }
  }

  private async findFormsFolder(): Promise<string | null> {
    const entry = (await this.listAllChildren(SHARED_FOLDER_ID)).find((child: any) => child.entry?.name === FORMS_FOLDER_NAME)?.entry;
    return entry?.id || null;
  }

  private async getOrCreateFormsFolder(): Promise<string> {
    const existingFolder = await this.findFormsFolder();
    if (existingFolder) {
      return existingFolder;
    }

    try {
      const created = await this.nodesApi.createNode(SHARED_FOLDER_ID, {
        name: FORMS_FOLDER_NAME,
        nodeType: 'cm:folder'
      });
      const folderId = (created as any).entry?.id;
      if (!folderId) {
        throw new Error('The shared forms folder could not be created.');
      }
      return folderId;
    } catch (error) {
      const folderCreatedByAnotherRequest = await this.findFormsFolder();
      if (folderCreatedByAnotherRequest) {
        return folderCreatedByAnotherRequest;
      }
      throw error;
    }
  }

  private async listAllChildren(parentId: string): Promise<any[]> {
    const entries: any[] = [];
    let skipCount = 0;
    let hasMoreItems = true;

    while (hasMoreItems) {
      const response: any = await this.nodesApi.listNodeChildren(parentId, {
        maxItems: PAGE_SIZE,
        skipCount,
        include: ['properties']
      });
      const pageEntries = response?.list?.entries || [];
      entries.push(...pageEntries);
      hasMoreItems = Boolean(response?.list?.pagination?.hasMoreItems);
      skipCount += pageEntries.length;
      if (pageEntries.length === 0) {
        break;
      }
    }

    return entries;
  }
}
