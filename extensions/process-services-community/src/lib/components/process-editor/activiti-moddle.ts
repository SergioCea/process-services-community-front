import {ACTIVITI_PROPERTY_CATALOG} from './activiti-property-catalog';

export const activitiModdleExtension = {
  name: 'Activiti',
  uri: 'http://activiti.org/bpmn',
  prefix: 'activiti',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: ACTIVITI_PROPERTY_CATALOG.flatMap(({bpmnType, properties}) => {
    const activitiProperties = properties.filter((property) => property.namespace === 'activiti');

    return activitiProperties.length
      ? [
        {
          name: bpmnType.slice('bpmn:'.length),
          extends: [bpmnType],
          properties: activitiProperties.map(({name, moddleType, defaultValue}) => ({
            name,
            isAttr: true,
            type: moddleType || 'String',
            ...(defaultValue !== undefined ? {default: defaultValue} : {})
          }))
        }
      ]
      : [];
  })
};
