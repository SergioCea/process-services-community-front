import {CommonModule} from '@angular/common';
import {Component, inject, OnInit} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {Router} from '@angular/router';
import {PageLayoutComponent} from '@alfresco/aca-shared';
import {NotificationService} from '@alfresco/adf-core';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {WorkflowTasksService} from '../../services/workflow-tasks.service';
import type {FormSchema} from '../process-editor/form-schemas';

interface WorkflowTaskView {
  id: string;
  name: string;
  description?: string;
  assignee?: string;
  createTime?: string;
  formKey?: string;
  formSchema?: FormSchema | string | null;
  claimedByCurrentUser: boolean;
}

@Component({
  selector: 'psc-tasks',
  imports: [CommonModule, PageLayoutComponent, TranslatePipe, MatButtonModule, MatCardModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css'
})
export class PscTasksComponent implements OnInit {
  tasks: WorkflowTaskView[] = [];
  isLoading = true;
  errorMessage = '';
  processingTaskId: string | null = null;

  private readonly tasksService = inject(WorkflowTasksService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);

  ngOnInit() {
    this.loadTasks();
  }

  async loadTasks() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.tasksService.listTasks();
      this.tasks = response?.tasks || [];
    } catch (error) {
      console.error('Error loading workflow tasks', error);
      this.tasks = [];
      this.errorMessage = this.translateService.instant('PSC.TASKS.ERROR');
    } finally {
      this.isLoading = false;
    }
  }

  async claimTask(task: WorkflowTaskView) {
    this.processingTaskId = task.id;
    this.errorMessage = '';
    try {
      const claimed = await this.tasksService.claimTask(task.id);
      this.tasks = this.tasks.map((current) => (current.id === task.id ? {...current, ...claimed} : current));
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.TASKS.CLAIM_SUCCESS'));
    } catch (error) {
      console.error('Error claiming workflow task', error);
      this.errorMessage = this.translateService.instant('PSC.TASKS.CLAIM_ERROR');
    } finally {
      this.processingTaskId = null;
    }
  }

  async completeTask(task: WorkflowTaskView) {
    this.processingTaskId = task.id;
    this.errorMessage = '';
    try {
      await this.router.navigate(['/process-services-community/tasks', task.id, 'complete'], {state: {task}});
    } catch (error) {
      console.error('Error opening workflow task', error);
      this.errorMessage = this.translateService.instant('PSC.TASKS.ERROR');
    } finally {
      this.processingTaskId = null;
    }
  }
}
