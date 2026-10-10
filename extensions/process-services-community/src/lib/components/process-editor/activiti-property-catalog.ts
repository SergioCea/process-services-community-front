export type ActivitiPropertyControl = 'text' | 'textarea' | 'checkbox' | 'form-select' | 'multi-instance';
export type ActivitiPropertyNamespace = 'activiti' | 'bpmn';

export interface ActivitiPropertyDefinition {
  id: string;
  name: string;
  namespace: ActivitiPropertyNamespace;
  label: string;
  control: ActivitiPropertyControl;
  moddleType?: 'String' | 'Boolean';
  exclusiveGroup?: string;
  defaultValue?: string | boolean;
  target?: 'loopCharacteristics';
}

export interface ActivitiPropertyGroupDefinition {
  bpmnType: string;
  id: string;
  label: string;
  properties: ActivitiPropertyDefinition[];
}

export const ACTIVITI_CATALOG_ENGINE_VERSION = '5.22.0';
// The ACS runtime version is configured outside this frontend workspace.

const ACTIVITY_PROPERTIES: ActivitiPropertyDefinition[] = [
  {
    id: 'activiti-activity-async',
    name: 'async',
    namespace: 'activiti',
    label: 'Ejecución asíncrona',
    control: 'checkbox',
    moddleType: 'Boolean',
    defaultValue: false
  },
  {
    id: 'activiti-activity-exclusive',
    name: 'exclusive',
    namespace: 'activiti',
    label: 'Ejecución exclusiva',
    control: 'checkbox',
    moddleType: 'Boolean',
    defaultValue: true
  },
  {
    id: 'activiti-activity-job-priority',
    name: 'jobPriority',
    namespace: 'activiti',
    label: 'Prioridad del trabajo',
    control: 'text',
    moddleType: 'String'
  },
  {
    id: 'activiti-activity-skip-expression',
    name: 'skipExpression',
    namespace: 'activiti',
    label: 'Expresión para omitir la actividad',
    control: 'text',
    moddleType: 'String'
  }
];

