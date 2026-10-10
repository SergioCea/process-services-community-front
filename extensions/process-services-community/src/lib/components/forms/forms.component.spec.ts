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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ElementRef, NgZone} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {NotificationService} from '@alfresco/adf-core';
import {FormEditor} from '@bpmn-io/form-js';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Actions} from '@ngrx/effects';
import {TranslateService} from '@ngx-translate/core';
import {Subject} from 'rxjs';
import {PscActionTypes} from '@sergiocg/process-services-community/store';
import {WorkflowFormsService, type WorkflowForm} from '../../services/workflow-forms.service';
import {WORKFLOW_FORM_TITLE_MAX_LENGTH} from '../../services/workflow-form-validation';
import {PscFormPropertiesDialogComponent, type FormPropertiesPanel} from './form-properties-dialog.component';
import {PscFormPreviewDialogComponent} from './form-preview-dialog.component';
import {PscFormsComponent} from './forms.component';

function appendPropertiesPanelCheckbox(parent: HTMLElement): HTMLInputElement {
  const dialogContent = document.createElement('div');
  dialogContent.className = 'psc-form-properties-content';
  const propertiesPanel = document.createElement('div');
  propertiesPanel.className = 'bio-properties-panel';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'bio-properties-panel-input';
  propertiesPanel.append(checkbox);
  dialogContent.append(propertiesPanel);
  parent.append(dialogContent);
  return checkbox;
}

jest.mock('@bpmn-io/form-js', () => ({FormEditor: jest.fn(), Form: jest.fn()}));

