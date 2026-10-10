import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {ActivatedRoute, Router} from '@angular/router';
import {PageLayoutComponent} from '@alfresco/aca-shared';
import {NotificationService} from '@alfresco/adf-core';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import type {Form as FormViewer} from '@bpmn-io/form-js';
import {WorkflowTasksService} from '../../services/workflow-tasks.service';
import type {FormSchema} from '../process-editor/form-schemas';

interface WorkflowTaskView {
  id: string;
  name: string;
  formKey?: string;
  formSchema?: FormSchema | string | null;
}

interface FormSubmitEvent {
  data: Record<string, unknown>;
  errors?: Record<string, unknown>;
}

@Component({
  selector: 'psc-task-completion',
  imports: [CommonModule, PageLayoutComponent, TranslatePipe, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './task-completion.component.html',
  styleUrl: './task-completion.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PscTaskCompletionComponent implements OnInit, OnDestroy {
  readonly taskId = inject(ActivatedRoute).snapshot.paramMap.get('taskId') || '';
  task: WorkflowTaskView | null = null;
  schema: FormSchema | null = null;
  isLoading = true;
  isCompleting = false;
  errorMessage = '';
  renderError = '';

  private readonly tasksService = inject(WorkflowTasksService);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private formViewer?: FormViewer;
  private viewerReady: Promise<void> = Promise.resolve();
  private hasSubmitted = false;
  private isDestroyed = false;

  ngOnInit() {
    const navigationTask = this.router.getCurrentNavigation()?.extras.state?.['task'] as WorkflowTaskView | undefined;
    if (navigationTask?.id === this.taskId) {
      void this.setTask(navigationTask);
    } else {
      void this.loadTask();
    }
  }

  @ViewChild('formContainer')
  set formContainer(container: ElementRef<HTMLElement> | undefined) {
    if (!container || !this.schema) {
      return;
    }

    this.viewerReady = this.initializeFormViewer(container.nativeElement).catch((error: unknown) => {
      console.error('Unable to render workflow form', error);
      this.renderError = this.translateService.instant('PSC.FORMS.RENDER_ERROR');
      this.changeDetectorRef.markForCheck();
    });
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.formViewer?.destroy();
  }

  get isCompleteDisabled() {
    return (
      this.isLoading ||
      this.isCompleting ||
      !this.task ||
      Boolean(this.errorMessage) ||
      Boolean(this.renderError) ||
      (Boolean(this.task.formKey) && !this.schema)
    );
  }

  goBack() {
    void this.router.navigate(['/process-services-community/tasks']);
  }

  cancel() {
    void this.router.navigate(['/process-services-community/tasks']);
  }

  async completeTask() {
    if (this.isCompleteDisabled || !this.task) {
      return;
    }

    if (!this.schema) {
      await this.completeWithVariables({});
      return;
    }

    await this.viewerReady;
    if (!this.renderError) {
      this.formViewer?.submit();
    }
  }

  private async loadTask() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.tasksService.listTasks();
      const task = (response?.tasks || []).find((item: WorkflowTaskView) => item.id === this.taskId) || null;
      if (!task) {
        this.task = null;
        this.errorMessage = this.translateService.instant('PSC.TASKS.NOT_FOUND');
        return;
      }

      await this.setTask(task);
    } catch (error) {
      console.error('Error loading workflow task', error);
      this.errorMessage = this.translateService.instant('PSC.TASKS.ERROR');
    } finally {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  private async completeWithVariables(variables: Record<string, unknown>) {
    if (this.hasSubmitted || !this.task) {
      return;
    }

    this.hasSubmitted = true;
    this.isCompleting = true;
    this.errorMessage = '';
    try {
      await this.tasksService.completeTask(this.task.id, variables);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.TASKS.COMPLETE_SUCCESS'));
      await this.router.navigate(['/process-services-community/tasks']);
    } catch (error) {
      console.error('Error completing workflow task', error);
      this.errorMessage = this.translateService.instant('PSC.TASKS.COMPLETE_ERROR');
      this.hasSubmitted = false;
    } finally {
      this.isCompleting = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  private async setTask(task: WorkflowTaskView) {
    this.task = task;
    this.isLoading = true;
    this.errorMessage = '';
    this.schema = null;

    try {
      this.schema = this.parseFormSchema(task.formSchema);
    } catch (error) {
      console.error('Unable to parse workflow form schema', error);
      this.errorMessage = this.translateService.instant('PSC.TASKS.FORM_ERROR');
    }

    if (!this.errorMessage && task.formKey && !this.schema) {
      this.errorMessage = this.translateService.instant('PSC.TASKS.FORM_ERROR');
    }
    this.isLoading = false;
    this.changeDetectorRef.markForCheck();
  }

  private parseFormSchema(schema: WorkflowTaskView['formSchema']): FormSchema | null {
    if (!schema) {
      return null;
    }

    const parsed: unknown = typeof schema === 'string' ? JSON.parse(schema) : schema;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as FormSchema) : null;
  }

  private async initializeFormViewer(container: HTMLElement) {
    const {Form} = await import('@bpmn-io/form-js');
    if (this.isDestroyed || !this.schema) {
      return;
    }

    this.formViewer = new Form({container});
    this.formViewer.on('submit', (event: FormSubmitEvent) => {
      if (!event.errors || Object.keys(event.errors).length === 0) {
        void this.completeWithVariables(event.data);
      }
    });
    await this.formViewer.importSchema(this.schema, {});
  }
}
