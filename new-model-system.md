1. implementa este archivo esta es una de las features mas importantes de mi framework.

```typescript
// src/behaviors/model.ts
import { Behavior, Host, Prop } from './decorators';
import { effect } from '../reactivity/signals/effect';
import { Signal } from '../reactivity/signals/signal';

/**
 * @Behavior Model
 * 
 * Two-way binding exclusivo para elementos de formulario nativos HTML5.
 * NO soporta componentes custom (BaseComponent) en esta versión.
 * 
 * Soporta: input[type=text|number|checkbox|radio|email|etc], select, textarea
 */
@Behavior
export class Model<T = any> {
  // Tipo estricto: solo elementos nativos de formulario
  @Host el!: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  
  @Prop() model!: Signal<T>;
  @Prop() parse?: (val: any) => T;
  @Prop() format?: (val: T) => string;
  
  private stopEffect?: () => void;
  private listeners: Array<() => void> = [];

  onInit(): void {
    // Seguridad: Validar que efectivamente sea un elemento nativo
    if (!(this.el instanceof HTMLInputElement) && 
        !(this.el instanceof HTMLSelectElement) && 
        !(this.el instanceof HTMLTextAreaElement)) {
      console.error(
        '[Model] Este behavior solo soporta elementos nativos (input, select, textarea). ' +
        'Se intentó aplicar en:', this.el
      );
      return;
    }

    const el = this.el;
    const signal = this.model;
    
    // Detectar tipo específico
    const isCheckbox = el instanceof HTMLInputElement && el.type === 'checkbox';
    const isRadio = el instanceof HTMLInputElement && el.type === 'radio';
    const isSelectMultiple = el instanceof HTMLSelectElement && el.multiple;

    // 1. SYNC INICIAL: Signal -> DOM (sin effect aún, para evitar flash)
    this.syncToDOM(signal.get());

    // 2. SYNC CONTINUO: Signal -> DOM
    // Se activa cuando el signal cambia externamente (ej: botón "limpiar")
    this.stopEffect = effect(() => {
      const value = signal.get();
      this.syncToDOM(value);
    });

    // 3. SYNC USUARIO: DOM -> Signal
    // Usar 'change' para checkbox/radio/select, 'input' para texto
    const eventType = isCheckbox || isRadio || (el instanceof HTMLSelectElement) 
      ? 'change' 
      : 'input';

    const handler = () => {
      let rawValue: any;

      if (isCheckbox) {
        rawValue = (el as HTMLInputElement).checked;
      } 
      else if (isSelectMultiple) {
        rawValue = Array.from((el as HTMLSelectElement).selectedOptions)
          .map(opt => opt.value);
      } 
      else {
        rawValue = el.value;
      }

      // Aplicar transformación si existe
      const parsed = this.parse ? this.parse(rawValue) : rawValue;
      
      // Solo actualizar signal si realmente cambió (previene loops)
      const current = signal.get();
      if (current !== parsed && !(Number.isNaN(current) && Number.isNaN(parsed))) {
        signal.set(parsed);
      }
    };

    el.addEventListener(eventType, handler);
    this.listeners.push(() => el.removeEventListener(eventType, handler));
  }

  /**
   * Sincroniza valor de Signal al DOM
   */
  private syncToDOM(value: T): void {
    const el = this.el;
    
    // Casos especiales por tipo de input
    const isCheckbox = el instanceof HTMLInputElement && el.type === 'checkbox';
    const isRadio = el instanceof HTMLInputElement && el.type === 'radio';
    const isSelectMultiple = el instanceof HTMLSelectElement && el.multiple;

    if (isCheckbox) {
      const checked = Boolean(value);
      if (el.checked !== checked) {
        el.checked = checked;
      }
      return;
    }

    if (isRadio) {
      // Marcar solo si el value coincide
      const shouldCheck = String(value) === el.value;
      if (el.checked !== shouldCheck) {
        el.checked = shouldCheck;
      }
      return;
    }

    if (isSelectMultiple) {
      const values = (Array.isArray(value) ? value : [value]).map(String);
      Array.from((el as HTMLSelectElement).options).forEach(opt => {
        opt.selected = values.includes(opt.value);
      });
      return;
    }

    // Caso default: input text, number, email, textarea, select simple
    const formatted = this.format ? this.format(value) : String(value ?? '');
    
    if (el.value !== formatted) {
      // Preservar posición del cursor para inputs de texto
      const isTextLike = el.type === 'text' || 
                         el.type === 'search' || 
                         el.type === 'password' ||
                         el instanceof HTMLTextAreaElement;
      
      let selectionStart: number | null = null;
      let selectionEnd: number | null = null;
      
      if (isTextLike && document.activeElement === el) {
        selectionStart = (el as HTMLInputElement).selectionStart;
        selectionEnd = (el as HTMLInputElement).selectionEnd;
      }

      el.value = formatted;

      // Restaurar cursor si el formateo no cambió la longitud (ej: cambio externo)
      if (isTextLike && selectionStart !== null && formatted.length === el.value.length) {
        (el as HTMLInputElement).setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }

  onDestroy(): void {
    // Limpiar effect de reactividad
    if (this.stopEffect) {
      this.stopEffect();
    }
    // Desuscribir eventos del DOM
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
  }
}

```

2. ahora para que esta feature funcione hay que modificar el plugin jsx-signals para que no envuelva en arrow funcions las propiedades model, y que agregue el simbolo $ al inicio de el nombre de la signal, para que se pase la signal completa y no solo el valor , (ver el decorador @State para entender el porque de esto)

3. como resultado final mi framework soportara lo siguiente
```jsx

<input type="text" model={this.name} />
<input type="checkbox" model={this.active} />
<select model={this.choice}><option>...</option></select>
```
