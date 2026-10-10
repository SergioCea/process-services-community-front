import type {FormSchema} from '../process-editor/form-schemas';
import {findInitialStartForm} from './start-process-form';

describe('findInitialStartForm', () => {
  const xml = (startEvent: string) => `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn"><bpmn:process id="process">${startEvent}</bpmn:process></bpmn:definitions>`;
  const schema: FormSchema = {schemaVersion: 1, components: [{key: 'name', type: 'textfield'}]};

  it('finds a form attached to a BPMN start event', () => {
    const forms = new Map([['StartEvent_1', schema]]);

    expect(findInitialStartForm(xml('<bpmn:startEvent id="StartEvent_1" activiti:formKey="form-StartEvent_1"/>'), forms)).toEqual(schema);
  });

  it('returns null when the process has no start form', () => {
    expect(findInitialStartForm(xml('<bpmn:startEvent id="StartEvent_1"/>'), new Map())).toBeNull();
  });

  it('reports a missing schema instead of silently dropping form values', () => {
    expect(() => findInitialStartForm(xml('<bpmn:startEvent id="StartEvent_1" activiti:formKey="form-StartEvent_1"/>'), new Map()))
      .toThrow('Start form schema not found for BPMN element StartEvent_1');
  });

  it('rejects a form-linked start event without an id', () => {
    expect(() => findInitialStartForm(xml('<bpmn:startEvent activiti:formKey="form-start"/>'), new Map()))
      .toThrow('Start event is missing a BPMN element id');
  });
});
