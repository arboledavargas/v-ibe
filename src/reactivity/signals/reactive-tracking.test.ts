import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Signal } from './signal';
import { computed } from './computed';
import { reactiveContext } from '../reactive-context';

describe('Reactive Tracking System', () => {
  describe('Signal subscription mechanism', () => {
    it('should add subscriber when read in reactive context', () => {
      // Arrange
      const count = new Signal(0);
      const mockSubscriber = vi.fn();
      mockSubscriber.priority = 'Sync';

      // Act: Read signal in reactive context
      reactiveContext.pushComputation(mockSubscriber);
      reactiveContext.setTracking(true);
      count.get();
      reactiveContext.setTracking(false);
      reactiveContext.removeComputation(mockSubscriber);

      // Assert: Subscriber should be added
      // We can't directly inspect _subscribers (private), but we can test behavior
      // When signal changes, subscriber should be notified
      count.set(5);

      // Wait for microtask to execute
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(mockSubscriber).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should NOT add subscriber when tracking is disabled', () => {
      // Arrange
      const count = new Signal(0);
      const mockSubscriber = vi.fn();
      mockSubscriber.priority = 'Sync';

      // Act: Read signal with tracking disabled
      reactiveContext.pushComputation(mockSubscriber);
      reactiveContext.setTracking(false); // ← Tracking disabled
      count.get();
      reactiveContext.removeComputation(mockSubscriber);

      // Assert: Subscriber should NOT be notified when signal changes
      count.set(5);

      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(mockSubscriber).not.toHaveBeenCalled();
          resolve();
        });
      });
    });
  });

  describe('Computed dependency tracking', () => {
    it('should track signal as dependency when read in getter', () => {
      // Arrange
      const count = new Signal(0);
      const computedSpy = vi.fn(() => count.get() * 2);
      const double = computed(computedSpy);

      // Act: Read computed (should execute getter and track count)
      double.get();
      expect(computedSpy).toHaveBeenCalledTimes(1);

      // Change count
      count.set(5);

      // Read computed again
      const result = double.get();

      // Assert: Should have recalculated because count changed
      expect(computedSpy).toHaveBeenCalledTimes(2);
      expect(result).toBe(10);
    });

    it('should re-track dependencies on each recompute', () => {
      // Arrange
      const a = new Signal(1);
      const b = new Signal(2);
      const useB = new Signal(false);

      const conditional = computed(() => {
        if (useB.get()) {
          return b.get() * 10;
        }
        return a.get() * 10;
      });

      // Act: Initial read (should depend on 'a' and 'useB')
      expect(conditional.get()).toBe(10); // a * 10

      // Change 'b' (should NOT trigger recalculation because we're using 'a')
      b.set(999);
      expect(conditional.get()).toBe(10); // Still a * 10, not dirty

      // Switch to using 'b'
      useB.set(true);
      expect(conditional.get()).toBe(9990); // Now b * 10 = 999 * 10

      // Now change 'a' (should NOT trigger because we switched to 'b')
      a.set(999);

      // Assert: Should still be using 'b', not 'a'
      expect(conditional.get()).toBe(9990); // Still b * 10 = 999 * 10
    });
  });

  describe('Computed dirty flag behavior', () => {
    it('should start as dirty', () => {
      // Arrange
      const spy = vi.fn(() => 42);
      const comp = computed(spy);

      // Assert: Should not have executed yet
      expect(spy).toHaveBeenCalledTimes(0);

      // Act: First read
      comp.get();

      // Assert: Should execute on first read
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should mark as dirty when dependency changes', () => {
      // Arrange
      const count = new Signal(0);
      const spy = vi.fn(() => count.get() * 2);
      const double = computed(spy);

      // Initial read
      double.get();
      expect(spy).toHaveBeenCalledTimes(1);

      // Act: Change dependency
      count.set(5);

      // Don't read yet - just verify that next read will recalculate
      double.get();

      // Assert: Should have recalculated
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should clear dirty flag after recompute', () => {
      // Arrange
      const count = new Signal(0);
      const spy = vi.fn(() => count.get() * 2);
      const double = computed(spy);

      // Act: Read, change, read, read again
      double.get();
      count.set(5);
      double.get(); // Should recalculate
      double.get(); // Should NOT recalculate

      // Assert: Should only have 2 calls (initial + after change)
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scheduler integration', () => {
    it('should schedule computation when dependency changes', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Read to initialize tracking
      double.get();

      // Act: Change dependency
      count.set(5);

      // Assert: Computed should be marked dirty immediately (synchronously)
      // We can't inspect _isDirty directly, but we know it should recalculate on next read
      const result = double.get();
      expect(result).toBe(10);
    });

    it('should handle synchronous reads after dependency change', () => {
      // This is the GLITCH test - the most important one
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Initial state
      expect(double.get()).toBe(0);

      // Change and read IMMEDIATELY (synchronously, before microtask)
      count.set(5);
      const result = double.get();

      // Assert: Should have the NEW value, not stale
      expect(result).toBe(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle computed that reads same signal multiple times', () => {
      // Arrange
      const count = new Signal(5);
      const weird = computed(() => {
        const a = count.get();
        const b = count.get();
        const c = count.get();
        return a + b + c;
      });

      // Act & Assert
      expect(weird.get()).toBe(15); // 5 + 5 + 5

      count.set(10);
      expect(weird.get()).toBe(30); // 10 + 10 + 10
    });

    it('should handle computed with no dependencies', () => {
      // Arrange
      const spy = vi.fn(() => 42);
      const constant = computed(spy);

      // Act
      const result1 = constant.get();
      const result2 = constant.get();

      // Assert: Should only execute once (no dependencies to make it dirty)
      expect(spy).toHaveBeenCalledTimes(1);
      expect(result1).toBe(42);
      expect(result2).toBe(42);
    });

    it('should handle diamond dependency pattern', () => {
      //       count
      //       /   \
      //    double triple
      //       \   /
      //      combined
      const count = new Signal(1);
      const double = computed(() => count.get() * 2);
      const triple = computed(() => count.get() * 3);
      const combined = computed(() => double.get() + triple.get());

      // Initial state
      expect(combined.get()).toBe(5); // 2 + 3

      // Change root
      count.set(10);

      // Assert: All should update correctly
      expect(double.get()).toBe(20);
      expect(triple.get()).toBe(30);
      expect(combined.get()).toBe(50); // 20 + 30
    });
  });
});
