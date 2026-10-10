import {deserializeFormSchemas, serializeFormSchemas} from './form-schemas';

describe('workflow form schemas', () => {
  const schema = {schemaVersion: 1, type: 'default', components: [{type: 'textfield', key: 'name'}]};

  it('restores schemas returned as an object', () => {
    expect(deserializeFormSchemas({StartEvent_1: schema})).toEqual(new Map([['StartEvent_1', schema]]));
  });

  it('restores schemas returned as serialized JSON', () => {
    expect(deserializeFormSchemas(JSON.stringify({UserTask_1: schema}))).toEqual(new Map([['UserTask_1', schema]]));
  });

  it('serializes schemas using their BPMN element ids', () => {
    expect(serializeFormSchemas(new Map([['UserTask_1', schema]]))).toEqual({UserTask_1: schema});
  });

  it('returns no schemas for an empty response', () => {
    expect(deserializeFormSchemas(null)).toEqual(new Map());
  });
});
