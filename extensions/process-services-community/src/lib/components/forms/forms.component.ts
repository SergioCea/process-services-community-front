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

import {CommonModule} from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NotificationService} from '@alfresco/adf-core';
import {PageLayoutComponent, ToolbarComponent} from '@alfresco/aca-shared';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {ContentActionRef} from '@alfresco/adf-extensions';
import {FormEditor} from '@bpmn-io/form-js';
import {Actions, ofType} from '@ngrx/effects';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {PscActionTypes} from '@sergiocg/process-services-community/store';
import type {FormSchema} from '../process-editor/form-schemas';
import {WorkflowFormsService, type WorkflowForm, type WorkflowFormVersion} from '../../services/workflow-forms.service';
import {createFormPropertiesContextActionModule} from './form-properties-context-action';
import {PscFormPropertiesDialogComponent, type FormPropertiesPanel} from './form-properties-dialog.component';
import {PscFormPreviewDialogComponent} from './form-preview-dialog.component';
import {PscFormDeleteDialogComponent} from './form-delete-dialog.component';
import {PscFormVersionsDialogComponent} from './form-versions-dialog.component';
import {firstValueFrom} from 'rxjs';
import {
  validateWorkflowFormSchema,
  validateWorkflowFormTitle,
  WorkflowFormValidationError,
  type WorkflowFormValidationIssue,
  WORKFLOW_FORM_TITLE_MAX_LENGTH
} from '../../services/workflow-form-validation';

@Component({
  selector: 'psc-forms',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageLayoutComponent,
    ToolbarComponent,
    TranslatePipe,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './forms.component.html',
  styleUrl: './forms.component.css',
  encapsulation: ViewEncapsulation.None
})
export class PscFormsComponent implements OnDestroy {
  readonly actions: ContentActionRef[] = [
    {
      id: 'psc.forms.create',
      title: 'PSC.FORMS.CREATE',
      icon: 'add',
      type: 'button',
      data: {buttonType: 'flat-button', color: 'primary'},
      actions: {click: PscActionTypes.CreateForm}
    }
  ];

