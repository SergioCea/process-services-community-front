export function getLatestProcessDefinitions(entries: any[]): any[] {
  const latestByProcess = new Map<string, any>();

  entries.forEach((entry, index) => {
    const definitionId = String(entry.id || entry.processId || '');
    const definitionIdMatch = definitionId.match(/^(.+):\d+:[^:]+$/);
    const processKey = entry.key || entry.processDefinitionKey || definitionIdMatch?.[1] || definitionId || `unknown-${index}`;
    const current = latestByProcess.get(processKey);
    const entryVersion = Number(entry.version) || 0;
    const currentVersion = Number(current?.version) || 0;

    if (!current || entryVersion > currentVersion) {
      latestByProcess.set(processKey, entry);
    }
  });

  return Array.from(latestByProcess.values());
}