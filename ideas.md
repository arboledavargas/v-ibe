# Bugs

#  Roadmap

- **Eventos sintéticos**
  - `onClick`, `onInput`, `onChange` etc.
  - Normalización cross-browser
  - Delegación de eventos eficiente

- [ ] Dependency injection de clases con @UseService()

- [ ] Decorador @Select(<css query>)

- [ ] @OnMount @OnDismount

- [ ] **Props especiales**
  - `className` → mapeo a `class`
  - `style` como objeto: `{ color: "red" }`
  - Normalización de props HTML

- [ ] **Mejoras de debugging**
  - Herramientas de desarrollo

- [ ] **Documentación y testing**
  - Ejemplos y tutoriales

- [ ] @Path()

- [ ] Navegación client-side
 - Interceptar clicks en <a>
 - Usar history.pushState / replaceState
 - Escuchar popstate
 - Re-renderizar en base a la nueva URL

- [ ] Implementar ruta comodín "*"

- [ ] componente 404


- [ ] Loaders / hooks de ruta
 - Funciones opcionales que se ejecutan antes de montar
 - Útiles para pre-cargar datos

[ ] Manejar boolean attributes como disabled, checked, required directamente

[ ] Soportar atributos con guion (data-id, aria-label, etc.)

[ ] Permitir nodos de texto puros como return “Hola” o return [“A”, “B”] sin wrappers extra

[ ] Implementar namespaces reales (xlink:href, svg:rect) con createElementNS

[ ] Serializar props objeto automáticamente en data-attributes (ejemplo:  → data-user=’{“id”:1}’)

[ ] componente
  <Async>
     <Pending> </Pending>
     <Resolve>{() => }</Resolve>
     <Error> </Error>
  </Async>

[ ] implementar el decorador @Animate, asi

@Animate
fall(dt: number) {
  return <style>
    :host {
      top: {this.y += this.velocity * dt};
      background: red;
    }
  </style>;
}

con el modelo Actor , registrando cada componente en un Actor Loop con request animation frame.


/articles/:articleid
/articles/article1
/files/*
/files/users/user1/prifile.pdf

@Wildcard
fileName: string; //users/user1/prifile.pdf

@Component
@UseStyles(MagneticButtonStyles)
class MagneticButton extends BaseComponent {
  onConnected() {
    this.styles.buttonX = this.getBoundingClientRect().left;
  }

  view() {
    return <button>Magnetic Button</button>;
  }
}

class MagneticButtonStyles extends BaseStyleSheet {
  @Host host!: MagneticButton;

  // Posición del mouse en toda la ventana
  @MouseX mouseX!: number;
  @MouseY mouseY!: number;

  @State buttonX = 0;

  // Distancia del mouse al centro del botón
  @Computed
  get distanceFromCenter(): number {
    const center = this.buttonX + 100;
    return Math.abs(this.mouseX - center);
  }

  // Velocidad del movimiento del mouse
  @Velocity
  mouseSpeed = () => this.mouseX;

  // Map: conversión lineal de distancia a escala
  @Map(0, 300, 1.5, 1.0)
  targetScale = () => this.distanceFromCenter;

  // Clamp: limita la escala entre valores seguros
  @Clamp(0.8, 2.0)
  clampedScale = () => this.targetScale;

  // Snap: pega a escala máxima cuando está muy cerca
  @Snap(
    () => this.clampedScale,
    () => 1.5,
    { threshold: 0.1, strength: 0.3 }
  )
  snappedScale = () => this.clampedScale;

  // Spring: anima la escala con física
  @Spring({ stiffness: 170, damping: 26 })
  scale = () => this.snappedScale;

  // Curve: cambios de color en múltiples puntos
  @Curve([
    { at: 0,   value: '#8b5cf6' },
    { at: 100, value: '#7c3aed' },
    { at: 200, value: '#6366f1' },
    { at: 300, value: '#4f46e5' }
  ])
  buttonColor = () => this.distanceFromCenter;

  // Ease: suaviza el color con curva
  @Ease({ duration: 200, curve: 'easeOut' })
  smoothColor = () => this.buttonColor;

  // Oscillate: pulso continuo para efecto de "respiración"
  @Oscillate({ frequency: 0.5, amplitude: 0.05 })
  breathe = () => 1.0;

  // Delay: posición retrasada para efecto de trail
  @Delay(80)
  trailingX = () => this.mouseX;

  // Map: velocidad a blur (motion blur effect)
  @Map(0, 2000, 0, 3)
  motionBlur = () => this.mouseSpeed;

  // Clamp: blur no puede ser negativo
  @Clamp(0, 3)
  safeBlur = () => this.motionBlur;

  // Wrap: rotación cíclica basada en posición X
  @Wrap(0, 360)
  rotation = () => this.mouseX / 2;

  // Inertia: el botón continúa moviéndose después del mouse
  @Inertia({ friction: 0.92 })
  inertialRotation = () => this.rotation;

  styles() {
    return (
      <style>
        {this.css('button', () => ({
          transform: `scale(${this.scale * this.breathe}) rotate(${this.inertialRotation}deg)`,
          background: this.smoothColor,
          filter: `blur(${this.safeBlur}px)`,
          padding: '12px 24px',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          cursor: 'pointer'
        }))}

        {this.css('button::after', () => ({
          content: '""',
          position: 'absolute',
          left: `${this.trailingX}px`,
          opacity: 0.3,
          pointerEvents: 'none'
        }))}
      </style>
    );
  }
}
