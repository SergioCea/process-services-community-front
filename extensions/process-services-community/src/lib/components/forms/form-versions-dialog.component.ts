import {DatePipe} from '@angular/common';
import {Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {TranslatePipe} from '@ngx-translate/core';
import type {WorkflowFormVersion} from '../../services/workflow-forms.service';

export interface FormVersionsDialogData {
  title: string;
  versions: WorkflowFormVersion[];
}

@Component({
  selector: 'psc-form-versions-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ 'PSC.FORMS.VERSIONS_TITLE' | translate: {title: data.title} }}</h2>
    <mat-dialog-content>
      @if (data.versions.length === 0) {
        <p>{{ 'PSC.FORMS.VERSIONS_EMPTY' | translate }}</p>
      } @else {
        <div class="psc-form-version-list">
          @for (version of data.versions; track version.id) {
            <div class="psc-form-version">
              <div>
                <strong>{{ 'PSC.FORMS.VERSION' | translate }} {{ version.id }}</strong>
                @if (version.isCurrent) {
                  <span>({{ 'PSC.FORMS.CURRENT_VERSION' | translate }})</span>
                }
                <div>{{ version.modifiedAt | date: 'medium' }}</div>
                @if (version.modifiedBy) {
                  <div>{{ version.modifiedBy }}</div>
                }
                @if (version.comment) {
                  <div>{{ version.comment }}</div>
                }
              </div>
              <button mat-button type="button" [disabled]="version.isCurrent" (click)="restore(version.id)">
                {{ 'PSC.FORMS.RESTORE' | translate }}
              </button>
            </div>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">{{ 'PSC.FORMS.CANCEL' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .psc-form-version-list {
        display: grid;
        gap: 12px;
        min-width: min(440px, 75vw);
      }

      .psc-form-version {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
    `
  ]
})
export class PscFormVersionsDialogComponent {
  readonly data = inject<FormVersionsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PscFormVersionsDialogComponent, string>>(MatDialogRef);

  restore(versionId: string) {
    this.dialogRef.close(versionId);
  }

  cancel() {
    this.dialogRef.close();
  }
}
