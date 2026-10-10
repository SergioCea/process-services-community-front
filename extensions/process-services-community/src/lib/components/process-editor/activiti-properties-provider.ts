import {html} from 'htm/preact';
import {
  CheckboxEntry,
  isCheckboxEntryEdited,
  isTextAreaEntryEdited,
  isTextFieldEntryEdited,
  TextAreaEntry,
  TextFieldEntry
} from '@bpmn-io/properties-panel';
import {useService} from 'bpmn-js-properties-panel';
import {is} from 'bpmn-js/lib/util/ModelUtil';
import {ACTIVITI_PROPERTY_CATALOG, ActivitiPropertyDefinition} from './activiti-property-catalog';

function getPropertyName(property: ActivitiPropertyDefinition) {
  return property.namespace === 'activiti' ? `activiti:${property.name}` : property.name;
}

function getPropertyTarget(element: any, property: ActivitiPropertyDefinition) {
  return property.target === 'loopCharacteristics' ? element.businessObject.loopCharacteristics : element.businessObject;
}

function getMultiInstanceLoopCharacteristics(element: any) {
  const loopCharacteristics = element.businessObject.loopCharacteristics;
  return loopCharacteristics &&
  (loopCharacteristics.$instanceOf?.('bpmn:MultiInstanceLoopCharacteristics') ||
    loopCharacteristics.$type === 'bpmn:MultiInstanceLoopCharacteristics')
    ? loopCharacteristics
    : undefined;
}

function updateProperty(modeling: any, element: any, property: ActivitiPropertyDefinition, properties: Record<string, any>) {
  if (property.target === 'loopCharacteristics') {
    modeling.updateModdleProperties(element, getPropertyTarget(element, property), properties);
  } else {
    modeling.updateProperties(element, properties);
  }
}

let resolveFormTitle: (formKey: string) => string | undefined = () => undefined;

export function setFormTitleResolver(resolver: (formKey: string) => string | undefined) {
  resolveFormTitle = resolver;
}

function createTextField(property: ActivitiPropertyDefinition) {
  return function ActivitiTextField(props: any) {
    const {element, id} = props;
    const modeling = useService('modeling');
    const debounce = useService('debounceInput');
    const propertyName = getPropertyName(property);
    const getValue = () => getPropertyTarget(element, property).get(propertyName) || '';
    const setValue = (value: string) => {
      const properties: Record<string, string | undefined> = {[propertyName]: value || undefined};

      if (property.exclusiveGroup && value) {
        ACTIVITI_PROPERTY_CATALOG.flatMap((group) => group.properties)
          .filter((entry) => entry.exclusiveGroup === property.exclusiveGroup && entry.id !== property.id)
          .forEach((entry) => (properties[`${entry.namespace}:${entry.name}`] = undefined));
      }

      updateProperty(modeling, element, property, properties);
    };

    return html`
      <${TextFieldEntry}
        id=${id}
        element=${element}
        label=${property.label}
        getValue=${getValue}
        setValue=${setValue}
        debounce=${debounce}
      />`;
  };
}

function createTextArea(property: ActivitiPropertyDefinition) {
  return function ActivitiTextArea(props: any) {
    const {element, id} = props;
    const modeling = useService('modeling');
    const debounce = useService('debounceInput');
    const propertyName = getPropertyName(property);
    const getValue = () => getPropertyTarget(element, property).get(propertyName) || '';
    const setValue = (value: string) => updateProperty(modeling, element, property, {[propertyName]: value || undefined});

    return html`
      <${TextAreaEntry}
        id=${id}
        element=${element}
        label=${property.label}
        getValue=${getValue}
        setValue=${setValue}
        debounce=${debounce}
      />`;
  };
}

function createCheckbox(property: ActivitiPropertyDefinition) {
  return function ActivitiCheckbox(props: any) {
    const {element, id} = props;
    const modeling = useService('modeling');
    const propertyName = getPropertyName(property);
    const getValue = () => {
      const value = getPropertyTarget(element, property).get(propertyName);
      return value === undefined ? property.defaultValue === true : Boolean(value);
    };
    const setValue = (value: boolean) => updateProperty(modeling, element, property, {[propertyName]: value});

    return html`
      <${CheckboxEntry} id=${id} element=${element} label=${property.label} getValue=${getValue}
                        setValue=${setValue}/>`;
  };
}

