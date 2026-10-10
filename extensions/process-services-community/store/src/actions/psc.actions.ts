import {Action} from '@ngrx/store';

export enum PscActionTypes {
  SearchProcess = 'PSC_SEARCH_PROCESS',
  OpenEditor = 'PSC_OPEN_EDITOR',
  SaveProcess = 'PSC_SAVE_PROCESS',
  CreateProcess = 'PSC_CREATE_PROCESS',
  CreateForm = 'PSC_CREATE_FORM'
}

export class PscSearchProcessAction implements Action {
  readonly type = PscActionTypes.SearchProcess;

  constructor(public payload?: any) {
  }
}

export class PscOpenEditorAction implements Action {
  readonly type = PscActionTypes.OpenEditor;

  constructor(public payload?: any) {
  }
}

export class PscSaveProcessAction implements Action {
  readonly type = PscActionTypes.SaveProcess;

  constructor(public payload?: any) {
  }
}

export class PscCreateProcessAction implements Action {
  readonly type = PscActionTypes.CreateProcess;

  constructor(public payload?: any) {
  }
}