  forms: WorkflowForm[] = [];
  readonly formTitle = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(WORKFLOW_FORM_TITLE_MAX_LENGTH),
      (control) => (control.value.trim() ? null : {whitespace: true}),
      (control) => (this.hasDuplicateTitle(control.value) ? {duplicate: true} : null)
    ]
  });
  readonly maxFormTitleLength = WORKFLOW_FORM_TITLE_MAX_LENGTH;
  isLoading = true;
  isSaving = false;
  isEditing = false;
  isEditorReady = false;
  errorMessage = '';
  formValidationIssues: WorkflowFormValidationIssue[] = [];

  get isSaveDisabled(): boolean {
    return this.isSaving || !this.isEditorReady || this.formTitle.invalid;
  }

  private readonly dialog = inject(MatDialog);
  private readonly formsService = inject(WorkflowFormsService);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly ngZone = inject(NgZone);
  private readonly actions$ = inject(Actions);
  private readonly destroyRef = inject(DestroyRef);
  private currentForm?: WorkflowForm;
  private formSchema: FormSchema = {schemaVersion: 1, type: 'default', components: []};
  private formEditor?: FormEditor;
  private editorReady: Promise<void> = Promise.resolve();
  private propertiesPanelHome?: HTMLElement;
  private propertiesPanel?: FormPropertiesPanel;
  private propertiesDialogRef?: MatDialogRef<PscFormPropertiesDialogComponent>;

  @ViewChild('propertiesPanelHome')
  set propertiesPanelHomeElement(container: ElementRef<HTMLElement> | undefined) {
    this.propertiesPanelHome = container?.nativeElement;
    this.attachPropertiesPanelHome();
  }

  @ViewChild('formEditorContainer')
  set formEditorContainer(container: ElementRef<HTMLElement> | undefined) {
    if (!container) {
      this.destroyFormEditor();
      return;
    }

    this.formEditor = new FormEditor({
      container: container.nativeElement,
      additionalModules: [createFormPropertiesContextActionModule(this.translateService.instant('PSC.FORMS.EDIT_PROPERTIES'))]
    });
    this.isEditorReady = false;
    this.editorReady = this.formEditor
      .importSchema(this.formSchema)
      .then(() => {
        this.isEditorReady = true;
      })
      .catch((error: unknown) => {
        console.error('Unable to open workflow form editor', error);
        this.errorMessage = this.translateService.instant('PSC.FORMS.EDITOR_ERROR');
      });
    this.formEditor.on('selection.changed', (event: { newSelection?: unknown[] | null }) => {
      if (!event.newSelection?.length) {
        this.ngZone.run(() => this.closePropertiesPanelDialog());
      }
    });
    this.formEditor.on('psc.form.properties.open', () => {
      this.ngZone.run(() => this.openPropertiesPanelDialog());
    });
    this.attachPropertiesPanelHome();
  }

  constructor() {
    this.actions$.pipe(ofType(PscActionTypes.CreateForm), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.createForm());
    void this.loadForms();
  }

  ngOnDestroy() {
    this.destroyFormEditor();
  }

  async loadForms() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      this.forms = await this.formsService.listForms();
      this.formTitle.updateValueAndValidity({emitEvent: false});
    } catch (error) {
      console.error('Unable to load workflow forms', error);
      this.errorMessage = this.translateService.instant('PSC.FORMS.LOAD_ERROR');
    } finally {
      this.isLoading = false;
    }
  }

  createForm() {
    this.openEditor();
  }

  editForm(form: WorkflowForm) {
    this.openEditor(form);
  }

  private openEditor(form?: WorkflowForm) {
    this.destroyFormEditor();
    this.currentForm = form;
    this.formTitle.setValue(form?.title ?? '');
    this.formTitle.markAsPristine();
    this.formTitle.markAsUntouched();
    this.formTitle.updateValueAndValidity({emitEvent: false});
    this.formValidationIssues = [];
    this.formSchema = form?.schema ?? {
      schemaVersion: 1,
      type: 'default',
      components: [
        {
          type: 'textfield',
          label: this.translateService.instant('PSC.FORMS.DEFAULT_FIELD'),
          key: 'name'
        }
      ]
    };

    this.errorMessage = '';
    this.isEditorReady = false;
    this.isEditing = true;
  }

  cancelEditing() {
    this.isEditing = false;
    this.destroyFormEditor();
  }

  async previewForm() {
    await this.editorReady;
    if (!this.formEditor || !this.isEditorReady) {
      return;
    }

    this.dialog.open(PscFormPreviewDialogComponent, {
      data: {
        title: this.formTitle.value.trim() || this.currentForm?.title || this.translateService.instant('PSC.FORMS.PREVIEW'),
        schema: this.formEditor.getSchema() as FormSchema
      },
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh'
    });
  }

  async saveForm() {
    if (this.isSaving) {
      return;
    }

    this.formTitle.markAsTouched();
    this.formTitle.updateValueAndValidity();
    if (this.formTitle.invalid) {
      return;
    }

    const title = this.formTitle.value.trim();
    this.isSaving = true;
    this.errorMessage = '';
    this.formValidationIssues = [];
    try {
      await this.editorReady;
      if (!this.formEditor || !this.isEditorReady) {
        return;
      }

      const schema = this.formEditor.getSchema() as FormSchema;
      this.formValidationIssues = validateWorkflowFormSchema(schema);
      if (this.formValidationIssues.length > 0) {
        return;
      }

      const saved = await this.formsService.saveForm({
        id: this.currentForm?.id,
        title,
        schema
      });
      this.notificationService.openSnackMessage(
        this.translateService.instant(this.currentForm ? 'PSC.FORMS.UPDATE_SUCCESS' : 'PSC.FORMS.CREATE_SUCCESS', {title: saved.title})
      );
      this.cancelEditing();
      await this.loadForms();
    } catch (error) {
      console.error('Unable to save workflow form', error);
      if (error instanceof WorkflowFormValidationError) {
        this.showWorkflowFormValidationIssue(error.issue);
      } else {
        this.errorMessage = this.translateService.instant('PSC.FORMS.SAVE_ERROR');
      }
    } finally {
      this.isSaving = false;
    }
  }

  async deleteForm(form: WorkflowForm) {
    const dialogRef = this.dialog.open(PscFormDeleteDialogComponent, {
      data: {title: form.title},
      width: '440px'
    });
    const confirmed = (await firstValueFrom(dialogRef.afterClosed())) as boolean | undefined;
    if (!confirmed) {
      return;
    }

    try {
      await this.formsService.deleteForm(form);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.FORMS.DELETE_SUCCESS', {title: form.title}));
      await this.loadForms();
    } catch (error) {
      console.error('Unable to delete workflow form', error);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.FORMS.DELETE_ERROR'));
    }
  }

  async openVersionHistory(form: WorkflowForm) {
    let versions: WorkflowFormVersion[];
    try {
      versions = await this.formsService.listFormVersions(form);
    } catch (error) {
      console.error('Unable to load workflow form versions', error);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.FORMS.VERSIONS_ERROR'));
      return;
    }

    const dialogRef = this.dialog.open(PscFormVersionsDialogComponent, {
      data: {title: form.title, versions},
      width: '560px',
      maxWidth: '95vw'
    });
    const versionId = (await firstValueFrom(dialogRef.afterClosed())) as string | undefined;
    if (!versionId) {
      return;
    }

    try {
      const restored = await this.formsService.restoreFormVersion(form, versionId);
      this.notificationService.openSnackMessage(
        this.translateService.instant('PSC.FORMS.RESTORE_SUCCESS', {title: restored.title, version: versionId})
      );
      await this.loadForms();
    } catch (error) {
      console.error('Unable to restore workflow form version', error);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.FORMS.RESTORE_ERROR'));
    }
  }

  private attachPropertiesPanelHome() {
    if (!this.formEditor || !this.propertiesPanelHome) {
      return;
    }

    this.propertiesPanel = this.formEditor.get<FormPropertiesPanel>('propertiesPanel');
    this.propertiesPanel.attachTo(this.propertiesPanelHome);
  }

  private openPropertiesPanelDialog() {
    if (!this.propertiesPanel || !this.propertiesPanelHome || this.propertiesDialogRef) {
      return;
    }

    const dialogRef = this.dialog.open(PscFormPropertiesDialogComponent, {
      data: {propertiesPanel: this.propertiesPanel, returnContainer: this.propertiesPanelHome},
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'psc-form-properties-dialog',
      ariaDescribedBy: 'psc-form-properties-hint',
      autoFocus: 'first-tabbable'
    });
    this.propertiesDialogRef = dialogRef;
    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.propertiesDialogRef === dialogRef) {
          this.propertiesDialogRef = undefined;
        }
      });
  }

  private closePropertiesPanelDialog() {
    this.propertiesDialogRef?.componentInstance.restorePanel();
    this.propertiesDialogRef?.close();
    this.propertiesDialogRef = undefined;
  }

  private destroyFormEditor() {
    this.closePropertiesPanelDialog();
    this.formEditor?.destroy();
    this.formEditor = undefined;
    this.propertiesPanel = undefined;
    this.propertiesPanelHome = undefined;
    this.isEditorReady = false;
  }

  formValidationMessage(issue: WorkflowFormValidationIssue): string {
    return this.translateService.instant(`PSC.FORMS.VALIDATION.${issue.code}`, {
      component: issue.componentIndex === undefined ? '' : issue.componentIndex + 1,
      key: issue.fieldKey ?? ''
    });
  }

  private hasDuplicateTitle(title: unknown): boolean {
    return (
      typeof title === 'string' &&
      validateWorkflowFormTitle(title, this.forms, this.currentForm?.id).some((issue) => issue.code === 'title-duplicate')
    );
  }

  private showWorkflowFormValidationIssue(issue: WorkflowFormValidationIssue) {
    const controlError: Record<string, string> = {
      'title-required': 'required',
      'title-too-long': 'maxlength',
      'title-duplicate': 'duplicate'
    };
    const errorKey = controlError[issue.code];
    if (errorKey) {
      this.formTitle.setErrors({...(this.formTitle.errors ?? {}), [errorKey]: true});
      this.formTitle.markAsTouched();
      return;
    }

    this.formValidationIssues = [issue];
  }
}
