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
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {AppExtensionService, PageLayoutComponent, ToolbarComponent} from '@alfresco/aca-shared';
import {NotificationService} from '@alfresco/adf-core';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {CreateAppendAnythingModule} from 'bpmn-js-create-append-anything';
import {BpmnPropertiesPanelModule, BpmnPropertiesProviderModule} from 'bpmn-js-properties-panel';
import {ActivitiPropertiesProviderModule, setFormTitleResolver} from './activiti-properties-provider';
import {activitiModdleExtension} from './activiti-moddle';
import {customTranslateModule, setTranslationLanguage} from './custom-translate';
import {FormEditor} from '@bpmn-io/form-js';
import {AlfrescoApiService} from '@alfresco/adf-content-services';
import {WebscriptApi} from '@alfresco/js-api';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Actions, ofType} from '@ngrx/effects';
import {map} from 'rxjs/operators';
import {ContentActionRef} from '@alfresco/adf-extensions';
import {MatDialog} from '@angular/material/dialog';
import {firstValueFrom} from 'rxjs';

import {ActivatedRoute, Router} from '@angular/router';
import {PscActionTypes} from '@sergiocg/process-services-community/store';
import {deserializeFormSchemas, FormSchema, serializeFormSchemas} from './form-schemas';
import {PscSelectFormDialogComponent} from '../forms/select-form-dialog.component';
import {WorkflowFormsService, type WorkflowForm} from '../../services/workflow-forms.service';
import {
  findDuplicateProcessDefinitions,
  isBlockingProcessValidationIssue,
  mapProcessDeploymentError,
  PROCESS_NAME_MAX_LENGTH,
  validateProcessDefinition,
  type ProcessValidationIssue
} from './process-validation';

interface BpmnSelectionElement {
  id: string;
}

