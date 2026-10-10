import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '@alfresco/aca-shared';
import { NotificationService, RedirectAuthService } from '@alfresco/adf-core';
import { Form } from '@bpmn-io/form-js';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { WorkflowFormsService } from '../../services/workflow-forms.service';
import { WorkflowTasksService } from '../../services/workflow-tasks.service';
import { PscTaskCompletionComponent } from './task-completion.component';

jest.mock('@bpmn-io/form-js', () => ({ Form: jest.fn() }));

describe('PscTaskCompletionComponent', () => {
  let component: PscTaskCompletionComponent;
  let fixture: ComponentFixture<PscTaskCompletionComponent>;
  let tasksService: jest.Mocked<WorkflowTasksService>;
  let formsService: { getFormById: jest.Mock };
  let router: { navigate: jest.Mock; getCurrentNavigation: jest.Mock };
  let navigationTask: { id: string; name: string; formKey?: string; formSchema?: typeof formSchema | string } | undefined;
  let submitHandler: ((event: { data: Record<string, unknown>; errors?: Record<string, unknown> }) => void) | undefined;
  const taskId = 'task-1';
  const formSchema = {
    type: 'default',
    components: [
      { type: 'textfield', key: 'firstName', layout: { row: 'row-1', columns: 6 } },
      { type: 'textfield', key: 'lastName', layout: { row: 'row-1', columns: 6 } }
    ]
  };
  const formViewer = {
    on: jest.fn(),
    importSchema: jest.fn().mockResolvedValue(undefined),
    submit: jest.fn(),
    destroy: jest.fn()
  };
  const waitForAsyncUpdates = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    tasksService = {
      listTasks: jest.fn(),
      claimTask: jest.fn(),
      completeTask: jest.fn().mockResolvedValue({})
    } as unknown as jest.Mocked<WorkflowTasksService>;
    formsService = { getFormById: jest.fn().mockResolvedValue(null) };
    navigationTask = undefined;
    router = {
      navigate: jest.fn().mockResolvedValue(true),
      getCurrentNavigation: jest.fn(() => ({ extras: { state: { task: navigationTask } } }))
    };
    submitHandler = undefined;
    formViewer.on.mockClear();
    formViewer.importSchema.mockClear();
    formViewer.submit.mockClear();
    formViewer.destroy.mockClear();
    formViewer.on.mockImplementation((eventName: string, handler: typeof submitHandler) => {
      if (eventName === 'submit') {
        submitHandler = handler;
      }
    });
    formViewer.importSchema.mockResolvedValue(undefined);
    formViewer.submit.mockImplementation(() => submitHandler?.({ data: { accepted: true } }));
    (Form as unknown as jest.Mock).mockImplementation(() => formViewer);

    await TestBed.configureTestingModule({
      imports: [PscTaskCompletionComponent, TranslateModule.forRoot()],
      providers: [
        { provide: WorkflowTasksService, useValue: tasksService },
        { provide: WorkflowFormsService, useValue: formsService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => taskId } } } },
        { provide: NotificationService, useValue: { openSnackMessage: jest.fn() } },
        { provide: RedirectAuthService, useValue: { onLogin: EMPTY, onTokenReceived: EMPTY } },
        { provide: AppService, useValue: { appNavNarMode$: new BehaviorSubject('expanded'), toggleAppNavBar$: new Subject() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PscTaskCompletionComponent);
    component = fixture.componentInstance;
  });

  it('renders the task title and imports the form schema without changing its field layout', async () => {
    navigationTask = { id: taskId, name: 'Review request', formKey: 'review', formSchema };
    formViewer.submit.mockImplementationOnce(() => undefined);

    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();
    await component.completeTask();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Review request');
    expect(formViewer.importSchema).toHaveBeenCalledWith(formSchema, {});
  });

  it('uses the task form snapshot instead of the latest catalog schema', async () => {
    const latestSchema = { type: 'default', components: [{ type: 'textfield', key: 'updatedField' }] };
    navigationTask = { id: taskId, name: 'Review request', formKey: 'shared-form-id', formSchema };
    formsService.getFormById.mockResolvedValue({ id: 'shared-form-id', title: 'Updated form', schema: latestSchema });

    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();

    expect(formsService.getFormById).not.toHaveBeenCalled();
    expect(formViewer.importSchema).toHaveBeenCalledWith(formSchema, {});
  });

  it('submits form values and returns to the task list', async () => {
    navigationTask = { id: taskId, name: 'Review request', formKey: 'review', formSchema };

    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();

    await component.completeTask();
    await fixture.whenStable();

    expect(tasksService.completeTask).toHaveBeenCalledWith(taskId, { accepted: true });
    expect(router.navigate).toHaveBeenCalledWith(['/process-services-community/tasks']);
  });

  it('prevents completion when a required form schema is missing', async () => {
    const latestSchema = { type: 'default', components: [{ type: 'textfield', key: 'updatedField' }] };
    navigationTask = { id: taskId, name: 'Review request', formKey: 'review' };
    formsService.getFormById.mockResolvedValue({ id: 'review', title: 'Updated form', schema: latestSchema });

    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('PSC.TASKS.FORM_ERROR');
    expect(component.isCompleteDisabled).toBe(true);
    expect(formsService.getFormById).not.toHaveBeenCalled();
    await component.completeTask();
    expect(tasksService.completeTask).not.toHaveBeenCalled();
  });

  it('loads the task for a direct route without navigation state', async () => {
    let resolveTasks!: (response: { tasks: Array<{ id: string; name: string; formKey: string; formSchema: typeof formSchema }> }) => void;
    tasksService.listTasks.mockImplementation(() => new Promise((resolve) => (resolveTasks = resolve)));

    fixture.detectChanges();
    resolveTasks({ tasks: [{ id: taskId, name: 'Directly opened task', formKey: 'review', formSchema }] });
    await fixture.whenStable();
    await waitForAsyncUpdates();
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAsyncUpdates();

    expect(fixture.nativeElement.textContent).toContain('Directly opened task');
    expect(formsService.getFormById).not.toHaveBeenCalled();
    expect(formViewer.importSchema).toHaveBeenCalledWith(formSchema, {});
  });

  it('prevents completion of a directly opened task without its form snapshot', async () => {
    let resolveTasks!: (response: { tasks: Array<{ id: string; name: string; formKey: string }> }) => void;
    tasksService.listTasks.mockImplementation(() => new Promise((resolve) => (resolveTasks = resolve)));
    formsService.getFormById.mockResolvedValue({
      id: 'review',
      title: 'Updated form',
      schema: { type: 'default', components: [{ type: 'textfield', key: 'updatedField' }] }
    });

    fixture.detectChanges();
    resolveTasks({ tasks: [{ id: taskId, name: 'Directly opened task', formKey: 'review' }] });
    await fixture.whenStable();
    await waitForAsyncUpdates();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('PSC.TASKS.FORM_ERROR');
    expect(component.isCompleteDisabled).toBe(true);
    expect(formsService.getFormById).not.toHaveBeenCalled();
    await component.completeTask();
    expect(tasksService.completeTask).not.toHaveBeenCalled();
  });

  it('completes tasks without a form and returns to the task list', async () => {
    navigationTask = { id: taskId, name: 'Simple task' };

    fixture.detectChanges();

    await component.completeTask();

    expect(tasksService.completeTask).toHaveBeenCalledWith(taskId, {});
    expect(router.navigate).toHaveBeenCalledWith(['/process-services-community/tasks']);
  });
});
