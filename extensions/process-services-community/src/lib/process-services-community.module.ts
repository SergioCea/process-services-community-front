import { EnvironmentProviders, NgModule, Provider } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideExtensionConfig, provideExtensions } from '@alfresco/adf-extensions';
import { provideTranslations } from '@alfresco/adf-core';
import { PscHomeComponent } from './components/home/home.component';
import { PscTasksComponent } from './components/tasks/tasks.component';
import { PscTaskCompletionComponent } from './components/tasks/task-completion.component';
import { PscProcessEditorComponent } from './components/process-editor/process-editor.component';
import { PscFormsComponent } from './components/forms/forms.component';
import * as rules from '@sergiocg/process-services-community/rules';
import { PscEffects } from '@sergiocg/process-services-community/store';

export function provideProcessServicesCommunityExtension(): (Provider | EnvironmentProviders)[] {
  return [
    provideExtensionConfig(['process-services-community.json']),
    provideExtensions({
      components: {
        'process-services-community.main.component': PscHomeComponent,
        'process-services-community.tasks.component': PscTasksComponent,
        'process-services-community.task-completion.component': PscTaskCompletionComponent,
        'process-services-community.process-editor.component': PscProcessEditorComponent,
        'process-services-community.forms.component': PscFormsComponent
      },
      evaluators: {
        'psc.isProcessServicesCommunityEnabled': rules.isProcessServicesCommunityEnabled,
        'psc.canCreateProcess': rules.canCreateProcess,
        'psc.canCreateProcessDefinition': rules.canCreateProcessDefinition,
        'psc.canSearch': rules.canSearch,
        'psc.navigation.isSearchProcess': rules.isSearchProcess,
        'psc.navigation.isEditorProcess': rules.isEditorProcess
      }
    }),
    provideEffects([PscEffects]),
    provideTranslations('process-services-community', 'assets/process-services-community')
  ];
}

@NgModule({
  providers: [...provideProcessServicesCommunityExtension()]
})
export class ProcessServicesCommunityModule {}
