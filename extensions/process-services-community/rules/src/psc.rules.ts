import { AcaRuleContext } from '@alfresco/aca-shared/rules';
import { RuleContext } from '@alfresco/adf-extensions';

/**
 * Checks if the Process Services Community plugin is enabled.
 * JSON ref: `psc.isProcessServicesCommunityEnabled`
 */
export const isProcessServicesCommunityEnabled = (context: AcaRuleContext): boolean => {
  const flag = context.appConfig.get<boolean | string>('plugins.processServicesCommunity');
  return flag === true || flag === 'true';
};

/**
 * Checks if the Create Process button is available.
 * JSON ref: `psc.canCreateProcess`
 */
export function canCreateProcess(context: RuleContext): false | true | undefined {
  const { url } = context.navigation;
  return url?.endsWith('/process-services-community') || url?.endsWith('/process-services-community/tasks');
}

/**
 * Checks if the Create Process Definition button is available.
 * JSON ref: `psc.canCreateProcessDefinition`
 */
export function canCreateProcessDefinition(context: RuleContext): false | true | undefined {
  const { url } = context.navigation;
  return url?.endsWith('/process-services-community');
}

/**
 * Checks if the Search Process button is available.
 * JSON ref: `psc.canSearch`
 */
export function canSearch(context: RuleContext): false | true | undefined {
  const { url } = context.navigation;
  return url?.endsWith('/process-services-community');
}
