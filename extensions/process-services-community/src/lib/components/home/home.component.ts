import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {AppExtensionService, PageLayoutComponent, ToolbarComponent} from '@alfresco/aca-shared';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {ContentActionRef} from '@alfresco/adf-extensions';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {map} from 'rxjs/operators';
import {DataTableModule, NotificationService} from '@alfresco/adf-core';
import {WebscriptApi} from '@alfresco/js-api';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {AlfrescoApiService} from '@alfresco/adf-content-services';

import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {PscDeleteProcessDialogComponent} from './delete-process-dialog/delete-process-dialog.component';
import {PscStartProcessDialogComponent} from './start-process-dialog/start-process-dialog.component';
import {firstValueFrom} from 'rxjs';
import {deserializeFormSchemas} from '../process-editor/form-schemas';
import {findInitialStartForm} from './start-process-form';
import {getLatestProcessDefinitions} from './latest-process-definitions';

@Component({
  selector: 'psc-home',
  imports: [
    PageLayoutComponent,
    TranslatePipe,
    MatButtonModule,
    ToolbarComponent,
    DataTableModule,
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class PscHomeComponent implements OnInit {
  actions: Array<ContentActionRef> = [];
  processes: any[] = [];
  isLoading = true;

  private extensions = inject(AppExtensionService);
  private destroyRef = inject(DestroyRef);
  private apiService = inject(AlfrescoApiService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private translateService = inject(TranslateService);
  private dialog = inject(MatDialog);

  ngOnInit() {
    this.extensions
      .getAllowedToolbarActions()
      .pipe(
        map((actions) => actions.filter((action) => action.id.startsWith('psc.'))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((actions) => {
        this.actions = actions;
      });

    this.loadProcesses();
  }

  loadProcesses() {
    this.isLoading = true;
    const webScriptApi = new WebscriptApi(this.apiService.getInstance());
    webScriptApi
      .executeWebScript(
        'GET',
        'process-services-community/list',
        [], // params
        'alfresco', // contextRoot
        'service' // servicePath
      )
      .then(
        (res: any) => {
          console.log('Processes loaded:', res);
          this.processes = getLatestProcessDefinitions(res.entries || []).map((entry: any) => ({
            ...entry,
            obj: entry // ADF datatable row object
          }));
          this.isLoading = false;
        },
        (err) => {
          console.error('Error loading processes', err);
          this.isLoading = false;
        }
      );
  }

  editProcess(row: any) {
    const processId = row?.obj?.id || row?.id;
    if (processId) {
      this.router.navigate(['/process-services-community/editor'], {queryParams: {id: processId}});
    }
  }

  async runProcess(row: any) {
    const processId = row?.obj?.id || row?.id;
    if (!processId) {
      return;
    }

    const webScriptApi = new WebscriptApi(this.apiService.getInstance());
    try {
      const definition: any = await webScriptApi.executeWebScript(
        'GET',
        'process-services-community/definition',
        {id: processId},
        'alfresco',
        'service'
      );
      const startForm = findInitialStartForm(definition.xml, deserializeFormSchemas(definition.forms));
      let variables: Record<string, unknown> = {};

      if (startForm) {
        const dialogRef = this.dialog.open(PscStartProcessDialogComponent, {
          data: {title: definition.title || definition.name || processId, schema: startForm, mode: 'start'},
          width: '480px'
        });
        const formValues = await firstValueFrom(dialogRef.afterClosed());
        if (formValues === undefined) {
          return;
        }
        variables = formValues;
      }

      await webScriptApi.executeWebScript('POST', 'process-services-community/start', [], 'alfresco', 'service', {
        id: processId,
        variables
      });
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.START_SUCCESS'));
    } catch (err) {
      console.error('Error starting workflow', err);
      this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.START_ERROR'));
    }
  }

  deleteProcess(row: any) {
    const processId = row?.obj?.id || row?.id;
    const processTitle = row?.obj?.title || row?.title;
    const processVersion = row?.obj?.version || row?.version;

    if (processId) {
      const dialogRef = this.dialog.open(PscDeleteProcessDialogComponent, {
        data: {title: processTitle, version: processVersion},
        width: '400px'
      });

      dialogRef.afterClosed().subscribe((option) => {
        if (option) {
          this.executeDelete(processId, option);
        }
      });
    }
  }

  private executeDelete(processId: string, option: 'version' | 'all') {
    const webScriptApi = new WebscriptApi(this.apiService.getInstance());
    const params: any = {id: processId};
    if (option === 'all') {
      params.all = true;
    }

    webScriptApi
      .executeWebScript(
        'DELETE',
        'process-services-community/definition',
        params, // params
        'alfresco', // contextRoot
        'service' // servicePath
      )
      .then(
        () => {
          this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.DELETE_SUCCESS'));
          this.loadProcesses();
        },
        (err) => {
          console.error('Error deleting process', err);
          this.notificationService.openSnackMessage(this.translateService.instant('PSC.MESSAGES.DELETE_ERROR'));
        }
      );
  }
}
