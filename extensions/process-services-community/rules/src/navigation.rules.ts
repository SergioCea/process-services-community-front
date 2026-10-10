import { RuleContext } from '@alfresco/adf-extensions';

/**
 * Checks if the current URL is the search process page.
 * JSON ref: `psc.navigation.isSearchProcess`
 */
export function isSearchProcess(context: RuleContext): boolean {
  const { url } = context.navigation;
  return url?.startsWith('/process-services-community/search');
}

/**
 * Checks if the current URL is the editor process page.
 * JSON ref: `psc.navigation.isEditorProcess`
 */
export function isEditorProcess(context: RuleContext): boolean {
  const { url } = context.navigation;
  return url?.startsWith('/process-services-community/editor');
}
