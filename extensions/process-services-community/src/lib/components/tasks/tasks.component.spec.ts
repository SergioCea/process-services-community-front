import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {NotificationService, RedirectAuthService} from '@alfresco/adf-core';
import {AppService} from '@alfresco/aca-shared';
import {TranslateModule} from '@ngx-translate/core';
import {BehaviorSubject, EMPTY, Subject} from 'rxjs';
import {WorkflowTasksService} from '../../services/workflow-tasks.service';
import {PscTasksComponent} from './tasks.component';

describe('PscTasksComponent', () => {
  let component: PscTasksComponent;
  let fixture: ComponentFixture<PscTasksComponent>;
  let tasksService: jest.Mocked<WorkflowTasksService>;
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    tasksService = {
      listTasks: jest.fn(),
      claimTask: jest.fn(),
      completeTask: jest.fn()
    } as unknown as jest.Mocked<WorkflowTasksService>;
    tasksService.listTasks.mockResolvedValue({tasks: []});
    router = {navigate: jest.fn().mockResolvedValue(true)};

    await TestBed.configureTestingModule({
      imports: [PscTasksComponent, TranslateModule.forRoot()],
      providers: [
        {provide: WorkflowTasksService, useValue: tasksService},
        {provide: NotificationService, useValue: {openSnackMessage: jest.fn()}},
        {provide: Router, useValue: router},
        {provide: RedirectAuthService, useValue: {onLogin: EMPTY, onTokenReceived: EMPTY}},
        {
          provide: AppService,
          useValue: {appNavNarMode$: new BehaviorSubject('expanded'), toggleAppNavBar$: new Subject()}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PscTasksComponent);
    component = fixture.componentInstance;
  });

  it('should create', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('shows a loading state while tasks are being retrieved', async () => {
    let resolveTasks!: (response: { tasks: never[] }) => void;
    tasksService.listTasks.mockImplementation(() => new Promise((resolve) => (resolveTasks = resolve)));

    fixture.detectChanges();

    expect(component.isLoading).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('PSC.TASKS.LOADING');
    resolveTasks({tasks: []});
    await fixture.whenStable();
  });

  it('shows the empty state when the user has no tasks', async () => {
    tasksService.listTasks.mockResolvedValue({tasks: []});

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.changeDetectorRef.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(component.tasks).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('PSC.TASKS.EMPTY');
  });

  it('shows an error state when task retrieval fails', async () => {
    tasksService.listTasks.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.changeDetectorRef.detectChanges();

    expect(component.isLoading).toBe(false);

    expect(component.errorMessage).toBe('PSC.TASKS.ERROR');
    expect(fixture.nativeElement.textContent).toContain('PSC.TASKS.ERROR');
  });

  it('navigates to the task completion page', async () => {
    const task = {
      id: 'task-1',
      name: 'Review',
      formKey: 'form-task-1',
      claimedByCurrentUser: true
    };
    component.tasks = [task];

    await component.completeTask(task);

    expect(router.navigate).toHaveBeenCalledWith(['/process-services-community/tasks', 'task-1', 'complete'], {state: {task}});
    expect(tasksService.completeTask).not.toHaveBeenCalled();
  });
});
