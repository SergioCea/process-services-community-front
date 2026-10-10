import {Component, Inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatRadioModule} from '@angular/material/radio';
import {TranslatePipe} from '@ngx-translate/core';
import {FormsModule} from '@angular/forms';

export interface DeleteProcessDialogData {
  title: string;
  version: string;
}

@Component({
  selector: 'psc-delete-process-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatRadioModule, TranslatePipe, FormsModule],
  templateUrl: './delete-process-dialog.component.html',
  styles: [
    `
      .psc-delete-radio-group {
        display: flex;
        flex-direction: column;
        margin: 15px 0;
      }

      .psc-delete-radio-button {
        margin: 5px 0;
      }
    `
  ]
})
export class PscDeleteProcessDialogComponent {
  deleteOption: 'version' | 'all' = 'version';

  constructor(
    public dialogRef: MatDialogRef<PscDeleteProcessDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteProcessDialogData
  ) {
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    this.dialogRef.close(this.deleteOption);
  }
}