describe('PscFormsComponent', () => {
  let fixture: ComponentFixture<PscFormsComponent>;
  let actions: Subject<{ type: string }>;
  let dialog: { open: jest.Mock };
  let dialogRef: { close: jest.Mock; afterClosed: jest.Mock; componentInstance: { restorePanel: jest.Mock } };
  let formsService: {
    listForms: jest.Mock;
    saveForm: jest.Mock;
    deleteForm: jest.Mock;
    listFormVersions: jest.Mock;
    restoreFormVersion: jest.Mock;
  };
  let notificationService: { openSnackMessage: jest.Mock };
  let formEditor: { importSchema: jest.Mock; getSchema: jest.Mock; get: jest.Mock; on: jest.Mock; destroy: jest.Mock };
  let propertiesPanel: FormPropertiesPanel;
  let selectionChanged: (event: { newSelection?: unknown[] | null }) => void = () => undefined;
  let propertiesDialogRequested: () => void = () => undefined;
  let dialogClosed: Subject<unknown>;

  beforeEach(async () => {
    jest.clearAllMocks();
    actions = new Subject<{ type: string }>();
    dialogClosed = new Subject<unknown>();
    dialogRef = {
      close: jest.fn(() => dialogClosed.next(undefined)),
      afterClosed: jest.fn(() => dialogClosed.asObservable()),
      componentInstance: {restorePanel: jest.fn()}
    };
    dialog = {open: jest.fn().mockReturnValue(dialogRef)};
    formsService = {
      listForms: jest.fn().mockResolvedValue([]),
      saveForm: jest.fn().mockResolvedValue({title: 'Example'}),
      deleteForm: jest.fn().mockResolvedValue(undefined),
      listFormVersions: jest.fn().mockResolvedValue([]),
      restoreFormVersion: jest.fn().mockResolvedValue({title: 'Example'})
    };
    notificationService = {openSnackMessage: jest.fn()};
    propertiesPanel = {attachTo: jest.fn()};
    formEditor = {
      importSchema: jest.fn().mockResolvedValue({warnings: []}),
      getSchema: jest.fn().mockReturnValue({schemaVersion: 1, type: 'default', components: []}),
      get: jest.fn().mockReturnValue(propertiesPanel),
      on: jest.fn((event: string, callback: (event: { newSelection?: unknown[] | null }) => void) => {
        if (event === 'selection.changed') {
          selectionChanged = callback;
        } else if (event === 'psc.form.properties.open') {
          propertiesDialogRequested = () => callback({});
        }
      }),
      destroy: jest.fn()
    };
    jest.mocked(FormEditor).mockImplementation(() => formEditor as unknown as FormEditor);

    await TestBed.configureTestingModule({
      imports: [PscFormsComponent],
      providers: [
        {provide: Actions, useValue: actions},
        {provide: WorkflowFormsService, useValue: formsService},
        {provide: MatDialog, useValue: dialog},
        {provide: NotificationService, useValue: notificationService},
        {provide: TranslateService, useValue: {instant: (key: string) => key}}
      ]
    })
      .overrideComponent(PscFormsComponent, {set: {template: '', imports: []}})
      .compileComponents();

    fixture = TestBed.createComponent(PscFormsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('keeps form editing inline when the create action is dispatched', async () => {
    actions.next({type: PscActionTypes.CreateForm});

    expect(fixture.componentInstance.isEditing).toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(FormEditor).not.toHaveBeenCalled();
  });

  it('validates required, whitespace-only, maximum-length, and duplicate form titles', () => {
    const component = fixture.componentInstance;
    component.isEditorReady = true;

    expect(component.isSaveDisabled).toBe(true);
    component.formTitle.setValue('');
    expect(component.formTitle.hasError('required')).toBe(true);
    expect(component.isSaveDisabled).toBe(true);

    component.formTitle.setValue('   ');
    expect(component.formTitle.hasError('whitespace')).toBe(true);
    expect(component.isSaveDisabled).toBe(true);

    component.formTitle.setValue('Travel request');
    expect(component.formTitle.valid).toBe(true);
    expect(component.isSaveDisabled).toBe(false);

    component.formTitle.setValue('A'.repeat(WORKFLOW_FORM_TITLE_MAX_LENGTH + 1));
    expect(component.formTitle.hasError('maxlength')).toBe(true);
    expect(component.isSaveDisabled).toBe(true);

    component.forms = [{id: 'form-existing', title: 'Expense request', schema: {type: 'default', components: []}}];
    component.formTitle.setValue(' expense request ');
    expect(component.formTitle.hasError('duplicate')).toBe(true);
    expect(component.isSaveDisabled).toBe(true);
  });

  it('does not save a malformed field schema and exposes the offending component', async () => {
    actions.next({type: PscActionTypes.CreateForm});
    mountEditor();
    formEditor.getSchema.mockReturnValue({type: 'default', components: [{type: 'textfield', key: 'invalid key'}]});
    fixture.componentInstance.formTitle.setValue('Travel request');
    await fixture.whenStable();

    await fixture.componentInstance.saveForm();

    expect(formsService.saveForm).not.toHaveBeenCalled();
    expect(fixture.componentInstance.formValidationIssues).toEqual([{
      code: 'field-key-invalid',
      componentIndex: 0,
      fieldKey: 'invalid key'
    }]);
    expect(fixture.componentInstance.isSaving).toBe(false);
  });

  it('trims a valid title and prevents a concurrent second save', async () => {
    actions.next({type: PscActionTypes.CreateForm});
    mountEditor();
    await fixture.whenStable();
    fixture.componentInstance.formTitle.setValue('  Travel request  ');

    let finishSave: (form: { title: string }) => void = () => undefined;
    formsService.saveForm.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
    const firstSave = fixture.componentInstance.saveForm();
    await fixture.componentInstance.saveForm();
    await Promise.resolve();

    expect(formsService.saveForm).toHaveBeenCalledTimes(1);
    expect(formsService.saveForm).toHaveBeenCalledWith({
      id: undefined,
      title: 'Travel request',
      schema: formEditor.getSchema.mock.results[0]?.value
    });
    expect(fixture.componentInstance.isSaving).toBe(true);
    expect(fixture.componentInstance.isSaveDisabled).toBe(true);

    finishSave({title: 'Travel request'});
    await firstSave;
    expect(fixture.componentInstance.isSaving).toBe(false);
  });

  it('opens the properties dialog from the selected component edit action', async () => {
    actions.next({type: PscActionTypes.CreateForm});
    mountEditor();
    selectionChanged({newSelection: [{}]});

    expect(dialog.open).not.toHaveBeenCalled();
    expect(jest.mocked(FormEditor)).toHaveBeenCalledWith(
      expect.objectContaining({additionalModules: [expect.objectContaining({__init__: ['pscFormPropertiesContextActionProvider']})]})
    );

    const runInAngularZone = jest.spyOn(TestBed.inject(NgZone), 'run');
    propertiesDialogRequested();
    expect(runInAngularZone).toHaveBeenCalledWith(expect.any(Function));

    expect(dialog.open).toHaveBeenCalledWith(
      PscFormPropertiesDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({propertiesPanel, returnContainer: expect.any(HTMLElement)}),
        width: '560px',
        maxHeight: '90vh',
        ariaDescribedBy: 'psc-form-properties-hint',
        autoFocus: 'first-tabbable'
      })
    );

    selectionChanged({newSelection: []});

    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('opens a form preview using the current schema', async () => {
    actions.next({type: PscActionTypes.CreateForm});
    mountEditor();

    await fixture.componentInstance.previewForm();

    expect(dialog.open).toHaveBeenCalledWith(
      PscFormPreviewDialogComponent,
      expect.objectContaining({data: expect.objectContaining({schema: formEditor.getSchema.mock.results[0]?.value})})
    );
  });

  it('deletes a form after the confirmation dialog is accepted', async () => {
    const form: WorkflowForm = {
      id: 'form-1',
      title: 'Request',
      schema: {schemaVersion: 1, type: 'default', components: []},
      repositoryNodeId: 'form-node'
    };

    const deleting = fixture.componentInstance.deleteForm(form);
    dialogClosed.next(true);
    await deleting;

    expect(formsService.deleteForm).toHaveBeenCalledWith(form);
  });

  it('restores the selected earlier form version', async () => {
    const form: WorkflowForm = {
      id: 'form-1',
      title: 'Request',
      schema: {schemaVersion: 1, type: 'default', components: []},
      repositoryNodeId: 'form-node'
    };
    formsService.listFormVersions.mockResolvedValue([{id: '1.0', modifiedAt: new Date(), isCurrent: false}]);
    formsService.restoreFormVersion.mockResolvedValue({...form, title: 'Earlier request'});

    const restoring = fixture.componentInstance.openVersionHistory(form);
    await Promise.resolve();
    dialogClosed.next('1.0');
    await restoring;

    expect(formsService.restoreFormVersion).toHaveBeenCalledWith(form, '1.0');
  });

  it('styles field controls as compact form inputs and keeps checkboxes usable', () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync(join(__dirname, 'forms.component.css'), 'utf8').replace(/^@import[^;]*;\s*/gm, '');
    document.head.append(stylesheet);

    try {
      const checkbox = appendPropertiesPanelCheckbox(fixture.nativeElement);
      const propertiesContent = fixture.nativeElement.querySelector<HTMLElement>('.psc-form-properties-content');
      const propertiesPanel = propertiesContent?.querySelector<HTMLElement>('.bio-properties-panel');
      const propertyEntry = document.createElement('div');
      const propertyLabel = document.createElement('label');
      const textInput = document.createElement('input');
      const multilineInput = document.createElement('textarea');
      propertyEntry.className = 'bio-properties-panel-entry';
      propertyLabel.className = 'bio-properties-panel-label';
      textInput.type = 'text';
      propertyEntry.append(propertyLabel, textInput);
      propertiesPanel?.append(propertyEntry, multilineInput);

      const computedStyle = getComputedStyle(checkbox);
      const entryStyle = getComputedStyle(propertyEntry);
      const labelStyle = getComputedStyle(propertyLabel);
      const inputStyle = getComputedStyle(textInput);
      const multilineInputStyle = getComputedStyle(multilineInput);
      const panelStyle = getComputedStyle(propertiesPanel as HTMLElement);
      const compactEntryStyles =
        stylesheet.textContent.match(
          /@media \(max-width: 600px\)[\s\S]*?\.psc-form-properties-content \.bio-properties-panel-entry:not\(\.bio-properties-panel-checkbox-entry\) \{([^}]*)\}/
        )?.[1] ?? '';
      const narrowEntryStyles =
        stylesheet.textContent.match(
          /@media \(max-width: 360px\)[\s\S]*?\.psc-form-properties-content \.bio-properties-panel-entry:not\(\.bio-properties-panel-checkbox-entry\) \{([^}]*)\}/
        )?.[1] ?? '';
      expect(computedStyle.width).toBe('16px');
      expect(computedStyle.height).toBe('16px');
      expect(computedStyle.flexShrink).toBe('0');
      expect(computedStyle.appearance).toBe('auto');
      expect(entryStyle.display).toBe('grid');
      expect(labelStyle.marginTop).toBe('6px');
      expect(stylesheet.textContent).toContain('grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1.2fr);');
      expect(stylesheet.textContent).toContain('grid-column: 1;');
      expect(stylesheet.textContent).toContain('grid-column: 2;');
      expect(inputStyle.width).toBe('100%');
      expect(inputStyle.minHeight).toBe('32px');
      expect(multilineInputStyle.minHeight).toBe('64px');
      expect(panelStyle.getPropertyValue('--text-size-base').trim()).toBe('13px');
      expect(panelStyle.getPropertyValue('--text-line-height').trim()).toBe('18px');
      expect(panelStyle.overflow).toBe('visible');
      expect(compactEntryStyles).toContain('grid-template-columns: minmax(96px, 0.8fr) minmax(0, 1.2fr);');
      expect(narrowEntryStyles).toContain('grid-template-columns: minmax(0, 1fr);');
    } finally {
      stylesheet.remove();
    }
  });

  function mountEditor() {
    fixture.componentInstance.propertiesPanelHomeElement = new ElementRef(document.createElement('div'));
    fixture.componentInstance.formEditorContainer = new ElementRef(document.createElement('div'));
  }
});
