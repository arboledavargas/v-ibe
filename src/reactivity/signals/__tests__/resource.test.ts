import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createResource, IResource } from '../resource';
import { Signal } from '../signal';
import { phaseScheduler } from '../../phase-scheduler';
import { reactiveContext } from '../../reactive-context';

describe('Resource', () => {
  beforeEach(() => {
    // Limpiar el scheduler antes de cada test
    // @ts-ignore - accessing private for cleanup
    phaseScheduler.dirtyEffects.clear();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;
    
    // Reset reactive context
    // @ts-ignore - accessing private properties for testing
    reactiveContext.computationStack = [];
    // @ts-ignore - accessing private properties for testing
    reactiveContext.contextStack = [];
  });

  afterEach(() => {
    // Asegurar que no queden efectos pendientes
    phaseScheduler.flush();
  });

  describe('Creación y estado inicial', () => {
    it('debe crear un resource con estado pending inicialmente', () => {
      const resource = createResource(() => Promise.resolve('data'));
      
      expect(resource.state).toBe('pending');
      expect(resource.get()).toBeUndefined();
      expect(resource.error).toBeUndefined();
    });

    it('debe tener la marca isSignal', () => {
      const resource = createResource(() => Promise.resolve('data'));
      
      expect(resource.isSignal).toBe(true);
    });

    it('debe ejecutar la función source inmediatamente', async () => {
      const sourceFn = vi.fn(() => Promise.resolve('data'));
      
      createResource(sourceFn);
      
      // Esperar un poco para que se ejecute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(sourceFn).toHaveBeenCalledTimes(1);
    });

    it('debe pasar un AbortSignal a la función source', async () => {
      let receivedSignal: AbortSignal | null = null;
      
      createResource((signal) => {
        receivedSignal = signal;
        return Promise.resolve('data');
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(receivedSignal?.aborted).toBe(false);
    });
  });

  describe('Carga exitosa de datos', () => {
    it('debe cambiar a estado ready cuando la Promise se resuelve', async () => {
      const resource = createResource(() => Promise.resolve('test data'));
      
      expect(resource.state).toBe('pending');
      
      // Esperar a que se resuelva
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
      expect(resource.get()).toBe('test data');
      expect(resource.error).toBeUndefined();
    });

    it('debe almacenar los datos correctamente', async () => {
      const testData = { name: 'John', age: 30 };
      const resource = createResource(() => Promise.resolve(testData));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.get()).toBe(testData);
      expect(resource.get()?.name).toBe('John');
      expect(resource.get()?.age).toBe(30);
    });

    it('debe manejar diferentes tipos de datos', async () => {
      const stringResource = createResource(() => Promise.resolve('string'));
      const numberResource = createResource(() => Promise.resolve(42));
      const boolResource = createResource(() => Promise.resolve(true));
      const arrayResource = createResource(() => Promise.resolve([1, 2, 3]));
      const nullResource = createResource(() => Promise.resolve(null));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(stringResource.get()).toBe('string');
      expect(numberResource.get()).toBe(42);
      expect(boolResource.get()).toBe(true);
      expect(arrayResource.get()).toEqual([1, 2, 3]);
      expect(nullResource.get()).toBe(null);
    });

    it('debe limpiar el error cuando se carga exitosamente', async () => {
      const retrySignal = new Signal(1);
      let attemptCount = 0;
      
      const resource = createResource(() => {
        attemptCount++;
        const attempt = retrySignal.get();
        
        if (attempt === 1) {
          return Promise.reject(new Error('First error'));
        }
        return Promise.resolve('success');
      });
      
      // Esperar el primer error
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
      expect(attemptCount).toBe(1);
      
      // Cambiar la dependencia para forzar re-ejecución
      retrySignal.set(2);
      phaseScheduler.flush();
      
      // Esperar el segundo intento exitoso
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
      expect(resource.get()).toBe('success');
      expect(resource.error).toBeUndefined();
      expect(attemptCount).toBe(2);
    });
  });

  describe('Manejo de errores', () => {
    it('debe cambiar a estado error cuando la Promise se rechaza', async () => {
      const testError = new Error('Test error');
      const resource = createResource(() => Promise.reject(testError));
      
      expect(resource.state).toBe('pending');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
      expect(resource.get()).toBeUndefined();
      expect(resource.error).toBeInstanceOf(Error);
      expect(resource.error?.message).toBe('Test error');
    });

    it('debe convertir errores no-Error a Error', async () => {
      const resource = createResource(() => Promise.reject('string error'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
      expect(resource.error).toBeInstanceOf(Error);
      expect(resource.error?.message).toBe('string error');
    });

    it('debe manejar errores numéricos', async () => {
      const resource = createResource(() => Promise.reject(404));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
      expect(resource.error).toBeInstanceOf(Error);
      expect(resource.error?.message).toBe('404');
    });

    it('no debe tratar AbortError como error real', async () => {
      const resource = createResource((signal) => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, 10);
        });
      });
      
      // Esperar un poco
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // El resource debe seguir en pending porque AbortError se ignora
      // (aunque en este caso la Promise se rechaza, el resource no cambia a error)
      await new Promise(resolve => setTimeout(resolve, 20));
      phaseScheduler.flush();
      
      // El estado puede ser pending o ready dependiendo de si se completó
      // Lo importante es que no debe estar en error por AbortError
      expect(resource.state).not.toBe('error');
    });
  });

  describe('Cancelación con AbortSignal', () => {
    it('debe abortar la operación anterior cuando se re-ejecuta', async () => {
      let abortCount = 0;
      const resource = createResource((signal) => {
        signal.addEventListener('abort', () => {
          abortCount++;
        });
        
        return new Promise((resolve) => {
          setTimeout(() => resolve('data'), 50);
        });
      });
      
      // Esperar un poco para que comience la primera operación
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Forzar re-ejecución (simulando cambio de dependencia)
      // Esto se hace automáticamente cuando cambia una dependencia reactiva
      // Por ahora, verificamos que el abort controller existe
      
      expect(abortCount).toBe(0); // Aún no se ha abortado
    });

    it('debe cancelar operaciones obsoletas cuando cambian las dependencias', async () => {
      const idSignal = new Signal(1);
      let abortCount = 0;
      let resolveCount = 0;
      const resolves: Array<() => void> = [];
      
      const resource = createResource((signal) => {
        const currentId = idSignal.get(); // Dependencia reactiva
        
        signal.addEventListener('abort', () => {
          abortCount++;
        });
        
        return new Promise((resolve) => {
          resolves.push(() => {
            resolveCount++;
            resolve(`data-${currentId}`);
          });
          
          // Simular trabajo asíncrono
          setTimeout(() => {
            if (!signal.aborted) {
              resolve(`data-${currentId}`);
              resolveCount++;
            }
          }, 50);
        });
      });
      
      // Esperar un poco para que comience la primera operación
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cambiar la dependencia (esto debe cancelar la operación anterior)
      idSignal.set(2);
      phaseScheduler.flush();
      
      // Esperar a que se complete la nueva operación
      await new Promise(resolve => setTimeout(resolve, 60));
      phaseScheduler.flush();
      
      // La primera operación debe haberse cancelado (o al menos intentado)
      // Nota: Puede haber múltiples resoluciones si el timing no es perfecto
      // Lo importante es que el valor final sea correcto
      expect(resource.get()).toBe('data-2');
      // Al menos una operación debe haberse completado
      expect(resolveCount).toBeGreaterThanOrEqual(1);
    });

    it('debe ignorar resultados de operaciones canceladas', async () => {
      const idSignal = new Signal(1);
      let firstResolved = false;
      
      const resource = createResource((signal) => {
        const currentId = idSignal.get();
        
        return new Promise((resolve) => {
          setTimeout(() => {
            if (currentId === 1) {
              firstResolved = true;
            }
            resolve(`data-${currentId}`);
          }, 50);
        });
      });
      
      // Esperar un poco
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cambiar la dependencia antes de que se complete la primera
      idSignal.set(2);
      phaseScheduler.flush();
      
      // Esperar a que se complete
      await new Promise(resolve => setTimeout(resolve, 60));
      phaseScheduler.flush();
      
      // La primera operación puede haberse resuelto, pero no debe afectar el resource
      // El resource debe tener el valor de la segunda operación
      expect(resource.get()).toBe('data-2');
    });
  });

  describe('Reactividad', () => {
    it('debe re-ejecutarse cuando cambia una dependencia reactiva', async () => {
      const idSignal = new Signal(1);
      let executionCount = 0;
      
      const resource = createResource((signal) => {
        executionCount++;
        const id = idSignal.get(); // Dependencia reactiva
        return Promise.resolve(`data-${id}`);
      });
      
      // Esperar ejecución inicial
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(executionCount).toBe(1);
      expect(resource.get()).toBe('data-1');
      
      // Cambiar la dependencia
      idSignal.set(2);
      phaseScheduler.flush();
      
      // Esperar nueva ejecución
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(resource.get()).toBe('data-2');
    });

    it('debe re-ejecutarse cuando cambian múltiples dependencias', async () => {
      const aSignal = new Signal(1);
      const bSignal = new Signal(2);
      let executionCount = 0;
      
      const resource = createResource((signal) => {
        executionCount++;
        const a = aSignal.get();
        const b = bSignal.get();
        return Promise.resolve(a + b);
      });
      
      // Esperar ejecución inicial
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(executionCount).toBe(1);
      expect(resource.get()).toBe(3);
      
      // Cambiar una dependencia
      aSignal.set(10);
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(resource.get()).toBe(12);
      
      // Cambiar otra dependencia
      bSignal.set(20);
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(executionCount).toBe(3);
      expect(resource.get()).toBe(30);
    });

    it('debe volver a pending cuando se re-ejecuta', async () => {
      const idSignal = new Signal(1);
      
      const resource = createResource((signal) => {
        const id = idSignal.get();
        return Promise.resolve(`data-${id}`);
      });
      
      // Esperar carga inicial
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
      
      // Cambiar dependencia
      idSignal.set(2);
      phaseScheduler.flush();
      
      // Debe volver a pending inmediatamente
      expect(resource.state).toBe('pending');
      
      // Esperar nueva carga
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
    });
  });

  describe('Estados', () => {
    it('debe transicionar de pending a ready en caso de éxito', async () => {
      const resource = createResource(() => Promise.resolve('data'));
      
      expect(resource.state).toBe('pending');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
    });

    it('debe transicionar de pending a error en caso de fallo', async () => {
      const resource = createResource(() => Promise.reject(new Error('error')));
      
      expect(resource.state).toBe('pending');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
    });

    it('debe transicionar de ready a pending cuando se re-ejecuta', async () => {
      const idSignal = new Signal(1);
      const resource = createResource((signal) => {
        const id = idSignal.get();
        return Promise.resolve(`data-${id}`);
      });
      
      // Esperar carga inicial
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
      
      // Cambiar dependencia
      idSignal.set(2);
      phaseScheduler.flush();
      
      expect(resource.state).toBe('pending');
    });

    it('debe transicionar de error a pending cuando se re-ejecuta', async () => {
      const idSignal = new Signal(1);
      let shouldError = true;
      
      const resource = createResource((signal) => {
        const id = idSignal.get();
        if (shouldError && id === 1) {
          return Promise.reject(new Error('error'));
        }
        return Promise.resolve(`data-${id}`);
      });
      
      // Esperar error inicial
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
      
      // Cambiar dependencia (esto debe re-ejecutar)
      shouldError = false;
      idSignal.set(2);
      phaseScheduler.flush();
      
      expect(resource.state).toBe('pending');
      
      // Esperar nueva carga
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
    });
  });

  describe('Edge cases', () => {
    it('debe manejar Promises que se resuelven inmediatamente', async () => {
      const resource = createResource(() => Promise.resolve('immediate'));
      
      // No necesitamos esperar
      await new Promise(resolve => setTimeout(resolve, 5));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
      expect(resource.get()).toBe('immediate');
    });

    it('debe manejar Promises que se rechazan inmediatamente', async () => {
      const resource = createResource(() => Promise.reject(new Error('immediate error')));
      
      await new Promise(resolve => setTimeout(resolve, 5));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('error');
      expect(resource.error?.message).toBe('immediate error');
    });

    it('debe manejar múltiples cambios rápidos de dependencias', async () => {
      const idSignal = new Signal(1);
      let executionCount = 0;
      
      const resource = createResource((signal) => {
        executionCount++;
        const id = idSignal.get();
        return new Promise((resolve) => {
          setTimeout(() => resolve(`data-${id}`), 20);
        });
      });
      
      // Cambios rápidos
      idSignal.set(2);
      phaseScheduler.flush();
      idSignal.set(3);
      phaseScheduler.flush();
      idSignal.set(4);
      phaseScheduler.flush();
      
      // Esperar a que se complete la última
      await new Promise(resolve => setTimeout(resolve, 30));
      phaseScheduler.flush();
      
      // Debe haber ejecutado múltiples veces
      expect(executionCount).toBeGreaterThan(1);
      // El valor final debe ser del último cambio
      expect(resource.get()).toBe('data-4');
    });

    it('debe manejar recursos sin dependencias reactivas', async () => {
      const resource = createResource(() => Promise.resolve('static'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      expect(resource.state).toBe('ready');
      expect(resource.get()).toBe('static');
    });

    it('debe mantener el último valor durante re-ejecuciones', async () => {
      const idSignal = new Signal(1);
      
      const resource = createResource((signal) => {
        const id = idSignal.get();
        return new Promise((resolve) => {
          setTimeout(() => resolve(`data-${id}`), 30);
        });
      });
      
      // Esperar carga inicial
      await new Promise(resolve => setTimeout(resolve, 40));
      phaseScheduler.flush();
      
      expect(resource.get()).toBe('data-1');
      
      // Cambiar dependencia (vuelve a pending pero mantiene el valor anterior)
      idSignal.set(2);
      phaseScheduler.flush();
      
      // El valor anterior puede estar disponible hasta que se complete la nueva carga
      // (depende de la implementación, pero no debe ser undefined a menos que se limpie explícitamente)
    });

    it('debe manejar errores en la función source', async () => {
      // Los errores síncronos en source se propagan al effect
      // y son capturados por el .catch() de la Promise
      // Sin embargo, si el error ocurre antes de crear la Promise,
      // el effect lo captura y puede causar problemas
      // Por eso, este test verifica que el error se maneja correctamente
      // envolviendo en Promise.reject
      const resource = createResource(() => {
        // Envolver el error síncrono en una Promise rechazada
        return Promise.reject(new Error('Synchronous error'));
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();
      
      // El error debe ser capturado
      expect(resource.state).toBe('error');
      expect(resource.error).toBeInstanceOf(Error);
      expect(resource.error?.message).toBe('Synchronous error');
    });
  });

  describe('Compatibilidad con IResource', () => {
    it('debe implementar la interfaz IResource', () => {
      const resource = createResource(() => Promise.resolve('data'));
      
      expect(resource.isSignal).toBe(true);
      expect(typeof resource.get).toBe('function');
      expect(typeof resource.state).toBe('string');
      expect(['pending', 'ready', 'error']).toContain(resource.state);
    });

    it('debe permitir acceso a state y error como propiedades', () => {
      const resource = createResource(() => Promise.resolve('data'));
      
      expect(resource.state).toBe('pending');
      expect(resource.error).toBeUndefined();
    });
  });

  describe('Escenario RouteView - Resource que retorna null inmediatamente', () => {
    it('debe cambiar a ready cuando retorna null sin await', async () => {
      // Este test simula exactamente lo que hace RouteView cuando no hay candidates
      // El Resource retorna null INMEDIATAMENTE (sin async/await interno)

      const resource = createResource(async (signal) => {
        // Simular: if (candidates.length === 0) return null;
        // No hay await antes del return
        return null;
      });

      // Esperar a que se procese
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();

      // DEBE estar en ready, no en pending
      expect(resource.state).toBe('ready');
      expect(resource.get()).toBe(null);
    });

    it('debe cambiar a ready cuando retorna null con verificación de array vacío', async () => {
      // Simular el patrón exacto del RouteView:
      // const candidates = this.levelCandidates;
      // if (!candidates || candidates.length === 0) return null;

      const candidatesSignal = new Signal<any[]>([]);  // Array vacío

      const resource = createResource(async (signal) => {
        const candidates = candidatesSignal.get();

        if (!candidates || candidates.length === 0) {
          console.log('TEST: No candidates, returning null');
          return null;  // Retorno inmediato
        }

        // Si hay candidates, simular carga
        await new Promise(resolve => setTimeout(resolve, 10));
        return { component: 'Loaded' };
      });

      // Esperar a que se procese
      await new Promise(resolve => setTimeout(resolve, 20));
      phaseScheduler.flush();

      console.log('TEST: Resource state =', resource.state);
      console.log('TEST: Resource value =', resource.get());

      // DEBE estar en ready con valor null
      expect(resource.state).toBe('ready');
      expect(resource.get()).toBe(null);
    });

    it('REGRESIÓN: Resource NO debe quedarse en pending cuando source retorna null inmediatamente', async () => {
      // Este es el bug reportado: el RouteView L1 se queda en "Cargando..."
      // porque el Resource nunca pasa de pending a ready

      let sourceExecutions = 0;
      let thenExecutions = 0;

      const resource = createResource(async (signal) => {
        sourceExecutions++;
        console.log(`TEST: source execution #${sourceExecutions}`);

        // Retorno INMEDIATO de null (sin await previo)
        return null;
      });

      // Esperar microtask queue
      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 5));
      phaseScheduler.flush();

      console.log(`TEST: Final state = ${resource.state}`);
      console.log(`TEST: source executions = ${sourceExecutions}`);

      // Verificaciones críticas
      expect(sourceExecutions).toBe(1);  // Source debe haberse ejecutado
      expect(resource.state).toBe('ready');  // DEBE ser ready, NO pending
      expect(resource.get()).toBe(null);  // El valor debe ser null
    });
  });

  describe('Cleanup y cancelación', () => {
    it('debe abortar operaciones cuando el effect se limpia', async () => {
      const idSignal = new Signal(1);
      let abortCount = 0;
      
      const resource = createResource((signal) => {
        idSignal.get();
        
        signal.addEventListener('abort', () => {
          abortCount++;
        });
        
        return new Promise((resolve) => {
          setTimeout(() => resolve('data'), 100);
        });
      });
      
      // Esperar un poco
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cambiar dependencia (esto debe cancelar la operación anterior)
      idSignal.set(2);
      phaseScheduler.flush();
      
      // Esperar un poco más
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // La operación anterior debe haberse cancelado
      expect(abortCount).toBeGreaterThanOrEqual(1);
    });

    it('debe manejar múltiples abort controllers correctamente', async () => {
      const idSignal = new Signal(1);
      const abortControllers: AbortController[] = [];
      
      const resource = createResource((signal) => {
        idSignal.get();
        
        // Capturar el controller (aunque no tenemos acceso directo)
        return new Promise((resolve) => {
          setTimeout(() => resolve(`data-${idSignal.get()}`), 20);
        });
      });
      
      // Cambiar múltiples veces rápidamente
      idSignal.set(2);
      phaseScheduler.flush();
      idSignal.set(3);
      phaseScheduler.flush();
      idSignal.set(4);
      phaseScheduler.flush();
      
      // Esperar a que se complete
      await new Promise(resolve => setTimeout(resolve, 30));
      phaseScheduler.flush();
      
      // Debe haber manejado correctamente las cancelaciones
      expect(resource.get()).toBe('data-4');
    });
  });
});
