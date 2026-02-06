import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Signal } from './signal';
import { computed } from './computed';

describe('Computed Signal', () => {
  describe('Glitch Prevention', () => {
    it('should NOT have glitch when reading immediately after dependency changes', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Act: Initial read
      expect(double.get()).toBe(0);

      // Act: Change dependency and read IMMEDIATELY (before any microtask)
      count.set(5);
      const result = double.get();

      // Assert: NO glitch - debe tener el valor actualizado
      expect(result).toBe(10);
    });

    it('should handle nested computed without glitches', () => {
      // Arrange
      const count = new Signal(1);
      const double = computed(() => count.get() * 2);
      const quadruple = computed(() => double.get() * 2);

      // Assert: Initial state
      expect(quadruple.get()).toBe(4);

      // Act: Change and read IMMEDIATELY
      count.set(5);

      // Assert: Both computed should have updated values
      expect(double.get()).toBe(10);
      expect(quadruple.get()).toBe(20);
    });

    it('should handle multiple dependency changes correctly', () => {
      // Arrange
      const a = new Signal(1);
      const b = new Signal(2);
      const sum = computed(() => a.get() + b.get());

      // Assert: Initial state
      expect(sum.get()).toBe(3);

      // Act: Change both dependencies
      a.set(10);
      b.set(20);

      // Assert: Should have latest values
      expect(sum.get()).toBe(30);
    });
  });

  describe('Lazy Evaluation', () => {
    it('should only recalculate when dirty', () => {
      // Arrange
      const count = new Signal(0);
      const spy = vi.fn(() => count.get() * 2);
      const double = computed(spy);

      // Act: First read - should calculate
      double.get();
      expect(spy).toHaveBeenCalledTimes(1);

      // Act: Second read without changes - should NOT recalculate
      double.get();
      expect(spy).toHaveBeenCalledTimes(1); // Still 1

      // Act: Change dependency and read - should recalculate
      count.set(5);
      double.get();
      expect(spy).toHaveBeenCalledTimes(2); // Now 2
    });

    it('should not execute getter until first read', () => {
      // Arrange
      const count = new Signal(0);
      const spy = vi.fn(() => count.get() * 2);

      // Act: Create computed but don't read it
      const double = computed(spy);

      // Assert: Getter should NOT have been called yet
      expect(spy).toHaveBeenCalledTimes(0);

      // Act: Read it
      double.get();

      // Assert: Now it should have been called
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reactivity', () => {
    it('should mark as dirty when dependency changes', () => {
      // Arrange
      const count = new Signal(0);
      const spy = vi.fn(() => count.get() * 2);
      const double = computed(spy);

      // Act: Read once
      double.get();
      expect(spy).toHaveBeenCalledTimes(1);

      // Act: Change dependency (but don't read)
      count.set(5);

      // Assert: Should still only have 1 call (lazy)
      expect(spy).toHaveBeenCalledTimes(1);

      // Act: Now read it
      const result = double.get();

      // Assert: Should have recalculated
      expect(spy).toHaveBeenCalledTimes(2);
      expect(result).toBe(10);
    });

    it('should not recalculate if value did not change', () => {
      // Arrange
      const count = new Signal(5);
      const spy = vi.fn(() => count.get());
      const identity = computed(spy);

      // Act: Read once
      identity.get();
      expect(spy).toHaveBeenCalledTimes(1);

      // Act: Set to same value
      count.set(5);
      identity.get();

      // Assert: Should NOT have recalculated (because Signal.set optimizes for same value)
      // Since count didn't actually change, computed wasn't marked dirty
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when trying to set', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Act & Assert
      expect(() => double.set(10)).toThrow('Cannot set a computed signal');
    });

    it('should throw error when trying to update', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Act & Assert
      expect(() => double.update(x => x + 1)).toThrow('Cannot update a computed signal');
    });
  });

  describe('Disposal', () => {
    it('should cleanup resources when disposed', () => {
      // Arrange
      const count = new Signal(0);
      const double = computed(() => count.get() * 2);

      // Act: Read to initialize
      double.get();

      // Act: Dispose
      double.dispose();

      // Assert: After disposal, changing dependency should not affect computed
      count.set(10);

      // The computed is disposed, so it won't recalculate
      // but we can still read the last value
      expect(double.get()).toBe(0); // Last computed value
    });
  });
});
