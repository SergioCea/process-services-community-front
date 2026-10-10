import { useService } from 'bpmn-js-properties-panel';
import { ActivitiPropertiesProviderModule, setFormTitleResolver } from './activiti-properties-provider';
import { ACTIVITI_PROPERTY_CATALOG } from './activiti-property-catalog';

jest.mock('@bpmn-io/properties-panel', () => ({
  CheckboxEntry: () => null,
  isCheckboxEntryEdited: () => false,
  isTextAreaEntryEdited: () => false,
  isTextFieldEntryEdited: () => false,
  TextAreaEntry: () => null,
  TextFieldEntry: () => null
}));

jest.mock('bpmn-js-properties-panel', () => ({ useService: jest.fn() }));
jest.mock('bpmn-js/lib/util/ModelUtil', () => ({
  is: (element: any, type: string) =>
    element.businessObject.$instanceOf(type) ||
    (type === 'bpmn:Activity' &&
      ['bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:BusinessRuleTask', 'bpmn:CallActivity'].some((activityType) =>
        element.businessObject.$instanceOf(activityType)
      ))
}));

describe('Activiti properties provider', () => {
  let provider: any;
  let registeredPriority: number;

  beforeEach(() => {
    setFormTitleResolver(() => undefined);
    (useService as jest.Mock).mockReset();
    const Provider: any = ActivitiPropertiesProviderModule.activitiPropertiesProvider[1];
    new Provider({
      registerProvider: (priority: number, registeredProvider: any) => {
        registeredPriority = priority;
        provider = registeredProvider;
      }
    });
  });

  it('registers Activiti implementation properties for service tasks', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:ServiceTask' } })([]);

    expect(registeredPriority).toBe(500);
    expect(groups.find((group: any) => group.id === 'activiti-service-task').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-service-class',
      'activiti-service-expression',
      'activiti-service-delegate-expression',
      'activiti-service-type',
      'activiti-service-result-variable'
    ]);
  });

  it('registers script format, body and result variable for script tasks', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:ScriptTask' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-script-task').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-script-format',
      'activiti-script-content',
      'activiti-script-result-variable'
    ]);
  });

  it('registers Activiti assignment properties for user tasks', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:UserTask' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-user-task').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-user-form-key',
      'activiti-user-assignee',
      'activiti-user-candidate-users',
      'activiti-user-candidate-groups',
      'activiti-user-due-date',
      'activiti-user-priority'
    ]);
  });

  it('registers the catalog form key for start events', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:StartEvent' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-start-event').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-start-form-key',
      'activiti-start-initiator'
    ]);
  });

  it('provides shared execution options for every Activiti activity', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:ServiceTask' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-activity').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-activity-async',
      'activiti-activity-exclusive',
      'activiti-activity-job-priority',
      'activiti-activity-skip-expression'
    ]);
  });

  it('edits Activiti multi-instance properties on the loop characteristics', () => {
    const loopCharacteristics = {
      $instanceOf: (type: string) => type === 'bpmn:MultiInstanceLoopCharacteristics',
      get: (propertyName: string) => (propertyName === 'activiti:collection' ? '${users}' : undefined)
    };
    const element = {
      businessObject: {
        $instanceOf: (type: string) => type === 'bpmn:ServiceTask' || type === 'bpmn:Activity',
        loopCharacteristics
      }
    };
    const modeling = { updateModdleProperties: jest.fn() };
    (useService as jest.Mock).mockImplementation((service: string) => (service === 'modeling' ? modeling : undefined));

    const groups = provider.getGroups(element)([]);
    const group = groups.find((entry: any) => entry.id === 'activiti-multi-instance');
    const collectionEntry = group.entries.find((entry: any) => entry.id === 'activiti-multi-instance-collection');
    const renderedEntry = collectionEntry.component({ element, id: 'multi-instance-collection' });
    const sequentialEntry = group.entries.find((entry: any) => entry.id === 'activiti-multi-instance-sequential');
    const renderedSequentialEntry = sequentialEntry.component({ element, id: 'multi-instance-sequential' });

    expect(collectionEntry.isEdited(element)).toBe(true);
    renderedEntry.props.setValue('${users}');
    expect(renderedSequentialEntry.props.getValue()).toBe(false);
    renderedSequentialEntry.props.setValue(true);

    expect(modeling.updateModdleProperties).toHaveBeenCalledWith(element, loopCharacteristics, { 'activiti:collection': '${users}' });
    expect(modeling.updateModdleProperties).toHaveBeenCalledWith(element, loopCharacteristics, { isSequential: true });
  });

  it('uses Activiti defaults for async and exclusive checkboxes', () => {
    const element = {
      businessObject: {
        $instanceOf: (type: string) => type === 'bpmn:ServiceTask',
        get: () => undefined
      }
    };
    (useService as jest.Mock).mockReturnValue(undefined);
    const activityGroup = provider
      .getGroups(element)([])
      .find((group: any) => group.id === 'activiti-activity');
    const entries = activityGroup.entries.map((entry: any) => ({ id: entry.id, rendered: entry.component({ element, id: entry.id }) }));

    expect(entries.find((entry: any) => entry.id === 'activiti-activity-async').rendered.props.getValue()).toBe(false);
    expect(entries.find((entry: any) => entry.id === 'activiti-activity-exclusive').rendered.props.getValue()).toBe(true);
  });

  it('allows a user task without loop characteristics to become multi-instance', () => {
    const element = {
      businessObject: {
        $instanceOf: (type: string) => type === 'bpmn:UserTask' || type === 'bpmn:Activity',
        get: () => undefined
      }
    };
    const loopCharacteristics = { isSequential: false };
    const moddle = { create: jest.fn(() => loopCharacteristics) };
    const modeling = { updateProperties: jest.fn() };
    (useService as jest.Mock).mockImplementation((service: string) =>
      service === 'modeling' ? modeling : service === 'moddle' ? moddle : undefined
    );

    const groups = provider.getGroups(element)([]);
    const multiInstanceGroup = groups.find((group: any) => group.id === 'activiti-multi-instance-toggle');
    const toggleEntry = multiInstanceGroup.entries.find((entry: any) => entry.id === 'activiti-multi-instance-enabled');
    const renderedEntry = toggleEntry.component({ element, id: 'multi-instance-enabled' });

    expect(renderedEntry.props.getValue()).toBe(false);
    renderedEntry.props.setValue(true);

    expect(moddle.create).toHaveBeenCalledWith('bpmn:MultiInstanceLoopCharacteristics', { isSequential: false });
    expect(modeling.updateProperties).toHaveBeenCalledWith(element, { loopCharacteristics });
  });

  it('registers rule execution properties for business rule tasks', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:BusinessRuleTask' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-business-rule-task').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-business-rule-input',
      'activiti-business-rule-names',
      'activiti-business-rule-excluded-names',
      'activiti-business-rule-result-variable'
    ]);
  });

  it('registers the business key property for call activities', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:CallActivity' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-call-activity').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-call-business-key'
    ]);
  });

  it('registers candidate starter properties for processes', () => {
    const groups = provider.getGroups({ businessObject: { $instanceOf: (type: string) => type === 'bpmn:Process' } })([]);

    expect(groups.find((group: any) => group.id === 'activiti-process').entries.map((entry: any) => entry.id)).toEqual([
      'activiti-process-candidate-starter-users',
      'activiti-process-candidate-starter-groups',
      'activiti-process-job-priority'
    ]);
  });

  it('displays the catalog form title instead of its BPMN key', () => {
    setFormTitleResolver((formKey) => (formKey === 'form-vacation' ? 'Vacation request' : undefined));
    const element = {
      businessObject: {
        $instanceOf: (type: string) => type === 'bpmn:StartEvent',
        get: (propertyName: string) => (propertyName === 'activiti:formKey' ? 'form-vacation' : undefined)
      }
    };
    const groups = provider.getGroups(element)([]);
    const entry = groups[0].entries[0];
    const renderedEntry = entry.component({ element, id: 'form-key' });

    expect(JSON.stringify(renderedEntry)).toContain('Vacation request');
    expect(JSON.stringify(renderedEntry)).not.toContain('form-vacation');
  });

  it('generates panel entries for every property in the catalog', () => {
    ACTIVITI_PROPERTY_CATALOG.forEach((catalogGroup) => {
      const element = {
        businessObject: {
          $instanceOf: (type: string) => type === catalogGroup.bpmnType,
          ...(catalogGroup.bpmnType === 'bpmn:MultiInstanceLoopCharacteristics'
            ? { loopCharacteristics: { $instanceOf: (type: string) => type === 'bpmn:MultiInstanceLoopCharacteristics' } }
            : {})
        }
      };
      const groups = provider.getGroups(element)([]);

      expect(groups.find((group: any) => group.id === catalogGroup.id).entries.map((entry: any) => entry.id)).toEqual(
        catalogGroup.properties.map((property) => property.id)
      );
    });
  });

  it('keeps property component identities stable between panel refreshes', () => {
    const element = { businessObject: { $instanceOf: (type: string) => type === 'bpmn:ScriptTask' } };
    const firstEntries = provider
      .getGroups(element)([])
      .find((group: any) => group.id === 'activiti-script-task').entries;
    const refreshedEntries = provider
      .getGroups(element)([])
      .find((group: any) => group.id === 'activiti-script-task').entries;

    expect(refreshedEntries.map((entry: any) => entry.component)).toEqual(firstEntries.map((entry: any) => entry.component));
  });

  it('does not add Activiti-specific groups to unrelated BPMN elements', () => {
    expect(provider.getGroups({ businessObject: { $instanceOf: () => false } })([])).toEqual([]);
  });
});