@Component({
  selector: 'psc-process-editor',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    PageLayoutComponent,
    TranslatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './process-editor.component.html',
  styleUrl: './process-editor.component.css',
  encapsulation: ViewEncapsulation.None
})
export class PscProcessEditorComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', {static: true}) canvas: ElementRef;
  @ViewChild('properties', {static: true}) properties: ElementRef;

  @ViewChild('formEditorContainer') set formEditorRef(content: ElementRef) {
    if (content) {
      this.initFormEditor(content.nativeElement);
    }
  }

  private bpmnModeler: BpmnModeler;
  private formEditor: any;
  private readonly apiService = inject(AlfrescoApiService);
  private readonly extensionService = inject(AppExtensionService);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly actions$ = inject(Actions);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly formsService = inject(WorkflowFormsService);
  private readonly formKeySelectHandler = (event: { element: any }) => this.openFormSelection(event.element);
  private readonly processChangedHandler = () => this.ngZone.run(() => this.refreshProcessValidation());
  private readonly formTitles = new Map<string, string>();
  private toolbarActions: ContentActionRef[] = [];
  private currentProcessId?: string;

  actions: Array<ContentActionRef> = [];
  selectedElement: any;
  showFormEditor = false;
  isEditorReady = false;
  isSaving = false;
  validationErrors: ProcessValidationIssue[] = [];
  formsMap = new Map<string, FormSchema>();
  isPropertiesPanelExpanded = true;

  ngOnInit() {
    setFormTitleResolver((formKey) => this.formTitles.get(formKey));

    this.extensionService
      .getAllowedToolbarActions()
      .pipe(
        map((actions) => actions.filter((action) => action.id.startsWith('psc.editor.'))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((actions) => {
        this.toolbarActions = actions;
        this.updateToolbarActions();
      });

    this.actions$.pipe(ofType(PscActionTypes.SaveProcess), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.onSave();
    });

    this.actions$.pipe(ofType(PscActionTypes.CreateProcess), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.createNewDiagram();
    });

    setTranslationLanguage(this.translateService.currentLang || 'es');

    this.bpmnModeler = new BpmnModeler({
      container: this.canvas.nativeElement,
      propertiesPanel: {
        parent: this.properties.nativeElement
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CreateAppendAnythingModule,
        ActivitiPropertiesProviderModule,
        customTranslateModule
      ],
      moddleExtensions: {
        activiti: activitiModdleExtension
      }
    });
    const eventBus: any = this.bpmnModeler.get('eventBus');
    eventBus.on('process-services-community.form-key.select', this.formKeySelectHandler);
    eventBus.on('commandStack.changed', this.processChangedHandler);
    void this.loadFormTitles();

    const processId = this.route.snapshot.queryParamMap.get('id');
    this.currentProcessId = processId ?? undefined;
    if (processId) {
      void this.loadProcess(processId);
    } else {
      void this.createNewDiagram();
    }
  }

  ngOnDestroy() {
    setFormTitleResolver(() => undefined);
    if (this.bpmnModeler) {
      const eventBus: any = this.bpmnModeler.get('eventBus');
      eventBus.off('process-services-community.form-key.select', this.formKeySelectHandler);
      eventBus.off('commandStack.changed', this.processChangedHandler);
      this.bpmnModeler.destroy();
    }
    this.formEditor?.destroy?.();
  }

  togglePropertiesPanel() {
    this.isPropertiesPanelExpanded = !this.isPropertiesPanelExpanded;
    setTimeout(() => {
      if (this.bpmnModeler) {
        const canvas: any = this.bpmnModeler.get('canvas');
        canvas.resized();
      }
    }, 300);
  }

  cancelFormEditing() {
    this.showFormEditor = false;
    this.updateToolbarActions();
  }

  focusValidationError(issue: ProcessValidationIssue) {
    if (!this.bpmnModeler) {
      return;
    }

    const elementRegistry = this.bpmnModeler.get('elementRegistry') as {
      get: (id: string) => BpmnSelectionElement | undefined
    };
    const canvas = this.bpmnModeler.get('canvas') as { getRootElement: () => BpmnSelectionElement };
    const target = issue.elementId ? elementRegistry.get(issue.elementId) : canvas.getRootElement();
    if (!target) {
      return;
    }

    this.isPropertiesPanelExpanded = true;
    (this.bpmnModeler.get('selection') as { select: (element: BpmnSelectionElement) => void }).select(target);
    this.cdr.markForCheck();
  }

  validationIssueFieldLabel(issue: ProcessValidationIssue): string {
    return this.translateService.instant(`PSC.EDITOR.VALIDATION.FIELDS.${issue.field}`);
  }

  validationIssueMessage(issue: ProcessValidationIssue): string {
    return this.translateService.instant(`PSC.EDITOR.VALIDATION.${issue.code}`, {
      element: issue.elementId ?? '',
      max: PROCESS_NAME_MAX_LENGTH
    });
  }

  validationIssueLabel(issue: ProcessValidationIssue): string {
    return `${this.validationIssueFieldLabel(issue)}: ${this.validationIssueMessage(issue)}`;
  }

  private async loadProcess(id: string) {
    this.isEditorReady = false;
    this.updateToolbarActions();
    const webScriptApi = new WebscriptApi(this.apiService.getInstance());
    try {
      const res: any = await webScriptApi.executeWebScript('GET', 'process-services-community/definition', {id}, 'alfresco', 'service');
      if (res?.xml) {
        await this.bpmnModeler.importXML(res.xml);
        this.formsMap = deserializeFormSchemas(res.forms);

        if (res.title) {
          const canvas: any = this.bpmnModeler.get('canvas');
          const rootElement = canvas.getRootElement();
          const modeling: any = this.bpmnModeler.get('modeling');
          modeling.updateProperties(rootElement, {name: res.title});
        }

        this.isEditorReady = true;
        this.refreshProcessValidation();
        this.cdr.detectChanges();
      } else {
        this.setValidationErrors([{code: 'process-required', field: 'definition'}]);
      }
    } catch {
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.PROCESS_LOAD_ERROR'));
      await this.createNewDiagram();
    }
  }

  private initFormEditor(container: HTMLElement) {
    this.formEditor = new FormEditor({
      container
    });

    const selection: any = this.bpmnModeler.get('selection');
    const existingForm = this.formsMap.get(selection.get()[0]?.id) || this.getDefaultForm();
    void this.formEditor.importSchema(existingForm).catch(() => {
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.FORMS.EDITOR_ERROR'));
      this.cancelFormEditing();
    });
  }

  private getDefaultForm() {
    return {
      schemaVersion: 1,
      components: [
        {
          type: 'textfield',
          label: this.translateService.instant('PSC.EDITOR.FORM.FIELDS.NAME'),
          key: 'name'
        }
      ],
      type: 'default'
    };
  }

  openFormEditor() {
    this.showFormEditor = true;
    this.isPropertiesPanelExpanded = true;
    this.updateToolbarActions();
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.bpmnModeler) {
        const canvas: any = this.bpmnModeler.get('canvas');
        canvas.resized();
      }
    }, 300);
  }

  hasForm() {
    const selection: any = this.bpmnModeler.get('selection');
    return this.formsMap.has(selection.get()[0]?.id);
  }

  private async openFormSelection(element: any) {
    try {
      const forms = await this.formsService.listForms();
      forms.forEach((form) => this.formTitles.set(form.id, form.title));
      const currentFormKey = element.businessObject.get('activiti:formKey');
      const selectedForm = forms.find((form) => form.id === currentFormKey);
      this.refreshFormTitle(element);
      const dialogRef = this.dialog.open(PscSelectFormDialogComponent, {
        data: {
          forms,
          selectedFormId: selectedForm?.id,
          hasCurrentForm: Boolean(element.businessObject.get('activiti:formKey'))
        },
        width: '480px'
      });
      const result = (await firstValueFrom(dialogRef.afterClosed())) as WorkflowForm | { clear: true } | undefined;
      if (!result) {
        return;
      }

      const modeling: any = this.bpmnModeler.get('modeling');
      if ('clear' in result) {
        this.formsMap.delete(element.id);
        modeling.updateProperties(element, {'activiti:formKey': undefined});
        this.refreshProcessValidation();
        return;
      }

      this.formsMap.set(element.id, result.schema);
      modeling.updateProperties(element, {'activiti:formKey': result.id});
      this.refreshProcessValidation();
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.FORM_ASSOCIATED', {title: result.title}));
    } catch (error) {
      console.error('Unable to select workflow form', error);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.FORMS.LOAD_ERROR'));
    }
  }

  goBack() {
    this.router.navigate(['/process-services-community']);
  }

  private async loadFormTitles() {
    try {
      const forms = await this.formsService.listForms();
      forms.forEach((form) => this.formTitles.set(form.id, form.title));

      const selection: any = this.bpmnModeler?.get('selection');
      const element = selection?.get()[0];
      if (element) {
        this.refreshFormTitle(element);
      }
    } catch (error) {
      console.error('Unable to load workflow form titles', error);
    }
  }

  private refreshFormTitle(element: any) {
    const eventBus: any = this.bpmnModeler?.get('eventBus');
    eventBus?.fire('elements.changed', {elements: [element]});
  }

  async saveForm() {
    const selection: any = this.bpmnModeler.get('selection');
    const selectedElement = selection.get()[0];
    if (this.formEditor && selectedElement) {
      const schema = this.formEditor.getSchema();
      this.formsMap.set(selectedElement.id, schema);
      this.notificationService.openSnackMessage('PSC.MESSAGES.FORM_SAVED');
      this.showFormEditor = false;

      // Link form to task in BPMN
      const modeling: any = this.bpmnModeler.get('modeling');
      modeling.updateProperties(selectedElement, {
        'activiti:formKey': `form-${selectedElement.id}`
      });
      this.refreshProcessValidation();
      this.updateToolbarActions();
    }
  }

  async createNewDiagram() {
    if (this.isSaving || this.showFormEditor) {
      return;
    }

    this.isEditorReady = false;
    this.currentProcessId = undefined;
    this.setValidationErrors([]);
    this.updateToolbarActions();
    const initialDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:activiti="http://activiti.org/bpmn"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" name="New Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    try {
      await this.bpmnModeler.importXML(initialDiagram);
      const canvas: any = this.bpmnModeler.get('canvas');
      this.selectedElement = canvas.getRootElement();
      this.formsMap.clear();
      this.isEditorReady = true;
      this.refreshProcessValidation();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error importing initial BPMN XML', err);
      this.setValidationErrors([{code: 'process-required', field: 'definition'}]);
    }
  }

  async onSave() {
    if (this.isSaving || !this.isEditorReady || this.showFormEditor || !this.bpmnModeler) {
      return;
    }

    this.isSaving = true;
    this.updateToolbarActions();
    try {
      const definitions = this.bpmnModeler.getDefinitions();
      const localIssues = validateProcessDefinition(definitions, this.formsMap);
      this.setValidationErrors(localIssues);
      if (localIssues.some(isBlockingProcessValidationIssue)) {
        return;
      }

      const definitionModel = definitions as { rootElements?: Array<{ $type?: string; id?: string; name?: string }> };
      const process = definitionModel.rootElements?.find((element) => element.$type === 'bpmn:Process');
      if (!process) {
        this.setValidationErrors([{code: 'process-required', field: 'definition'}]);
        return;
      }

      const processId = process.id ?? '';
      const processName = process.name?.trim() ?? '';
      const {xml} = await this.bpmnModeler.saveXML();
      const body = {
        id: processId,
        name: processName,
        title: processName,
        xml,
        forms: serializeFormSchemas(new Map(this.formsMap))
      };

      const webScriptApi = new WebscriptApi(this.apiService.getInstance());
      let listResponse: { entries?: unknown } | null;
      try {
        listResponse = (await webScriptApi.executeWebScript('GET', 'process-services-community/list', [], 'alfresco', 'service')) as {
          entries?: unknown;
        };
      } catch (error) {
        console.error('Unable to check existing process definitions', error);
        this.setValidationErrors([{code: 'duplicate-check-failed', field: 'definition'}]);
        return;
      }

      if (!listResponse || !Array.isArray(listResponse.entries)) {
        this.setValidationErrors([{code: 'duplicate-check-failed', field: 'definition'}]);
        return;
      }

      const duplicateIssues = findDuplicateProcessDefinitions(listResponse.entries, {
        id: processId,
        name: processName
      }, this.currentProcessId);
      if (duplicateIssues.length > 0) {
        this.setValidationErrors(duplicateIssues);
        return;
      }

      await webScriptApi.executeWebScript('POST', 'process-services-community/deploy', [], 'alfresco', 'service', body);
      this.setValidationErrors([]);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.DEPLOY_SUCCESS'));
    } catch (error) {
      console.error('Error deploying process definition', error);
      const backendIssues = mapProcessDeploymentError(error);
      this.setValidationErrors(backendIssues);
      this.notificationService.openSnackMessage(
        this.translateService.instant(
          backendIssues[0]?.code === 'deployment-failed' ? 'PSC.MESSAGES.DEPLOY_ERROR' : 'PSC.MESSAGES.DEPLOY_VALIDATION_ERROR'
        )
      );
    } finally {
      this.isSaving = false;
      this.updateToolbarActions();
      this.cdr.markForCheck();
    }
  }

  private refreshProcessValidation() {
    if (!this.bpmnModeler) {
      return;
    }

    this.setValidationErrors(validateProcessDefinition(this.bpmnModeler.getDefinitions(), this.formsMap));
  }

  private setValidationErrors(issues: ProcessValidationIssue[]) {
    this.validationErrors = issues;
    this.updateToolbarActions();
    this.cdr.markForCheck();
  }

  private updateToolbarActions() {
    const hasBlockingValidationErrors = this.validationErrors.some(isBlockingProcessValidationIssue);
    this.actions = this.toolbarActions.map((action) => {
      if (action.id === 'psc.editor.save') {
        return {
          ...action,
          disabled: Boolean(action.disabled) || this.isSaving || !this.isEditorReady || this.showFormEditor || hasBlockingValidationErrors
        };
      }
      if (action.id === 'psc.editor.new') {
        return {...action, disabled: Boolean(action.disabled) || this.isSaving || this.showFormEditor};
      }
      return action;
    });
  }
}
