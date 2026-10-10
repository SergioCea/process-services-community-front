import { inject, Injectable } from '@angular/core';
import { AlfrescoApiService } from '@alfresco/adf-content-services';
import { WebscriptApi } from '@alfresco/js-api';

@Injectable({ providedIn: 'root' })
export class WorkflowTasksService {
  private readonly apiService = inject(AlfrescoApiService);

  listTasks(): Promise<any> {
    return new WebscriptApi(this.apiService.getInstance()).executeWebScript('GET', 'process-services-community/tasks', [], 'alfresco', 'service');
  }

  claimTask(taskId: string): Promise<any> {
    return new WebscriptApi(this.apiService.getInstance()).executeWebScript(
      'POST',
      'process-services-community/task/claim',
      [],
      'alfresco',
      'service',
      { id: taskId }
    );
  }

  completeTask(taskId: string, variables: Record<string, unknown>): Promise<any> {
    return new WebscriptApi(this.apiService.getInstance()).executeWebScript(
      'POST',
      'process-services-community/task/complete',
      [],
      'alfresco',
      'service',
      { id: taskId, variables }
    );
  }
}
