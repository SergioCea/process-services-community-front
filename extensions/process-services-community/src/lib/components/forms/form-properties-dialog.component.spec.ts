/*!
 * Copyright © 2005-2026 Hyland Software, Inc. and its affiliates. All rights reserved.
 *
 * Alfresco Example Content Application
 *
 * This file is part of the Alfresco Example Content Application.
 * If the software was purchased under a paid Alfresco license, the terms of
 * the paid license agreement will prevail. Otherwise, the software is
 * provided under the following open source license terms:
 *
 * The Alfresco Example Content Application is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The Alfresco Example Content Application is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * from Hyland Software. If not, see <http://www.gnu.org/licenses/>.
 */

import {TestBed} from '@angular/core/testing';
import {Component} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {TranslateModule} from '@ngx-translate/core';
import {PscFormPropertiesDialogComponent} from './form-properties-dialog.component';

@Component({
  standalone: true,
  template: ''
})
class TestDialogHostComponent {
}

describe('PscFormPropertiesDialogComponent', () => {
  it('renders the properties panel inside the visible dialog', async () => {
    await TestBed.configureTestingModule({
      imports: [TestDialogHostComponent, PscFormPropertiesDialogComponent, MatDialogModule, NoopAnimationsModule, TranslateModule.forRoot()]
    }).compileComponents();

    const fixture = TestBed.createComponent(TestDialogHostComponent);
    fixture.detectChanges();
    const dialog = TestBed.inject(MatDialog);
    const returnContainer = document.createElement('div');
    const propertiesPanel = {attachTo: jest.fn()};
    const dialogRef = dialog.open(PscFormPropertiesDialogComponent, {
      data: {propertiesPanel, returnContainer},
      panelClass: 'psc-form-properties-dialog'
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const dialogContent = document.querySelector('.psc-form-properties-content');
    const overlay = document.querySelector('.psc-form-properties-dialog');

    expect(overlay).not.toBeNull();
    expect(dialogContent).not.toBeNull();
    expect(overlay?.querySelector('h2')?.textContent).toContain('PSC.FORMS.FIELD_PROPERTIES_TITLE');
    expect(dialogContent?.querySelector('[role="status"]')?.textContent).toContain('PSC.FORMS.NO_FIELD_PROPERTIES');
    expect(propertiesPanel.attachTo).toHaveBeenCalledWith(expect.any(HTMLElement));
    const attachedContainer = propertiesPanel.attachTo.mock.calls[0][0] as HTMLElement;
    expect(dialogContent?.contains(attachedContainer)).toBe(true);

    dialogRef.close();
    expect(propertiesPanel.attachTo).toHaveBeenLastCalledWith(returnContainer);
  });

  it('renders property groups as tabs and activates only the selected group', async () => {
    await TestBed.configureTestingModule({
      imports: [TestDialogHostComponent, PscFormPropertiesDialogComponent, MatDialogModule, NoopAnimationsModule, TranslateModule.forRoot()]
    }).compileComponents();

    const fixture = TestBed.createComponent(TestDialogHostComponent);
    fixture.detectChanges();
    const groupLabels = ['General', 'Appearance'];
    const groups = groupLabels.map((label) => {
      const group = document.createElement('div');
      group.className = 'bio-properties-panel-group';
      const header = document.createElement('div');
      header.className = 'bio-properties-panel-group-header';
      const title = document.createElement('div');
      title.className = 'bio-properties-panel-group-header-title';
      title.textContent = label;
      const entries = document.createElement('div');
      entries.className = 'bio-properties-panel-group-entries';
      header.addEventListener('click', () => {
        header.classList.toggle('open');
        entries.classList.toggle('open');
      });
      header.append(title);
      group.append(header, entries);
      return {group, header};
    });
    const panel = document.createElement('div');
    panel.className = 'bio-properties-panel';
    groups.forEach(({group}) => panel.append(group));
    const returnContainer = document.createElement('div');
    const propertiesPanel = {
      attachTo: jest.fn((container: HTMLElement) => container.append(panel))
    };
    const dialogRef = TestBed.inject(MatDialog).open(PscFormPropertiesDialogComponent, {
      data: {propertiesPanel, returnContainer},
      panelClass: 'psc-form-properties-dialog'
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = document.querySelector('.psc-form-properties-dialog');
    const tabs = dialog?.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    expect(tabs).toHaveLength(2);
    expect(tabs?.[0].textContent?.trim()).toBe('General');
    expect(tabs?.[0].getAttribute('aria-selected')).toBe('true');
    expect(groups[0].group.getAttribute('aria-hidden')).toBe('false');
    expect(groups[1].group.getAttribute('aria-hidden')).toBe('true');

    tabs?.[1].click();
    fixture.detectChanges();

    expect(tabs?.[1].getAttribute('aria-selected')).toBe('true');
    expect(groups[0].group.getAttribute('aria-hidden')).toBe('true');
    expect(groups[1].group.getAttribute('aria-hidden')).toBe('false');
    expect(groups[0].header.classList.contains('open')).toBe(false);
    expect(groups[1].header.classList.contains('open')).toBe(true);

    tabs?.[1].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
    fixture.detectChanges();

    expect(tabs?.[0].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs?.[0]);

    dialogRef.close();
  });
});
