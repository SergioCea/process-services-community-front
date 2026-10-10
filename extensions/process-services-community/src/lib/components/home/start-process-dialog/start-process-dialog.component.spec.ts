import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PscStartProcessDialogComponent styles', () => {
  it('keeps dynamically rendered form checkboxes at a usable size', () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync(join(__dirname, 'start-process-dialog.component.css'), 'utf8').replace(/^@import[^;]*;\s*/gm, '');
    document.head.append(stylesheet);

    const viewer = document.createElement('div');
    viewer.className = 'psc-start-form-viewer';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    viewer.append(checkbox);
    document.body.append(viewer);

    try {
      const computedStyle = getComputedStyle(checkbox);
      expect(computedStyle.width).toBe('16px');
      expect(computedStyle.height).toBe('16px');
      expect(computedStyle.flexShrink).toBe('0');
      expect(computedStyle.appearance).toBe('auto');
    } finally {
      stylesheet.remove();
      viewer.remove();
    }
  });
});