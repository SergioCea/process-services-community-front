import {CommonModule} from '@angular/common';
import {Component, ElementRef, inject, OnDestroy, ViewChild, ViewEncapsulation} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import type {FormSchema} from '../../process-editor/form-schemas';

export interface StartProcessDialogData {
  title: string;
  schema: FormSchema;
  mode?: 'start' | 'task';
  values?: Record<string, unknown>;
}

@Component({
  selector: 'psc-start-process-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslatePipe],
  templateUrl: './start-process-dialog.component.html',
  styleUrl: './start-process-dialog.component.css',
  encapsulation: ViewEncapsulation.None
})
export class PscStartProcessDialogComponent implements OnDestroy {
  readonly data = inject<StartProcessDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PscStartProcessDialogComponent>);
  private readonly translateService = inject(TranslateService);
  private formViewer: any;
  private hasSubmitted = false;
  private viewerReady: Promise<void> = Promise.resolve();
  private isDestroyed = false;
  isFormReady = false;
  renderError = '';

  @ViewChild('formContainer')
  set formContainer(container: ElementRef<HTMLElement> | undefined) {
    if (!container) {
      return;
    }

    this.viewerReady = this.initializeFormViewer(container.nativeElement).catch((error: unknown) => {
      console.error('Unable to render workflow form', error);
      this.renderError = this.translateService.instant('PSC.FORMS.RENDER_ERROR');
    });
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.formViewer?.destroy?.();
  }

  cancel() {
    this.dialogRef.close();
  }

  async submitForm() {
    await this.viewerReady;
    const result = this.formViewer?.submit();
    if (result) {
      this.completeSubmission(result);
    }
  }

  private completeSubmission(event: { data: Record<string, unknown>; errors?: Record<string, unknown> }) {
    if (this.hasSubmitted || (event.errors && Object.keys(event.errors).length > 0)) {
      return;
    }
    this.hasSubmitted = true;
    this.dialogRef.close(event.data);
  }

  private async initializeFormViewer(container: HTMLElement) {
    const {Form} = await import('@bpmn-io/form-js');
    if (this.isDestroyed) {
      return;
    }

    this.formViewer = new Form({container});
    this.formViewer.on('submit', (event: { data: Record<string, unknown>; errors?: Record<string, unknown> }) => {
      this.completeSubmission(event);
    });
    await this.formViewer.importSchema(this.data.schema, this.data.values || {});
    this.isFormReady = true;
  }
}
