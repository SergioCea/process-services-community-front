import type {FormSchema} from '../process-editor/form-schemas';

const BPMN_NAMESPACE = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const ACTIVITI_NAMESPACE = 'http://activiti.org/bpmn';

export function findInitialStartForm(xml: string, forms: Map<string, FormSchema>): FormSchema | null {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid BPMN XML');
  }

  const startEvents = document.getElementsByTagNameNS(BPMN_NAMESPACE, 'startEvent');
  for (let index = 0; index < startEvents.length; index++) {
    const startEvent = startEvents.item(index);
    const formKey = startEvent?.getAttributeNS(ACTIVITI_NAMESPACE, 'formKey') || startEvent?.getAttribute('activiti:formKey');
    if (!formKey || !startEvent) {
      continue;
    }

    const elementId = startEvent.getAttribute('id');
    if (!elementId) {
      throw new Error('Start event is missing a BPMN element id');
    }
    const schema = forms.get(elementId);
    if (!schema) {
      throw new Error(`Start form schema not found for BPMN element ${elementId}`);
    }
    return schema;
  }

  return null;
}
