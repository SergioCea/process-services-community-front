import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Form as FormViewer } from '@bpmn-io/form-js';
import type { FormSchema } from '../process-editor/form-schemas';

export interface FormPreviewDialogData {
  title: string;
  schema: FormSchema;
}

@Component({
  selector: 'psc-form-preview-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, TranslatePipe],
  templateUrl: './form-preview-dialog.component.html'
})
export class PscFormPreviewDialogComponent implements OnDestroy {
  readonly data = inject<FormPreviewDialogData>(MAT_DIALOG_DATA);
  readonly isFormReady = signal(false);
  readonly renderError = signal('');

  private readonly dialogRef = inject(MatDialogRef<PscFormPreviewDialogComponent>);
  private readonly translateService = inject(TranslateService);
  private formViewer?: FormViewer;
  private isDestroyed = false;

  @ViewChild('formContainer')
  set formContainer(container: ElementRef<HTMLElement> | undefined) {
    if (!container) {
      return;
    }

    void this.initializeFormViewer(container.nativeElement).catch((error: unknown) => {
      console.error('Unable to render workflow form preview', error);
      this.renderError.set(this.translateService.instant('PSC.FORMS.PREVIEW_ERROR'));
    });
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.formViewer?.destroy();
  }

  close() {
    this.dialogRef.close();
  }

  private async initializeFormViewer(container: HTMLElement) {
    const { Form } = await import('@bpmn-io/form-js');
    if (this.isDestroyed) {
      return;
    }

    this.formViewer = new Form({ container });
    await this.formViewer.importSchema(this.data.schema);
    this.isFormReady.set(true);
  }
}