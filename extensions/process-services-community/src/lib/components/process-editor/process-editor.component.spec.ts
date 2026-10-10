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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { WebscriptApi } from '@alfresco/js-api';
import type { ContentActionRef } from '@alfresco/adf-extensions';
import { AppExtensionService, AppService } from '@alfresco/aca-shared';
import { NotificationService, RedirectAuthService } from '@alfresco/adf-core';
import { AlfrescoApiService } from '@alfresco/adf-content-services';
import { Actions } from '@ngrx/effects';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY, of, Subject } from 'rxjs';
import { WorkflowFormsService } from '../../services/workflow-forms.service';
import { PscProcessEditorComponent } from './process-editor.component';

jest.mock('bpmn-js/lib/Modeler', () => jest.fn());
jest.mock('bpmn-js-create-append-anything', () => ({ CreateAppendAnythingModule: {} }));
jest.mock('bpmn-js-properties-panel', () => ({ BpmnPropertiesPanelModule: {}, BpmnPropertiesProviderModule: {} }));
jest.mock('@bpmn-io/form-js', () => ({ FormEditor: jest.fn() }));
jest.mock('./activiti-properties-provider', () => ({ ActivitiPropertiesProviderModule: {}, setFormTitleResolver: jest.fn() }));
jest.mock('./activiti-moddle', () => ({ activitiModdleExtension: {} }));
jest.mock('./custom-translate', () => ({ customTranslateModule: {}, setTranslationLanguage: jest.fn() }));

