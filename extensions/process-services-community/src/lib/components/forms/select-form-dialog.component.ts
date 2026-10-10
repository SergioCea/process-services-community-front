import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import type {WorkflowForm} from '../../services/workflow-forms.service';

export interface SelectFormDialogData {
  forms: WorkflowForm[];
  selectedFormId?: string;
  hasCurrentForm: boolean;
}

@Component({
  selector: 'psc-select-form-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, TranslatePipe],
  templateUrl: './select-form-dialog.component.html',
  styles: [
    `
      .psc-form-options {
        display: grid;
        gap: 8px;
        min-width: 320px;
      }

      .psc-form-option {
        justify-content: flex-start;
        width: 100%;
      }

      .psc-form-option.selected {
        border-left: 3px solid var(--adf-theme-primary-color);
        font-weight: 600;
      }
    `
  ]
})
export class PscSelectFormDialogComponent {
  readonly data = inject<SelectFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PscSelectFormDialogComponent>);
  private readonly router = inject(Router);

  selectForm(form: WorkflowForm) {
    this.dialogRef.close(form);
  }

  clearForm() {
    this.dialogRef.close({clear: true});
  }

  createForm() {
    this.dialogRef.close();
    void this.router.navigate(['/process-services-community/forms']);
  }

  cancel() {
    this.dialogRef.close();
  }
}