export const ACTIVITI_PROPERTY_CATALOG: ActivitiPropertyGroupDefinition[] = [
  {
    bpmnType: 'bpmn:Activity',
    id: 'activiti-multi-instance-toggle',
    label: 'Ejecución multi-instancia',
    properties: [
      {
        id: 'activiti-multi-instance-enabled',
        name: 'loopCharacteristics',
        namespace: 'bpmn',
        label: 'Habilitar ejecución multi-instancia',
        control: 'multi-instance'
      }
    ]
  },
  {
    bpmnType: 'bpmn:MultiInstanceLoopCharacteristics',
    id: 'activiti-multi-instance',
    label: 'Ejecución multi-instancia Activiti',
    properties: [
      {
        id: 'activiti-multi-instance-collection',
        name: 'collection',
        namespace: 'activiti',
        label: 'Colección de elementos',
        control: 'text',
        moddleType: 'String',
        target: 'loopCharacteristics'
      },
      {
        id: 'activiti-multi-instance-element-variable',
        name: 'elementVariable',
        namespace: 'activiti',
        label: 'Variable del elemento',
        control: 'text',
        moddleType: 'String',
        target: 'loopCharacteristics'
      },
      {
        id: 'activiti-multi-instance-sequential',
        name: 'isSequential',
        namespace: 'bpmn',
        label: 'Ejecución secuencial',
        control: 'checkbox',
        moddleType: 'Boolean',
        defaultValue: false,
        target: 'loopCharacteristics'
      }
    ]
  },
  {
    bpmnType: 'bpmn:Activity',
    id: 'activiti-activity',
    label: 'Ejecución Activiti',
    properties: ACTIVITY_PROPERTIES
  },
  {
    bpmnType: 'bpmn:Process',
    id: 'activiti-process',
    label: 'Inicio y ejecución Activiti',
    properties: [
      {
        id: 'activiti-process-candidate-starter-users',
        name: 'candidateStarterUsers',
        namespace: 'activiti',
        label: 'Usuarios iniciadores (separados por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-process-candidate-starter-groups',
        name: 'candidateStarterGroups',
        namespace: 'activiti',
        label: 'Grupos iniciadores (separados por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-process-job-priority',
        name: 'jobPriority',
        namespace: 'activiti',
        label: 'Prioridad predeterminada del trabajo',
        control: 'text',
        moddleType: 'String'
      }
    ]
  },
  {
    bpmnType: 'bpmn:StartEvent',
    id: 'activiti-start-event',
    label: 'Formulario Activiti',
    properties: [
      {
        id: 'activiti-start-form-key',
        name: 'formKey',
        namespace: 'activiti',
        label: 'Clave del formulario',
        control: 'form-select',
        moddleType: 'String'
      },
      {
        id: 'activiti-start-initiator',
        name: 'initiator',
        namespace: 'activiti',
        label: 'Variable de usuario iniciador',
        control: 'text',
        moddleType: 'String'
      }
    ]
  },
  {
    bpmnType: 'bpmn:UserTask',
    id: 'activiti-user-task',
    label: 'Asignación Activiti',
    properties: [
      {
        id: 'activiti-user-form-key',
        name: 'formKey',
        namespace: 'activiti',
        label: 'Clave del formulario',
        control: 'form-select',
        moddleType: 'String'
      },
      {
        id: 'activiti-user-assignee',
        name: 'assignee',
        namespace: 'activiti',
        label: 'Asignado a',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-user-candidate-users',
        name: 'candidateUsers',
        namespace: 'activiti',
        label: 'Usuarios candidatos (separados por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-user-candidate-groups',
        name: 'candidateGroups',
        namespace: 'activiti',
        label: 'Grupos candidatos (separados por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-user-due-date',
        name: 'dueDate',
        namespace: 'activiti',
        label: 'Fecha de vencimiento',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-user-priority',
        name: 'priority',
        namespace: 'activiti',
        label: 'Prioridad',
        control: 'text',
        moddleType: 'String'
      }
    ]
  },
  {
    bpmnType: 'bpmn:ServiceTask',
    id: 'activiti-service-task',
    label: 'Implementación Activiti',
    properties: [
      {
        id: 'activiti-service-class',
        name: 'class',
        namespace: 'activiti',
        label: 'Clase Java',
        control: 'text',
        moddleType: 'String',
        exclusiveGroup: 'service-implementation'
      },
      {
        id: 'activiti-service-expression',
        name: 'expression',
        namespace: 'activiti',
        label: 'Expresión',
        control: 'text',
        moddleType: 'String',
        exclusiveGroup: 'service-implementation'
      },
      {
        id: 'activiti-service-delegate-expression',
        name: 'delegateExpression',
        namespace: 'activiti',
        label: 'Expresión de delegación',
        control: 'text',
        moddleType: 'String',
        exclusiveGroup: 'service-implementation'
      },
      {
        id: 'activiti-service-type',
        name: 'type',
        namespace: 'activiti',
        label: 'Tipo de servicio Activiti',
        control: 'text',
        moddleType: 'String',
        exclusiveGroup: 'service-implementation'
      },
      {
        id: 'activiti-service-result-variable',
        name: 'resultVariable',
        namespace: 'activiti',
        label: 'Variable de resultado',
        control: 'text',
        moddleType: 'String'
      }
    ]
  },
  {
    bpmnType: 'bpmn:ScriptTask',
    id: 'activiti-script-task',
    label: 'Script Activiti',
    properties: [
      {
        id: 'activiti-script-format',
        name: 'scriptFormat',
        namespace: 'bpmn',
        label: 'Formato del script',
        control: 'text'
      },
      {
        id: 'activiti-script-content',
        name: 'script',
        namespace: 'bpmn',
        label: 'Código del script',
        control: 'textarea'
      },
      {
        id: 'activiti-script-result-variable',
        name: 'resultVariable',
        namespace: 'activiti',
        label: 'Variable de resultado',
        control: 'text',
        moddleType: 'String'
      }
    ]
  },
  {
    bpmnType: 'bpmn:BusinessRuleTask',
    id: 'activiti-business-rule-task',
    label: 'Reglas de negocio Activiti',
    properties: [
      {
        id: 'activiti-business-rule-input',
        name: 'ruleVariablesInput',
        namespace: 'activiti',
        label: 'Variables de entrada (separadas por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-business-rule-names',
        name: 'rules',
        namespace: 'activiti',
        label: 'Reglas a ejecutar (separadas por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-business-rule-excluded-names',
        name: 'exclude',
        namespace: 'activiti',
        label: 'Reglas excluidas (separadas por coma)',
        control: 'text',
        moddleType: 'String'
      },
      {
        id: 'activiti-business-rule-result-variable',
        name: 'resultVariable',
        namespace: 'activiti',
        label: 'Variable de resultado',
        control: 'text',
        moddleType: 'String'
      }
    ]
  },
  {
    bpmnType: 'bpmn:CallActivity',
    id: 'activiti-call-activity',
    label: 'Llamada de proceso Activiti',
    properties: [
      {
        id: 'activiti-call-business-key',
        name: 'businessKey',
        namespace: 'activiti',
        label: 'Clave de negocio',
        control: 'text',
        moddleType: 'String'
      }
    ]
  }
];