describe('PscProcessEditorComponent', () => {
  let component: PscProcessEditorComponent;
  let fixture: ComponentFixture<PscProcessEditorComponent>;
  let formsService: { listForms: jest.Mock };
  let dialog: { open: jest.Mock };
  let router: { navigate: jest.Mock };
  let notificationService: { openSnackMessage: jest.Mock };
  let webscriptExecute: jest.SpyInstance | undefined;

  const currentForm = { id: 'form-current', title: 'Current form', schema: { type: 'default', components: [{ key: 'current' }] } };
  const replacementForm = { id: 'form-replacement', title: 'Replacement form', schema: { type: 'default', components: [{ key: 'replacement' }] } };

  beforeEach(async () => {
    jest.clearAllMocks();
    webscriptExecute = jest.spyOn(WebscriptApi.prototype, 'executeWebScript');
    formsService = { listForms: jest.fn().mockResolvedValue([currentForm, replacementForm]) };
    dialog = { open: jest.fn().mockReturnValue({ afterClosed: () => of(replacementForm) }) };
    router = { navigate: jest.fn() };
    notificationService = { openSnackMessage: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [PscProcessEditorComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AppExtensionService, useValue: { getAllowedToolbarActions: () => EMPTY } },
        { provide: AppService, useValue: { appNavNarMode$: new Subject(), toggleAppNavBar$: new Subject() } },
        { provide: AlfrescoApiService, useValue: { getInstance: jest.fn().mockReturnValue({}) } },
        { provide: Actions, useValue: new Subject() },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notificationService },
        { provide: RedirectAuthService, useValue: { onLogin: EMPTY, onTokenReceived: EMPTY } },
        { provide: WorkflowFormsService, useValue: formsService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PscProcessEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => webscriptExecute?.mockRestore());

  it('updates the BPMN form key to the selected catalog form id', async () => {
    const elementId = 'UserTask_1';
    const element = { id: elementId, businessObject: { get: () => currentForm.id } };
    const modeling = { updateProperties: jest.fn() };
    const eventBus = { off: jest.fn(), fire: jest.fn() };
    (component as any).bpmnModeler = {
      destroy: jest.fn(),
      getDefinitions: () => ({ rootElements: [createProcess()] }),
      get: jest.fn((service: string) => (service === 'eventBus' ? eventBus : modeling))
    };
    component.formsMap.set(elementId, currentForm.schema);

    await (component as any).openFormSelection(element);

    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: expect.objectContaining({ selectedFormId: currentForm.id }) })
    );
    expect(modeling.updateProperties).toHaveBeenCalledWith(element, { 'activiti:formKey': replacementForm.id });
    expect(component.formsMap.get(elementId)).toBe(replacementForm.schema);
  });

  it('does not select a catalog form based only on a matching schema', async () => {
    const elementId = 'StartEvent_1';
    const element = { id: elementId, businessObject: { get: () => 'form-StartEvent_1' } };
    const modeling = { updateProperties: jest.fn() };
    const eventBus = { off: jest.fn(), fire: jest.fn() };
    (component as any).bpmnModeler = {
      destroy: jest.fn(),
      getDefinitions: () => ({ rootElements: [createProcess()] }),
      get: jest.fn((service: string) => (service === 'eventBus' ? eventBus : modeling))
    };
    component.formsMap.set(elementId, currentForm.schema);

    await (component as any).openFormSelection(element);

    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: expect.objectContaining({ selectedFormId: undefined }) })
    );
  });

  it('returns to the process list', () => {
    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/process-services-community']);
  });

  it('blocks invalid process metadata and incomplete definitions before making an API request', async () => {
    attachModeler(createProcess({ id: 'bad process', name: '   ', flowElements: [] }));

    await component.onSave();

    expect(webscriptExecute).not.toHaveBeenCalled();
    expect(component.validationErrors).toEqual(
      expect.arrayContaining([
        { code: 'process-id-invalid', field: 'id' },
        { code: 'process-name-required', field: 'name' },
        { code: 'start-event-required', field: 'definition' }
      ])
    );
    expect(component.isSaving).toBe(false);
  });

  it('checks process-name duplicates before attempting deployment', async () => {
    webscriptExecute?.mockResolvedValueOnce({ entries: [{ id: 'expense:1:deployment', key: 'expense', name: 'New Process' }] });
    attachModeler();

    await component.onSave();

    expect(webscriptExecute).toHaveBeenCalledTimes(1);
    expect(component.validationErrors).toContainEqual({ code: 'process-name-duplicate', field: 'name' });
  });

  it('deploys a valid process after a successful duplicate check', async () => {
    webscriptExecute?.mockResolvedValueOnce({ entries: [] }).mockResolvedValueOnce({ id: 'deployment-1' });
    attachModeler();

    await component.onSave();

    expect(webscriptExecute).toHaveBeenNthCalledWith(1, 'GET', 'process-services-community/list', [], 'alfresco', 'service');
    expect(webscriptExecute).toHaveBeenNthCalledWith(
      2,
      'POST',
      'process-services-community/deploy',
      [],
      'alfresco',
      'service',
      expect.objectContaining({ id: 'Process_1', name: 'New Process', title: 'New Process', xml: '<bpmn:definitions />' })
    );
    expect(notificationService.openSnackMessage).toHaveBeenCalledWith('PSC.MESSAGES.DEPLOY_SUCCESS');
    expect(component.validationErrors).toEqual([]);
    expect(component.isSaving).toBe(false);
  });

  it('maps backend validation errors to the process field and keeps the editor available', async () => {
    webscriptExecute
      ?.mockResolvedValueOnce({ entries: [] })
      .mockRejectedValueOnce({ error: { validationErrors: [{ field: 'processId', code: 'DUPLICATE_PROCESS_ID', message: 'internal exception' }] } });
    attachModeler();

    await component.onSave();

    expect(component.validationErrors).toEqual([{ code: 'process-id-duplicate', field: 'id' }]);
    expect(notificationService.openSnackMessage).toHaveBeenCalledWith('PSC.MESSAGES.DEPLOY_VALIDATION_ERROR');
    expect(component.isSaving).toBe(false);
  });

  it('shows loading and disables save while a request is pending, ignoring a second submit', async () => {
    let finishDuplicateCheck: (response: { entries: unknown[] }) => void = () => undefined;
    webscriptExecute?.mockImplementationOnce(() => new Promise((resolve) => (finishDuplicateCheck = resolve))).mockResolvedValueOnce({});
    attachModeler();

    const toolbar = component as unknown as { toolbarActions: ContentActionRef[]; updateToolbarActions: () => void };
    toolbar.toolbarActions = [{ id: 'psc.editor.save' } as ContentActionRef];
    toolbar.updateToolbarActions();
    expect(component.actions[0].disabled).toBe(false);

    const saving = component.onSave();
    expect(component.isSaving).toBe(true);
    expect(component.actions[0].disabled).toBe(true);
    await component.onSave();
    expect(webscriptExecute).toHaveBeenCalledTimes(1);

    finishDuplicateCheck({ entries: [] });
    await saving;

    expect(webscriptExecute).toHaveBeenCalledTimes(2);
    expect(component.isSaving).toBe(false);
    expect(component.actions[0].disabled).toBe(false);
  });

  function attachModeler(process = createProcess()) {
    const modeler = {
      getDefinitions: jest.fn(() => ({ rootElements: [process] })),
      saveXML: jest.fn().mockResolvedValue({ xml: '<bpmn:definitions />' }),
      get: jest.fn(() => ({ off: jest.fn() })),
      destroy: jest.fn()
    };
    Object.defineProperty(component, 'bpmnModeler', { configurable: true, writable: true, value: modeler });
    component.isEditorReady = true;
    return modeler;
  }

  function createProcess(overrides: Partial<{ id: string; name: string; isExecutable: boolean; flowElements: unknown[] }> = {}) {
    return {
      $type: 'bpmn:Process',
      id: 'Process_1',
      name: 'New Process',
      isExecutable: true,
      flowElements: [{ $type: 'bpmn:StartEvent', id: 'StartEvent_1' }],
      ...overrides
    };
  }
});
