import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY, of, Subject } from 'rxjs';
import { AlfrescoApiService } from '@alfresco/adf-content-services';
import { AppExtensionService, AppService } from '@alfresco/aca-shared';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService, RedirectAuthService } from '@alfresco/adf-core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PscHomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: PscHomeComponent;
  let fixture: ComponentFixture<PscHomeComponent>;
  let loadProcesses: jest.SpyInstance;

  beforeEach(async () => {
    loadProcesses = jest.spyOn(PscHomeComponent.prototype, 'loadProcesses').mockImplementation();
    await TestBed.configureTestingModule({
      imports: [PscHomeComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AppExtensionService, useValue: { getAllowedToolbarActions: () => of([]) } },
        { provide: AppService, useValue: { appNavNarMode$: new BehaviorSubject('expanded'), toggleAppNavBar$: new Subject() } },
        { provide: AlfrescoApiService, useValue: { getInstance: () => ({}) } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: NotificationService, useValue: { openSnackMessage: jest.fn() } },
        { provide: RedirectAuthService, useValue: { onLogin: EMPTY, onTokenReceived: EMPTY } },
        { provide: Router, useValue: { navigate: jest.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PscHomeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => loadProcesses.mockRestore());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
