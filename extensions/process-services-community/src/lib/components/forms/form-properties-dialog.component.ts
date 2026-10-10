import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

export interface FormPropertiesPanel {
  attachTo(container: HTMLElement): void;
}

export interface FormPropertiesDialogData {
  propertiesPanel: FormPropertiesPanel;
  returnContainer: HTMLElement;
}

interface FormPropertiesTab {
  key: string;
  id: string;
  panelId: string;
  label: string;
  group: HTMLElement;
  header: HTMLElement;
}

@Component({
  selector: 'psc-form-properties-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './form-properties-dialog.component.html'
})
export class PscFormPropertiesDialogComponent implements OnDestroy {
  readonly data = inject<FormPropertiesDialogData>(MAT_DIALOG_DATA);
  readonly propertyTabs = signal<FormPropertiesTab[]>([]);
  readonly selectedPropertyTab = signal<string | null>(null);

  private readonly dialogRef = inject(MatDialogRef<PscFormPropertiesDialogComponent>);
  private isPanelAttached = false;
  private propertiesPanelContainer?: HTMLElement;
  private propertiesPanelObserver?: MutationObserver;

  @ViewChild('propertyTabsContainer')
  private propertyTabsContainer?: ElementRef<HTMLElement>;

  @ViewChild('propertiesPanelContainer')
  set propertiesPanelHost(container: ElementRef<HTMLElement> | undefined) {
    if (container) {
      this.propertiesPanelContainer = container.nativeElement;
      this.data.propertiesPanel.attachTo(this.propertiesPanelContainer);
      this.isPanelAttached = true;
      this.watchPropertiesPanel();
    }
  }

  ngOnDestroy() {
    this.restorePanel();
  }

  close() {
    this.restorePanel();
    this.dialogRef.close();
  }

  selectPropertyTab(key: string) {
    const tab = this.propertyTabs().find((propertyTab) => propertyTab.key === key);
    if (!tab) {
      return;
    }

    this.selectedPropertyTab.set(key);
    this.updateActivePropertyGroup(tab);
  }

  handlePropertyTabKeydown(event: KeyboardEvent, index: number) {
    const tabs = this.propertyTabs();
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const tab = tabs[nextIndex];
    this.selectPropertyTab(tab.key);
    this.propertyTabsContainer?.nativeElement.querySelector<HTMLButtonElement>(`#${tab.id}`)?.focus();
  }

  restorePanel() {
    this.propertiesPanelObserver?.disconnect();
    this.propertiesPanelObserver = undefined;
    this.propertiesPanelContainer = undefined;
    this.propertyTabs.set([]);
    this.selectedPropertyTab.set(null);

    if (!this.isPanelAttached) {
      return;
    }

    this.data.propertiesPanel.attachTo(this.data.returnContainer);
    this.isPanelAttached = false;
  }

  private watchPropertiesPanel() {
    if (!this.propertiesPanelContainer) {
      return;
    }

    this.propertiesPanelObserver = new MutationObserver(() => this.refreshPropertyTabs());
    this.propertiesPanelObserver.observe(this.propertiesPanelContainer, { childList: true, subtree: true });
    this.refreshPropertyTabs();
  }

  private refreshPropertyTabs() {
    const groups = Array.from(this.propertiesPanelContainer?.querySelectorAll<HTMLElement>('.bio-properties-panel-group') ?? []).filter(
      (group) => !group.parentElement?.closest('.bio-properties-panel-group')
    );
    const selectedKey = this.selectedPropertyTab();
    const tabs = groups.flatMap((group, index) => {
      const header = group.querySelector<HTMLElement>(':scope > .bio-properties-panel-group-header');
      const label = group.querySelector<HTMLElement>(':scope > .bio-properties-panel-group-header .bio-properties-panel-group-header-title')?.textContent?.trim();
      if (!header || !label) {
        return [];
      }

      const key = group.dataset['groupId'] ?? label;
      const id = `psc-form-properties-tab-${index}`;
      const panelId = `psc-form-properties-panel-${index}`;
      group.id = panelId;
      group.classList.add('psc-form-properties-tab-panel');
      group.setAttribute('role', 'tabpanel');
      group.setAttribute('aria-labelledby', id);
      group.setAttribute('tabindex', '0');

      return [{ key, id, panelId, label, group, header }];
    });

    this.propertyTabs.set(tabs);
    const selectedTab = tabs.find((tab) => tab.key === selectedKey) ?? tabs[0];
    this.selectedPropertyTab.set(selectedTab?.key ?? null);
    this.updateActivePropertyGroup(selectedTab);
  }

  private updateActivePropertyGroup(activeTab?: FormPropertiesTab) {
    for (const tab of this.propertyTabs()) {
      const isActive = tab.key === activeTab?.key;
      tab.group.classList.toggle('psc-form-properties-active', isActive);
      tab.group.setAttribute('aria-hidden', String(!isActive));

      if (isActive && !tab.header.classList.contains('open')) {
        tab.header.click();
      } else if (!isActive && tab.header.classList.contains('open')) {
        tab.header.click();
      }
    }
  }
}