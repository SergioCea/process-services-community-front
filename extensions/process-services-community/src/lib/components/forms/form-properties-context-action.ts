import type { FormFieldContextActions } from '@bpmn-io/form-js';

interface FormPropertiesContextEventBus {
  fire(event: string): void;
}

interface FormPropertiesContextField {
  type: string;
}

interface FormPropertiesContextEvent {
  stopPropagation(): void;
}

interface FormPropertiesContextEntry {
  action: (event: FormPropertiesContextEvent) => void;
  title: string;
  icon: string;
  group: string;
}

export class PscFormPropertiesContextActionProvider {
  static $inject = ['formFieldContextActions', 'eventBus', 'pscFormPropertiesActionTitle'];

  constructor(
    formFieldContextActions: Pick<FormFieldContextActions, 'registerProvider'>,
    private readonly eventBus: FormPropertiesContextEventBus,
    private readonly title: string
  ) {
    formFieldContextActions.registerProvider(1000, this);
  }

  getContextPadEntries(formField: FormPropertiesContextField): Record<string, FormPropertiesContextEntry> {
    if (formField.type === 'default') {
      return {};
    }

    return {
      'psc-edit-properties': {
        action: (event) => {
          event.stopPropagation();
          this.eventBus.fire('psc.form.properties.open');
        },
        title: this.title,
        icon: 'edit',
        group: 'actions'
      }
    };
  }
}

export function createFormPropertiesContextActionModule(title: string) {
  return {
    __init__: ['pscFormPropertiesContextActionProvider'],
    pscFormPropertiesContextActionProvider: ['type', PscFormPropertiesContextActionProvider],
    pscFormPropertiesActionTitle: ['value', title]
  };
}