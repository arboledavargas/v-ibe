import { describe, it, expect, vi } from 'vitest';
import { Signal } from './signal';
import { computed } from './computed';

describe('Subscription Management (Solid/Vue Pattern)', () => {
  describe('Bi-directional tracking', () => {
    it('should track sources when computed is recalculated', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Act: Read to trigger initial tracking
      double.get();

      // Assert: Internally, double should have count in its _sources
      // and count should have double's computation in its _subscribers
      // We verify this by changing count and seeing if double recalculates
      count.set(5);
      expect(double.get()).toBe(10);
    });

    it('should cleanup old sources when dependencies change', () => {
      // Arrange: Conditional dependency
      const useA = new Signal(true);
      const a = new Signal(1);
      const b = new Signal(2);

      const conditional = computed(() => {
        if (useA.get()) {
          return a.get() * 10;
        }
        return b.get() * 10;
      });

      // Act: Initial read (depends on useA and a)
      expect(conditional.get()).toBe(10); // a * 10

      // Change b (should NOT trigger because we're using a)
      b.set(999);
      expect(conditional.get()).toBe(10); // Still using a, not dirty

      // Switch to using b
      useA.set(false);
      expect(conditional.get()).toBe(9990); // Now b * 10

      // Assert: Now change a (should NOT trigger because we switched to b)
      // This is the KEY test - if cleanup worked, a is no longer a source
      a.set(777);
      expect(conditional.get()).toBe(9990); // Still using b, NOT dirty from a
    });

    it('should re-track sources on each recompute', () => {
      // Arrange
      const flag = new Signal(true);
      const x = new Signal(1);
      const y = new Signal(2);
      const z = new Signal(3);

      let recomputeCount = 0;
      const multi = computed(() => {
        recomputeCount++;
        if (flag.get()) {
          return x.get() + y.get();
        }
        return y.get() + z.get();
      });

      // Act: Initial read
      expect(multi.get()).toBe(3); // x + y = 1 + 2
      expect(recomputeCount).toBe(1);

      // Change z (should NOT trigger because flag is true)
      z.set(999);
      expect(multi.get()).toBe(3); // Still x + y, not dirty
      expect(recomputeCount).toBe(1); // NO recompute

      // Switch flag
      flag.set(false);
      expect(multi.get()).toBe(1001); // y + z = 2 + 999
      expect(recomputeCount).toBe(2);

      // Change x (should NOT trigger because flag is false)
      x.set(888);
      expect(multi.get()).toBe(1001); // Still y + z, not dirty
      expect(recomputeCount).toBe(2); // NO recompute
    });
  });

  describe('Memory management', () => {
    it('should unsubscribe from sources when disposed', () => {
      // Arrange
      const count = new Signal(0);
      const spy = vi.fn(() => count.get() * 2);
      const double = computed(spy);

      // Act: Read to initialize
      double.get();
      expect(spy).toHaveBeenCalledTimes(1);

      // Dispose
      double.dispose();

      // Change count
      count.set(10);

      // Assert: Should NOT recalculate because we disposed
      // The computed is no longer subscribed to count
      double.get();
      expect(spy).toHaveBeenCalledTimes(1); // Still 1, no recompute
    });

    it('should handle multiple computed depending on same signal', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);
      const triple = computed(() => count.get() * 3);

      // Act: Read both
      expect(double.get()).toBe(0);
      expect(triple.get()).toBe(0);

      // Change count
      count.set(5);

      // Assert: Both should update
      expect(double.get()).toBe(10);
      expect(triple.get()).toBe(15);

      // Dispose one
      double.dispose();

      // Change count again
      count.set(10);

      // Assert: Only triple should update
      expect(triple.get()).toBe(30);
      expect(double.get()).toBe(10); // Still old value
    });
  });

  describe('Diamond dependency pattern', () => {
    it('should handle diamond dependencies without duplicate computations', () => {
      //       count
      //       /   \
      //    double triple
      //       \   /
      //      combined
      const count = new Signal(1);

      const doubleSpy = vi.fn(() => count.get() * 2);
      const double = computed(doubleSpy);

      const tripleSpy = vi.fn(() => count.get() * 3);
      const triple = computed(tripleSpy);

      const combinedSpy = vi.fn(() => double.get() + triple.get());
      const combined = computed(combinedSpy);

      // Initial read
      expect(combined.get()).toBe(5); // 2 + 3
      expect(doubleSpy).toHaveBeenCalledTimes(1);
      expect(tripleSpy).toHaveBeenCalledTimes(1);
      expect(combinedSpy).toHaveBeenCalledTimes(1);

      // Change root
      count.set(10);

      // Read combined - should trigger recompute of all
      expect(combined.get()).toBe(50); // 20 + 30
      expect(doubleSpy).toHaveBeenCalledTimes(2);
      expect(tripleSpy).toHaveBeenCalledTimes(2);
      expect(combinedSpy).toHaveBeenCalledTimes(2);
    });

    it('should not have glitches in diamond pattern', () => {
      //       count
      //       /   \
      //    double triple
      //       \   /
      //      combined
      const count = new Signal(1);
      const double = computed(() => count.get() * 2);
      const triple = computed(() => count.get() * 3);

      const readLog: number[] = [];
      const combined = computed(() => {
        const d = double.get();
        const t = triple.get();
        readLog.push(d, t);
        return d + t;
      });

      // Initial read
      combined.get();
      expect(readLog).toEqual([2, 3]);

      // Change count and read IMMEDIATELY
      count.set(10);
      readLog.length = 0;
      const result = combined.get();

      // Assert: Should have read ONLY the new values, no glitch
      expect(readLog).toEqual([20, 30]);
      expect(result).toBe(50);
    });
  });

  describe('Edge cases', () => {
    it('should handle computed reading same signal multiple times', () => {
      // Arrange
      const count = new Signal(5);
      const spy = vi.fn(() => {
        const a = count.get();
        const b = count.get();
        const c = count.get();
        return a + b + c;
      });
      const triple = computed(spy);

      // Act
      expect(triple.get()).toBe(15);
      expect(spy).toHaveBeenCalledTimes(1);

      // Change count
      count.set(10);

      // Assert: Should still work correctly
      expect(triple.get()).toBe(30);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should handle computed with no dependencies', () => {
      // Arrange
      const spy = vi.fn(() => 42);
      const constant = computed(spy);

      // Act
      expect(constant.get()).toBe(42);
      expect(spy).toHaveBeenCalledTimes(1);

      // Read again
      expect(constant.get()).toBe(42);

      // Assert: Should only execute once (never marked dirty)
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should handle deeply nested conditional dependencies', () => {
      // Arrange
      const level = new Signal(1);
      const a = new Signal(1);
      const b = new Signal(2);
      const c = new Signal(3);

      const nested = computed(() => {
        const l = level.get();
        if (l === 1) return a.get();
        if (l === 2) return b.get();
        return c.get();
      });

      // Act: Start at level 1
      expect(nested.get()).toBe(1); // a

      // Change b and c (should NOT trigger)
      b.set(999);
      c.set(888);
      expect(nested.get()).toBe(1); // Still a

      // Move to level 2
      level.set(2);
      expect(nested.get()).toBe(999); // Now b

      // Change a (should NOT trigger)
      a.set(777);
      expect(nested.get()).toBe(999); // Still b

      // Move to level 3
      level.set(3);
      expect(nested.get()).toBe(888); // Now c
    });
  });

  describe('Subscription leak prevention', () => {
    it('should not accumulate subscriptions on repeated recomputes', () => {
      // This test verifies that we don't have subscription leaks
      // Each recompute should cleanup old subscriptions before adding new ones
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Initial read
      double.get();

      // Trigger many recomputes
      for (let i = 1; i <= 100; i++) {
        count.set(i);
        double.get();
      }

      // If there's a leak, count would have 100+ subscribers
      // We can't directly inspect _subscribers, but we can verify behavior
      // by checking that changes still trigger exactly one notification

      const spy = vi.fn();
      spy.priority = 'Sync';

      // Create a new computed that depends on count
      const anotherSpy = vi.fn(() => count.get() * 3);
      const triple = computed(anotherSpy);
      triple.get();

      // Change count
      count.set(200);

      // Both should recalculate exactly once
      expect(double.get()).toBe(400);
      expect(triple.get()).toBe(600);
      expect(anotherSpy).toHaveBeenCalledTimes(2); // Initial + after change
    });
  });
});
