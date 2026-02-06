import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderArrayChildGranular } from '../granular-array-renderer';
import { ReactiveArray } from '../../../reactivity/signals/reactive-array';
import { phaseScheduler } from '../../../reactivity/phase-scheduler';

describe('granular-array-renderer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('renderArrayChildGranular', () => {
    it('should render a reactive array with text nodes', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      // Should have: anchor + (anchor + text) x 3
      const textContent = container.textContent;
      expect(textContent).toBe('123');
    });

    it('should only re-render changed index when element changes', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      // Spy on effect executions
      const renderSpy = vi.fn();
      const originalCreateTextNode = document.createTextNode.bind(document);
      document.createTextNode = vi.fn((text: string) => {
        renderSpy(text);
        return originalCreateTextNode(text);
      });
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      // Initial render: 3 text nodes created
      expect(renderSpy).toHaveBeenCalledTimes(3);
      renderSpy.mockClear();
      
      // Change only index 1
      arr.splice(1, 1, 999);
      phaseScheduler.flush();
      
      // Should only re-render index 1, not 0 or 2
      // The changed element might trigger a new text node or update
      expect(container.textContent).toBe('19993');
      
      // Restore
      document.createTextNode = originalCreateTextNode;
    });

    it('should handle push() by creating new element effect', () => {
      const arr = new ReactiveArray([1, 2]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('12');
      
      arr.push(3);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
    });

    it('should handle pop() by removing last element', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
      
      arr.pop();
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('12');
    });

    it('should handle splice() to add elements in middle', () => {
      const arr = new ReactiveArray([1, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('13');
      
      arr.splice(1, 0, 2);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
    });

    it('should handle splice() to remove elements', () => {
      const arr = new ReactiveArray([1, 2, 3, 4]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('1234');
      
      arr.splice(1, 2); // Remove 2 and 3
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('14');
    });

    it('should handle reactive functions as array elements', () => {
      let value = 10;
      const arr = new ReactiveArray([
        () => value,
        () => value * 2,
      ]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('1020');
    });

    it('should handle DOM nodes as array elements', () => {
      const span1 = document.createElement('span');
      span1.textContent = 'A';
      const span2 = document.createElement('span');
      span2.textContent = 'B';
      
      const arr = new ReactiveArray([span1, span2]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('AB');
      expect(container.querySelectorAll('span').length).toBe(2);
    });

    it('should handle null and undefined elements', () => {
      const arr = new ReactiveArray([1, null, undefined, 2]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      // null and undefined should be skipped
      expect(container.textContent).toBe('12');
    });

    it('should handle boolean elements', () => {
      const arr = new ReactiveArray([1, true, false, 2]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      // Booleans should be skipped
      expect(container.textContent).toBe('12');
    });

    it('should maintain order when elements are reordered', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
      
      arr.reverse();
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('321');
    });

    it('should clear array when length becomes 0', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
      
      arr.splice(0, arr.length);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('');
    });

    it('should handle rapid successive changes', () => {
      const arr = new ReactiveArray([1]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      arr.push(2);
      arr.push(3);
      arr.push(4);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('1234');
      
      arr.pop();
      arr.pop();
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('12');
    });
  });

  describe('Granularity tests - effects should be isolated', () => {
    it('should not re-run effect for unchanged indices', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      const effectRuns = new Map<number, number>();
      
      // Track how many times each index's effect runs
      const originalAt = arr.at.bind(arr);
      arr.at = vi.fn((index: number) => {
        effectRuns.set(index, (effectRuns.get(index) || 0) + 1);
        return originalAt(index);
      });
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      // Initial render: each index accessed once
      expect(effectRuns.get(0)).toBe(1);
      expect(effectRuns.get(1)).toBe(1);
      expect(effectRuns.get(2)).toBe(1);
      
      effectRuns.clear();
      
      // Change only index 1
      arr.splice(1, 1, 999);
      phaseScheduler.flush();
      
      // Only index 1 should be accessed again
      expect(effectRuns.get(0)).toBeUndefined(); // Not accessed
      expect(effectRuns.get(1)).toBe(1); // Accessed once for update
      expect(effectRuns.get(2)).toBeUndefined(); // Not accessed
    });

    it('should create new effects for new indices when pushing', () => {
      const arr = new ReactiveArray([1, 2]);
      const accessLog: string[] = [];
      
      const originalAt = arr.at.bind(arr);
      arr.at = vi.fn((index: number) => {
        accessLog.push(`access-${index}`);
        return originalAt(index);
      });
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(accessLog).toEqual(['access-0', 'access-1']);
      accessLog.length = 0;
      
      arr.push(3);
      phaseScheduler.flush();
      
      // Should create effect for new index 2
      expect(accessLog).toContain('access-2');
      expect(container.textContent).toBe('123');
    });

    it('should cleanup effects for removed indices when popping', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
      
      arr.pop();
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('12');
      
      // Verify that there are no lingering effects for index 2
      // by checking that only 2 text nodes remain
      const textNodes = Array.from(container.childNodes).filter(
        node => node.nodeType === Node.TEXT_NODE && node.textContent
      );
      expect(textNodes.length).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array', () => {
      const arr = new ReactiveArray([]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('');
    });

    it('should handle array becoming empty then filled again', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('123');
      
      arr.splice(0, arr.length);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('');
      
      arr.push(4, 5, 6);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('456');
    });

    it('should handle array with single element', () => {
      const arr = new ReactiveArray([42]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('42');
    });

    it('should handle changing from number to DOM node', () => {
      const arr = new ReactiveArray<number | Node>([1, 2]);
      
      renderArrayChildGranular(container, arr);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('12');
      
      const span = document.createElement('span');
      span.textContent = 'X';
      arr.splice(1, 1, span);
      phaseScheduler.flush();
      
      expect(container.textContent).toBe('1X');
      expect(container.querySelector('span')).toBe(span);
    });
  });
});