function createMultiInstanceToggle(property: ActivitiPropertyDefinition) {
  return function ActivitiMultiInstanceToggle(props: any) {
    const {element, id} = props;
    const modeling = useService('modeling');
    const moddle = useService('moddle');
    const getValue = () => Boolean(getMultiInstanceLoopCharacteristics(element));
    const setValue = (value: boolean) => {
      const loopCharacteristics = getMultiInstanceLoopCharacteristics(element);

      if (value && !loopCharacteristics) {
        const newLoopCharacteristics = moddle.create('bpmn:MultiInstanceLoopCharacteristics', {isSequential: false});
        modeling.updateProperties(element, {loopCharacteristics: newLoopCharacteristics});
      } else if (!value && loopCharacteristics) {
        modeling.updateProperties(element, {loopCharacteristics: undefined});
      }
    };

    return html`
      <${CheckboxEntry} id=${id} element=${element} label=${property.label} getValue=${getValue}
                        setValue=${setValue}/>`;
  };
}

function createFormSelector(property: ActivitiPropertyDefinition) {
  return function ActivitiFormSelector(props: any) {
    const {element, id} = props;
    const eventBus = useService('eventBus');
    const propertyName = getPropertyName(property);
    const getValue = () => {
      const formKey = element.businessObject.get(propertyName);
      return formKey ? resolveFormTitle(formKey) || property.label : property.label;
    };
    const selectForm = () => eventBus.fire('process-services-community.form-key.select', {element});

    return html`
      <div class="bio-properties-panel-entry">
        <label class="bio-properties-panel-label" for=${id}>${property.label}</label>
        <button id=${id} class="bio-properties-panel-button" type="button" aria-label=${property.label}
                onClick=${selectForm}>
          ${getValue() || property.label}
        </button>
      </div>
    `;
  };
}

function createEntry(property: ActivitiPropertyDefinition) {
  if (property.control === 'multi-instance') {
    return {
      id: property.id,
      component: createMultiInstanceToggle(property),
      isEdited: (element: any) => Boolean(getMultiInstanceLoopCharacteristics(element))
    };
  }

  if (property.control === 'form-select') {
    return {
      id: property.id,
      component: createFormSelector(property),
      isEdited: (element: any) => Boolean(element.businessObject.get(getPropertyName(property)))
    };
  }

  const controls = {
    text: [createTextField, isTextFieldEntryEdited],
    textarea: [createTextArea, isTextAreaEntryEdited],
    checkbox: [createCheckbox, isCheckboxEntryEdited]
  } as const;
  const [createComponent, isEdited] = controls[property.control];
  const isPropertyEdited = property.target
    ? (element: any) => Boolean(getPropertyTarget(element, property).get(getPropertyName(property)))
    : isEdited;

  return {
    id: property.id,
    component: createComponent(property),
    isEdited: isPropertyEdited
  };
}

const PANEL_GROUPS = ACTIVITI_PROPERTY_CATALOG.map(({bpmnType, ...group}) => ({
  ...group,
  bpmnType,
  entries: group.properties.map(createEntry)
}));

function matchesGroup(element: any, bpmnType: string) {
  if (bpmnType === 'bpmn:MultiInstanceLoopCharacteristics') {
    return Boolean(getMultiInstanceLoopCharacteristics(element));
  }

  return is(element, bpmnType);
}

function ActivitiPropertiesProvider(this: any, propertiesPanel: any) {
  this.getGroups = (element: any) => (groups: any[]) => {
    const matchingGroups = PANEL_GROUPS.filter(({bpmnType}) => matchesGroup(element, bpmnType));

    matchingGroups.forEach((matchingGroup) => {
      groups.push({
        id: matchingGroup.id,
        label: matchingGroup.label,
        entries: matchingGroup.entries
      });
    });

    return groups;
  };

  propertiesPanel.registerProvider(500, this);
}

(ActivitiPropertiesProvider as any).$inject = ['propertiesPanel'];

export const ActivitiPropertiesProviderModule = {
  __init__: ['activitiPropertiesProvider'],
  activitiPropertiesProvider: ['type', ActivitiPropertiesProvider]
};
