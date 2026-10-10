import { BpmnModdle } from 'bpmn-moddle';
import { activitiModdleExtension } from './activiti-moddle';
import { ACTIVITI_PROPERTY_CATALOG } from './activiti-property-catalog';

describe('Activiti BPMN descriptor', () => {
  it('preserves Script Task and Service Task execution properties when BPMN is reopened', async () => {
    const moddle = new BpmnModdle({ activiti: activitiModdleExtension });
    const sourceXml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                        xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                        xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                        xmlns:activiti="http://activiti.org/bpmn"
                        id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="Process_1" isExecutable="true">
          <bpmn:serviceTask id="ServiceTask_1"
                            activiti:class="org.example.ApprovalDelegate"
                            activiti:async="true"
                            activiti:exclusive="false"
                            activiti:resultVariable="approval" />
          <bpmn:userTask id="UserTask_1"
                         activiti:assignee="${'$'}{owner}"
                         activiti:candidateUsers="reviewer,manager"
                         activiti:candidateGroups="approvers"
                         activiti:dueDate="${'$'}{deadline}"
                         activiti:priority="50" />
          <bpmn:scriptTask id="ScriptTask_1"
                           scriptFormat="javascript"
                           activiti:resultVariable="scriptResult">
            <bpmn:script>execution.setVariable('approved', true);</bpmn:script>
          </bpmn:scriptTask>
        </bpmn:process>
      </bpmn:definitions>`;

    const { rootElement } = await moddle.fromXML(sourceXml);
    const process: any = rootElement.rootElements.find((element: any) => element.$type === 'bpmn:Process');
    const serviceTask: any = process.flowElements.find((element: any) => element.$type === 'bpmn:ServiceTask');
    const userTask: any = process.flowElements.find((element: any) => element.$type === 'bpmn:UserTask');
    const scriptTask: any = process.flowElements.find((element: any) => element.$type === 'bpmn:ScriptTask');
    const { xml } = await moddle.toXML(rootElement);
    const reopened = await moddle.fromXML(xml);
    const reopenedProcess: any = reopened.rootElement.rootElements.find((element: any) => element.$type === 'bpmn:Process');
    const reopenedServiceTask: any = reopenedProcess.flowElements.find((element: any) => element.$type === 'bpmn:ServiceTask');
    const reopenedUserTask: any = reopenedProcess.flowElements.find((element: any) => element.$type === 'bpmn:UserTask');
    const reopenedScriptTask: any = reopenedProcess.flowElements.find((element: any) => element.$type === 'bpmn:ScriptTask');

    expect(serviceTask.get('activiti:class')).toBe('org.example.ApprovalDelegate');
    expect(userTask.get('activiti:assignee')).toBe('${owner}');
    expect(scriptTask.scriptFormat).toBe('javascript');
    expect(scriptTask.script).toContain("execution.setVariable('approved', true)");
    expect(reopenedServiceTask.get('activiti:class')).toBe('org.example.ApprovalDelegate');
    expect(reopenedServiceTask.get('activiti:async')).toBe(true);
    expect(reopenedServiceTask.get('activiti:exclusive')).toBe(false);
    expect(reopenedServiceTask.get('activiti:resultVariable')).toBe('approval');
    expect(reopenedUserTask.get('activiti:assignee')).toBe('${owner}');
    expect(reopenedUserTask.get('activiti:candidateUsers')).toBe('reviewer,manager');
    expect(reopenedUserTask.get('activiti:candidateGroups')).toBe('approvers');
    expect(reopenedUserTask.get('activiti:dueDate')).toBe('${deadline}');
    expect(reopenedUserTask.get('activiti:priority')).toBe('50');
    expect(reopenedScriptTask.scriptFormat).toBe('javascript');
    expect(reopenedScriptTask.script).toContain("execution.setVariable('approved', true)");
    expect(reopenedScriptTask.get('activiti:resultVariable')).toBe('scriptResult');
    expect(xml).not.toContain('camunda:');
  });

  it('declares every Activiti property in the shared catalog', () => {
    ACTIVITI_PROPERTY_CATALOG.forEach(({ bpmnType }) => {
      const moddleType = activitiModdleExtension.types.find((type) => type.extends.includes(bpmnType));
      const activitiProperties = ACTIVITI_PROPERTY_CATALOG.filter((group) => group.bpmnType === bpmnType)
        .flatMap((group) => group.properties)
        .filter((property) => property.namespace === 'activiti');

      if (activitiProperties.length === 0) {
        expect(moddleType).toBeUndefined();
        return;
      }

      expect(moddleType?.properties.map((property) => property.name.replace(/^activiti:/, ''))).toEqual(
        activitiProperties.map((property) => property.name)
      );
    });
  });

  it('serializes multi-instance characteristics created for a user task', async () => {
    const moddle = new BpmnModdle({ activiti: activitiModdleExtension });
    const sourceXml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                        xmlns:activiti="http://activiti.org/bpmn"
                        id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="Process_1" isExecutable="true">
          <bpmn:userTask id="UserTask_1" />
        </bpmn:process>
      </bpmn:definitions>`;

    const { rootElement } = await moddle.fromXML(sourceXml);
    const process: any = rootElement.rootElements.find((element: any) => element.$type === 'bpmn:Process');
    const userTask: any = process.flowElements.find((element: any) => element.$type === 'bpmn:UserTask');
    const loopCharacteristics = moddle.create('bpmn:MultiInstanceLoopCharacteristics', { isSequential: false });
    loopCharacteristics.set('activiti:collection', '${users}');
    loopCharacteristics.set('activiti:elementVariable', 'user');
    userTask.loopCharacteristics = loopCharacteristics;

    const { xml } = await moddle.toXML(rootElement);
    const reopened = await moddle.fromXML(xml);
    const reopenedProcess: any = reopened.rootElement.rootElements.find((element: any) => element.$type === 'bpmn:Process');
    const reopenedUserTask: any = reopenedProcess.flowElements.find((element: any) => element.$type === 'bpmn:UserTask');

    expect(reopenedUserTask.loopCharacteristics.isSequential).toBe(false);
    expect(reopenedUserTask.loopCharacteristics.get('activiti:collection')).toBe('${users}');
    expect(reopenedUserTask.loopCharacteristics.get('activiti:elementVariable')).toBe('user');
    expect(xml).toContain('<bpmn:multiInstanceLoopCharacteristics');
  });

  it('preserves process, activity, start event and additional task properties', async () => {
    const moddle = new BpmnModdle({ activiti: activitiModdleExtension });
    const sourceXml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                        xmlns:activiti="http://activiti.org/bpmn"
                        id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="Process_1" isExecutable="true"
                      activiti:candidateStarterUsers="manager,admin"
                      activiti:candidateStarterGroups="approvers"
                      activiti:jobPriority="50">
          <bpmn:startEvent id="StartEvent_1" activiti:initiator="starter" activiti:formKey="start-form" />
          <bpmn:serviceTask id="ServiceTask_1"
                            activiti:async="true"
                            activiti:exclusive="false"
                            activiti:jobPriority="75"
                            activiti:skipExpression="${'$'}{skipService}" />
          <bpmn:serviceTask id="MailTask_1" activiti:type="mail" />
          <bpmn:businessRuleTask id="BusinessRuleTask_1"
                                 activiti:ruleVariablesInput="order,customer"
                                 activiti:rules="approveOrder,checkCustomer"
                                 activiti:exclude="legacyRule"
                                 activiti:resultVariable="ruleResults" />
          <bpmn:callActivity id="CallActivity_1" activiti:businessKey="order-42" />
        </bpmn:process>
      </bpmn:definitions>`;

    const { rootElement } = await moddle.fromXML(sourceXml);
    const { xml } = await moddle.toXML(rootElement);
    const reopened = await moddle.fromXML(xml);
    const process: any = reopened.rootElement.rootElements.find((element: any) => element.$type === 'bpmn:Process');
    const getElement = (type: string) => process.flowElements.find((element: any) => element.$type === type);

    expect(process.get('activiti:candidateStarterUsers')).toBe('manager,admin');
    expect(process.get('activiti:candidateStarterGroups')).toBe('approvers');
    expect(process.get('activiti:jobPriority')).toBe('50');
    expect(getElement('bpmn:StartEvent').get('activiti:initiator')).toBe('starter');
    expect(getElement('bpmn:StartEvent').get('activiti:formKey')).toBe('start-form');
    expect(getElement('bpmn:ServiceTask').get('activiti:async')).toBe(true);
    expect(getElement('bpmn:ServiceTask').get('activiti:exclusive')).toBe(false);
    expect(getElement('bpmn:ServiceTask').get('activiti:jobPriority')).toBe('75');
    expect(getElement('bpmn:ServiceTask').get('activiti:skipExpression')).toBe('${skipService}');
    expect(process.flowElements.find((element: any) => element.id === 'MailTask_1').get('activiti:type')).toBe('mail');
    expect(getElement('bpmn:BusinessRuleTask').get('activiti:ruleVariablesInput')).toBe('order,customer');
    expect(getElement('bpmn:BusinessRuleTask').get('activiti:rules')).toBe('approveOrder,checkCustomer');
    expect(getElement('bpmn:BusinessRuleTask').get('activiti:exclude')).toBe('legacyRule');
    expect(getElement('bpmn:BusinessRuleTask').get('activiti:resultVariable')).toBe('ruleResults');
    expect(getElement('bpmn:CallActivity').get('activiti:businessKey')).toBe('order-42');
  });

  it('preserves Activiti multi-instance attributes and Activiti execution defaults', async () => {
    const moddle = new BpmnModdle({ activiti: activitiModdleExtension });
    const sourceXml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                        xmlns:activiti="http://activiti.org/bpmn"
                        id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="Process_1" isExecutable="true">
          <bpmn:userTask id="UserTask_1">
            <bpmn:multiInstanceLoopCharacteristics isSequential="false"
                                                   activiti:collection="${'$'}{users}"
                                                   activiti:elementVariable="user" />
          </bpmn:userTask>
          <bpmn:serviceTask id="ServiceTask_1" />
        </bpmn:process>
      </bpmn:definitions>`;

    const { rootElement } = await moddle.fromXML(sourceXml);
    const { xml } = await moddle.toXML(rootElement);
    const reopened = await moddle.fromXML(xml);
    const process: any = reopened.rootElement.rootElements.find((element: any) => element.$type === 'bpmn:Process');
    const userTask: any = process.flowElements.find((element: any) => element.$type === 'bpmn:UserTask');
    const serviceTask: any = process.flowElements.find((element: any) => element.$type === 'bpmn:ServiceTask');

    expect(userTask.loopCharacteristics.get('activiti:collection')).toBe('${users}');
    expect(userTask.loopCharacteristics.get('activiti:elementVariable')).toBe('user');
    expect(userTask.loopCharacteristics.isSequential).toBe(false);
    expect(serviceTask.get('activiti:async')).toBe(false);
    expect(serviceTask.get('activiti:exclusive')).toBe(true);
    expect(xml).toContain('activiti:collection="${users}"');
    expect(xml).toContain('activiti:elementVariable="user"');
  });
});
