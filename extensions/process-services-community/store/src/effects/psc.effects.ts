import {inject, Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {map, tap} from 'rxjs/operators';
import {PscActionTypes, PscOpenEditorAction, PscSearchProcessAction} from '../actions/psc.actions';
import {Router} from '@angular/router';

@Injectable()
export class PscEffects {
  private actions$ = inject(Actions);
  private router = inject(Router);

  searchProcess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<PscSearchProcessAction>(PscActionTypes.SearchProcess),
        map(() => {
          this.router.navigate(['/process-services-community/search']);
        })
      ),
    {dispatch: false}
  );

  openEditor$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<PscOpenEditorAction>(PscActionTypes.OpenEditor),
        tap(() => {
          this.router.navigate(['/process-services-community/editor']);
        })
      ),
    {dispatch: false}
  );
}
