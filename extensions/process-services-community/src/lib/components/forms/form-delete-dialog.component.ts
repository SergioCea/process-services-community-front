import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

export interface FormDeleteDialogData {
  title: string;
}

@Component({
  selector: 'psc-form-delete-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ 'PSC.FORMS.DELETE_TITLE' | translate }}</h2>
    <mat-dialog-content>{{ 'PSC.FORMS.DELETE_CONFIRM' | translate: { title: data.title } }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">{{ 'PSC.FORMS.CANCEL' | translate }}</button>
      <button mat-button color="warn" type="button" (click)="confirm()">{{ 'PSC.FORMS.DELETE' | translate }}</button>
    </mat-dialog-actions>
  `
})
export class PscFormDeleteDialogComponent {
  readonly data = inject<FormDeleteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PscFormDeleteDialogComponent, boolean>>(MatDialogRef);

  confirm() {
    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}