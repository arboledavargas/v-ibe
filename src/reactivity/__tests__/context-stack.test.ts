import { describe, it, expect, beforeEach } from 'vitest';
import { reactiveContext } from '../reactive-context';
import { ContextScope, withContext } from '../context-scope';
import { Subscriber } from '../types';

describe('Context Stack', () => {
  beforeEach(() => {
    // Reset context stack
    // @ts-ignore - accessing private for testing
    reactiveContext.computationStack = [];
    // @ts-ignore - accessing private for testing
    reactiveContext.contextStack = [];
  });

  describe('Stack básico', () => {
    it('debe empezar vacío', () => {
      expect(reactiveContext.currentComputation).toBe(null);
      expect(reactiveContext.isTracking).toBe(false);
      expect(reactiveContext.getContextStackSize()).toBe(0);
    });

    it('debe permitir push y pop de contextos', () => {
      const subscriber1: Subscriber = () => {};
      const subscriber2: Subscriber = () => {};

      reactiveContext.pushContext(subscriber1, true);
      expect(reactiveContext.currentComputation).toBe(subscriber1);
      expect(reactiveContext.isTracking).toBe(true);
      expect(reactiveContext.getContextStackSize()).toBe(1);

      reactiveContext.pushContext(subscriber2, false);
      expect(reactiveContext.currentComputation).toBe(subscriber2);
      expect(reactiveContext.isTracking).toBe(false);
      expect(reactiveContext.getContextStackSize()).toBe(2);

      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(subscriber1);
      expect(reactiveContext.isTracking).toBe(true);
      expect(reactiveContext.getContextStackSize()).toBe(1);

      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(null);
      expect(reactiveContext.isTracking).toBe(false);
      expect(reactiveContext.getContextStackSize()).toBe(0);
    });

    it('debe lanzar error si se hace pop de stack vacío', () => {
      expect(() => {
        reactiveContext.popContext();
      }).toThrow('Cannot pop context: stack is empty');
    });
  });

  describe('Stack unificado', () => {
    it('debe manejar múltiples contextos anidados correctamente', () => {
      const effect1: Subscriber = () => {};
      const contextSubscriber: Subscriber = () => {};

      // En el stack unificado, pushComputation y pushContext
      // agregan frames al mismo stack
      
      // Primero push de effect
      reactiveContext.pushComputation(effect1);
      expect(reactiveContext.currentComputation).toBe(effect1);
      expect(reactiveContext.isTracking).toBe(true); // pushComputation usa tracking=true

      // Luego push de otro contexto (se agrega encima)
      reactiveContext.pushContext(contextSubscriber, false);
      expect(reactiveContext.currentComputation).toBe(contextSubscriber);
      expect(reactiveContext.isTracking).toBe(false);

      // Pop del contexto superior
      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(effect1);
      expect(reactiveContext.isTracking).toBe(true);

      // Pop del effect (en stack unificado, usamos popContext)
      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(null);
    });

    it('removeComputation es un no-op en el stack unificado (para compatibilidad)', () => {
      const effect1: Subscriber = () => {};
      
      reactiveContext.pushComputation(effect1);
      expect(reactiveContext.currentComputation).toBe(effect1);
      
      // removeComputation no hace nada en el stack unificado
      // El frame debe removerse via popContext
      reactiveContext.removeComputation(effect1);
      
      // El frame sigue ahí (removeComputation es no-op)
      expect(reactiveContext.currentComputation).toBe(effect1);
      
      // Para limpiarlo correctamente, usar popContext
      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(null);
    });
  });

  describe('Contextos anidados', () => {
    it('debe manejar múltiples niveles de anidamiento', () => {
      const sub1: Subscriber = () => {};
      const sub2: Subscriber = () => {};
      const sub3: Subscriber = () => {};

      reactiveContext.pushContext(sub1, true);
      reactiveContext.pushContext(sub2, false);
      reactiveContext.pushContext(sub3, true);

      expect(reactiveContext.currentComputation).toBe(sub3);
      expect(reactiveContext.getContextStackSize()).toBe(3);

      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(sub2);

      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(sub1);

      reactiveContext.popContext();
      expect(reactiveContext.currentComputation).toBe(null);
    });
  });
});

