import { getLatestProcessDefinitions } from './latest-process-definitions';

describe('getLatestProcessDefinitions', () => {
  it('returns only the highest version for each process', () => {
    const definitions = [
      { id: 'approval:1:deployment-1', version: 1, title: 'Approval v1' },
      { id: 'other:1:deployment-3', version: 1, title: 'Other' },
      { id: 'approval:2:deployment-2', version: 2, title: 'Approval v2' }
    ];

    expect(getLatestProcessDefinitions(definitions)).toEqual([definitions[2], definitions[1]]);
  });

  it('uses the process key when definition ids are not versioned ids', () => {
    const definitions = [
      { id: 'approval-v1', key: 'approval', version: '1' },
      { id: 'approval-v2', key: 'approval', version: '2' }
    ];

    expect(getLatestProcessDefinitions(definitions)).toEqual([definitions[1]]);
  });
});