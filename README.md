# Signals Framework

> *Signals Framework vuelve a simplificar el desarrollo web.*

## 📚 Documentación

Antes de comenzar, te recomendamos leer nuestra [Filosofía](./docs/filosofia.md) para entender los principios y decisiones de diseño que guían Signals Framework.

---

## Índice de Features

### Componentes

| Feature | Description |
|---------|-------------|
| [BaseComponent](./docs/base-component.md) | Clase base para todos los componentes del framework |
| [Método `view()`](./docs/base-component.md#método-view) | Método principal de renderizado JSX |
| [Hook `onInit()`](./docs/base-component.md#hook-oninit) | Hook de inicialización del componente |
| [Hook `onConnected()`](./docs/base-component.md#hook-onconnected) | Hook cuando el componente se conecta al DOM |
| [Hook `onDisconnected()`](./docs/base-component.md#hook-ondisconnected) | Hook cuando el componente se desconecta del DOM |
| [Decorador `@Prop`](./docs/base-component.md#decorador-prop) | Define propiedades reactivas del componente |
| [Decorador `@Component`](./docs/base-component.md#decorador-component-con-estilos) | Registra el componente y asocia estilos |

### Behaviors

| Feature | Description |
|---------|-------------|
| [Decorador `@Behavior`](./docs/behaviors.md#decorador-behavior) | Registra una clase como Behavior reutilizable |
| [Decorador `@Host` (Behaviors)](./docs/behaviors.md#decorador-host) | Marca el campo donde inyectar el elemento DOM |
| [Decorador `@Prop` (Behaviors)](./docs/behaviors.md#decorador-prop-en-behaviors) | Define propiedades del Behavior desde JSX |
| [Hook `onInit()` (Behaviors)](./docs/behaviors.md#hook-oninit) | Hook de inicialización del Behavior |
| [Hook `onDestroy()` (Behaviors)](./docs/behaviors.md#hook-ondestroy) | Hook de limpieza cuando el elemento se desconecta |
| [Composición de Behaviors](./docs/behaviors.md#múltiples-behaviors) | Múltiples Behaviors en un mismo elemento |

### CSS in JS

| Feature | Description |
|---------|-------------|
| [BaseStyleSheet](./docs/base-style-sheet.md) | Clase base para definir estilos reactivos |
| [Decorador `@Rule`](./docs/base-style-sheet.md#decorador-rule) | Define reglas CSS reactivas con selectores |
| [Decorador `@UseStyles`](./docs/base-style-sheet.md#decorador-usestyles) | Asocia estilos a un componente |
| [Estilos locales](./docs/base-style-sheet.md#estilos-locales) | Estilos que solo se aplican al componente |
| [Decorador `@Shared`](./docs/base-style-sheet.md#decorador-shared) | Estilos compartidos globalmente entre componentes |
| [Decorador `@ForDocument`](./docs/base-style-sheet.md#decorador-fordocument) | Estilos aplicados al documento completo |
| [Decorador `@Host`](./docs/base-style-sheet.md#decorador-host) | Accede al componente host desde los estilos |
| [Decorador `@MediaQuery`](./docs/base-style-sheet.md#decorador-mediaquery) | Media queries reactivas |
| [Decorador `@Keyframes`](./docs/base-style-sheet.md#decorador-keyframes) | Define animaciones con keyframes |
| [Interface `CSSProperties`](./docs/base-style-sheet.md#interface-cssproperties) | Tipo TypeScript para propiedades CSS |
| [Decorador `@WindowSize`](./docs/base-style-sheet.md#decorador-windowsize) | Tamaño de ventana reactivo |
| [Decorador `@WindowWidth`](./docs/base-style-sheet.md#decorador-windowwidth) | Ancho de ventana reactivo |
| [Decorador `@WindowHeight`](./docs/base-style-sheet.md#decorador-windowheight) | Alto de ventana reactivo |
| [Decorador `@ScrollPosition`](./docs/base-style-sheet.md#decorador-scrollposition) | Posición de scroll reactiva |
| [Decorador `@ScrollXY`](./docs/base-style-sheet.md#decorador-scrollxy) | Posición de scroll X e Y reactiva |
| [Decorador `@MousePosition`](./docs/base-style-sheet.md#decorador-mouseposition) | Posición del mouse reactiva |
| [Decorador `@MouseX`](./docs/base-style-sheet.md#decorador-mousex) | Posición X del mouse reactiva |
| [Decorador `@MouseY`](./docs/base-style-sheet.md#decorador-mousey) | Posición Y del mouse reactiva |
| [Decorador `@DarkMode`](./docs/base-style-sheet.md#decorador-darkmode) | Preferencia de tema oscuro reactiva |
| [Decorador `@ReducedMotion`](./docs/base-style-sheet.md#decorador-reducedmotion) | Preferencia de movimiento reducido reactiva |
| [Decorador `@NetworkStatus`](./docs/base-style-sheet.md#decorador-networkstatus) | Estado de conexión de red reactivo |
| [Decorador `@DeviceOrientation`](./docs/base-style-sheet.md#decorador-deviceorientation) | Orientación del dispositivo reactiva |
| [Decorador `@PageVisibility`](./docs/base-style-sheet.md#decorador-pagevisibility) | Visibilidad de la página reactiva |
| [Decorador `@KeyPressed`](./docs/base-style-sheet.md#decorador-keypressed) | Tecla presionada reactiva |
| [Decorador `@ModifierKeys`](./docs/base-style-sheet.md#decorador-modifierkeys) | Teclas modificadoras reactivas |
| [Decorador `@WindowFocus`](./docs/base-style-sheet.md#decorador-windowfocus) | Estado de foco de ventana reactivo |
| [Decorador `@TextSelection`](./docs/base-style-sheet.md#decorador-textselection) | Estado de selección de texto reactivo |
| [Decorador `@FrameRate`](./docs/base-style-sheet.md#decorador-framerate) | Tasa de frames reactiva |

### Signals

| Feature | Description |
|---------|-------------|
| [Decorador `@State`](./docs/state.md) | Crea estado reactivo local con reactividad granular |
| [Decorador `@Computed`](./docs/computed.md) | Valores computados reactivos |
| [Decorador `@Effect`](./docs/effect.md) | Efectos secundarios reactivos |
| [Decorador `@Resource`](./docs/resource.md) | Recursos asíncronos reactivos |
| [Decorador `@Ctx`](./docs/ctx.md) | Contextos reactivos entre componentes |

### Router

| Feature | Description |
|---------|-------------|
| [Decorador `@Route`](./docs/router.md#decorador-route) | Define una ruta para un componente |
| [Componente `RouteView`](./docs/router.md#componente-routeview) | Renderiza el componente de la ruta actual |
| [Decorador `@Param`](./docs/router.md#decorador-param) | Parámetro de ruta individual reactivo |
| [Decorador `@Params`](./docs/router.md#decorador-params) | Todos los parámetros de ruta como objeto |
| [Decorador `@Query`](./docs/router.md#decorador-query) | Query parameter individual reactivo |
| [Decorador `@QueryParams`](./docs/router.md#decorador-queryparams) | Todos los query parameters como objeto |
| [Decorador `@RouteMetadata`](./docs/router.md#decorador-routemetadata) | Accede a metadata de la ruta |
| [Router Service](./docs/router.md#router-service) | Servicio para navegación programática |
| [Configuración de rutas](./docs/router.md#configuración-de-rutas) | Metadata, policies y slots en `RouteConfig` |
| [Decorador `@Allow`](./docs/router.md#decorador-allow) | Política que permite la navegación |
| [Decorador `@Block`](./docs/router.md#decorador-block) | Política que bloquea la navegación |
| [Decorador `@Redirect`](./docs/router.md#decorador-redirect) | Política que redirige la navegación |
| [Decorador `@Skip`](./docs/router.md#decorador-skip) | Política que se abstiene de decidir |

### Dependency Injection

| Feature | Description |
|---------|-------------|
| [Decorador `@Service`](./docs/di.md#decorador-service) | Marca una clase como servicio inyectable |
| [Decorador `@Inject`](./docs/di.md#decorador-inject) | Inyecta una dependencia en un servicio o componente |
| [Función `bootstrap()`](./docs/di.md#función-bootstrap) | Inicializa todos los servicios en orden de dependencias |
| [Interfaz `LifeCycle`](./docs/di.md#interfaz-lifecycle) | Interfaz para servicios con inicialización asíncrona |

### Data Management

| Feature | Description |
|---------|-------------|
| [Decorador `@Model`](./docs/data-management.md#decorador-model) | Marca una clase como modelo de datos |
| [Decorador `@Id`](./docs/data-management.md#decorador-id) | Marca el campo identificador único del modelo |
| [Decorador `@Prop` (modelos)](./docs/data-management.md#decorador-prop-modelos) | Propiedades reactivas para modelos de datos |
| [EntityStore](./docs/data-management.md#entitystore) | Almacén normalizado de entidades reactivo |
| [Decorador `@Consume`](./docs/data-management.md#decorador-consume) | Convierte JSON a modelos y los almacena automáticamente |
| [Decorador `@Cache`](./docs/data-management.md#decorador-cache) | Define el provider de cache para un método |
| [Decorador `@TTL`](./docs/data-management.md#decorador-ttl) | Time-to-live para cache de métodos |
| [Decorador `@CacheTags`](./docs/data-management.md#decorador-cachetags) | Asigna tags a cache entries para invalidación granular |
| [Decorador `@CacheUpdate`](./docs/data-management.md#decorador-cacheupdate) | Actualiza cache después de ejecutar método |
| [Decorador `@CacheInvalidate`](./docs/data-management.md#decorador-cacheinvalidate) | Invalida cache por tags después de ejecutar método |
| [MemoryCache](./docs/data-management.md#memorycache) | Provider de cache en memoria |
| [LocalStorageCache](./docs/data-management.md#localstoragecache) | Provider de cache en localStorage |
| [SessionStorageCache](./docs/data-management.md#sessionstoragecache) | Provider de cache en sessionStorage |

### Event Handling

| Feature | Description |
|---------|-------------|
| [Decorador `@Emit`](./docs/event-handling.md#decorador-emit) | Emite eventos CustomEvent desde componentes |
| [Decorador `@On`](./docs/event-handling.md#decorador-on) | Registra handlers de eventos en servicios |
| [EventEmitter Service](./docs/event-handling.md#eventemitter-service) | Servicio para emitir eventos globalmente |