describe('ContextScope (RAII)', () => {
  beforeEach(() => {
    // Reset context stack
    // @ts-ignore - accessing private for testing
    reactiveContext.computationStack = [];
    // @ts-ignore - accessing private for testing
    reactiveContext.contextStack = [];
  });

  describe('ContextScope básico', () => {
    it('debe establecer y limpiar contexto automáticamente', () => {
      const subscriber: Subscriber = () => {};

      expect(reactiveContext.currentComputation).toBe(null);
      expect(reactiveContext.isTracking).toBe(false);

      {
        const scope = new ContextScope(subscriber, true);
        expect(reactiveContext.currentComputation).toBe(subscriber);
        expect(reactiveContext.isTracking).toBe(true);
        expect(reactiveContext.getContextStackSize()).toBe(1);

        scope.dispose();
        expect(reactiveContext.currentComputation).toBe(null);
        expect(reactiveContext.isTracking).toBe(false);
        expect(reactiveContext.getContextStackSize()).toBe(0);
      }
    });

    it('debe ser idempotente (puede llamarse dispose múltiples veces)', () => {
      const subscriber: Subscriber = () => {};
      const scope = new ContextScope(subscriber, true);

      expect(reactiveContext.getContextStackSize()).toBe(1);

      scope.dispose();
      expect(reactiveContext.getContextStackSize()).toBe(0);

      scope.dispose(); // Segunda vez
      expect(reactiveContext.getContextStackSize()).toBe(0); // No cambia
    });
  });

  describe('withContext helper', () => {
    it('debe establecer y limpiar contexto automáticamente', () => {
      const subscriber: Subscriber = () => {};

      expect(reactiveContext.currentComputation).toBe(null);

      const result = withContext(subscriber, true, () => {
        expect(reactiveContext.currentComputation).toBe(subscriber);
        expect(reactiveContext.isTracking).toBe(true);
        return 42;
      });

      expect(result).toBe(42);
      expect(reactiveContext.currentComputation).toBe(null);
      expect(reactiveContext.isTracking).toBe(false);
    });

    it('debe limpiar contexto incluso si hay un error', () => {
      const subscriber: Subscriber = () => {};

      expect(() => {
        withContext(subscriber, true, () => {
          expect(reactiveContext.currentComputation).toBe(subscriber);
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // El contexto debe estar limpio incluso después del error
      expect(reactiveContext.currentComputation).toBe(null);
      expect(reactiveContext.getContextStackSize()).toBe(0);
    });

    it('debe retornar el valor de la función', () => {
      const subscriber: Subscriber = () => {};
      const result = withContext(subscriber, true, () => {
        return 'test result';
      });

      expect(result).toBe('test result');
    });
  });

  describe('Contextos anidados con RAII', () => {
    it('debe manejar múltiples scopes anidados', () => {
      const sub1: Subscriber = () => {};
      const sub2: Subscriber = () => {};
      const sub3: Subscriber = () => {};

      withContext(sub1, true, () => {
        expect(reactiveContext.currentComputation).toBe(sub1);
        expect(reactiveContext.getContextStackSize()).toBe(1);

        withContext(sub2, false, () => {
          expect(reactiveContext.currentComputation).toBe(sub2);
          expect(reactiveContext.isTracking).toBe(false);
          expect(reactiveContext.getContextStackSize()).toBe(2);

          withContext(sub3, true, () => {
            expect(reactiveContext.currentComputation).toBe(sub3);
            expect(reactiveContext.isTracking).toBe(true);
            expect(reactiveContext.getContextStackSize()).toBe(3);
          });

          expect(reactiveContext.currentComputation).toBe(sub2);
          expect(reactiveContext.getContextStackSize()).toBe(2);
        });

        expect(reactiveContext.currentComputation).toBe(sub1);
        expect(reactiveContext.getContextStackSize()).toBe(1);
      });

      expect(reactiveContext.currentComputation).toBe(null);
      expect(reactiveContext.getContextStackSize()).toBe(0);
    });
  });

  describe('Integración con effects', () => {
    it('debe funcionar correctamente cuando se usa dentro de effects', () => {
      const effectSubscriber: Subscriber = () => {};
      const contextSubscriber: Subscriber = () => {};

      reactiveContext.pushComputation(effectSubscriber);

      withContext(contextSubscriber, true, () => {
        // El contextStack tiene prioridad sobre computationStack
        expect(reactiveContext.currentComputation).toBe(contextSubscriber);
      });

      // Después del scope, vuelve al effect
      expect(reactiveContext.currentComputation).toBe(effectSubscriber);
    });
  });
});
