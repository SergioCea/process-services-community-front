import {PscFormPropertiesContextActionProvider} from './form-properties-context-action';

describe('PscFormPropertiesContextActionProvider', () => {
  it('adds an edit action that opens the properties panel without clearing selection', () => {
    const formFieldContextActions = {registerProvider: jest.fn()};
    const eventBus = {fire: jest.fn()};
    const provider = new PscFormPropertiesContextActionProvider(formFieldContextActions, eventBus, 'Edit properties');
    const entries = provider.getContextPadEntries({type: 'textfield'});
    const action = entries['psc-edit-properties'];
    const stopPropagation = jest.fn();

    expect(formFieldContextActions.registerProvider).toHaveBeenCalledWith(1000, provider);
    expect(action).toEqual(expect.objectContaining({icon: 'edit', title: 'Edit properties', group: 'actions'}));

    action.action({stopPropagation});

    expect(stopPropagation).toHaveBeenCalled();
    expect(eventBus.fire).toHaveBeenCalledWith('psc.form.properties.open');
    expect(provider.getContextPadEntries({type: 'default'})).toEqual({});
  });
});
