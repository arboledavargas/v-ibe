# Filosofía

> *Signals Framework vuelve a simplificar el desarrollo web.*

Signals Framework permite crear aplicaciones **declarativas, reactivas y estructuradas**, sin sacrificar rendimiento ni claridad.

Tomamos ideas probadas del ecosistema web moderno y las integramos de forma natural, coherente y predecible.

Cada decorador y primitiva es **auto-explicativa** y **componible**, como piezas de LEGO que encajan sin fricción.

Signals no intenta ser mágico.
Intenta ser **obvio**.

---

## Nuestro enfoque

### 1. Standards first

Creemos que la web ya es una plataforma poderosa.

Priorizamos **estándares nativos** antes que abstracciones propietarias, para reducir complejidad y maximizar interoperabilidad.

Signals Framework se apoya directamente en estándares como:

* Web Components
* Ciclos de vida nativos
* Slots nativos
* Scoped CSS real

No reimplementamos la plataforma.
**La usamos.**

---

### 2. Incremental computation

Creemos que la UI debe actualizarse de forma **precisa**, no masiva.

Adoptamos un modelo de **incremental computation**, donde cada cambio afecta únicamente lo que depende de él.

Signals es el mecanismo que permite este modelo, eliminando renders globales, reconciliación innecesaria y la necesidad de un Virtual DOM.

---

### 3. Multi-Paradigm Programming

Creemos que los sistemas grandes necesitan **estructura**, pero también **composición flexible**.

Signals Framework combina **Programación Orientada a Objetos** con **programación funcional**, siguiendo la misma filosofía que JavaScript y TypeScript:
objetos para modelar el dominio, funciones para expresar comportamiento.

Las clases definen límites claros, ciclos de vida y responsabilidades.
Las funciones y signals permiten composición, reactividad y simplicidad.

El resultado es un modelo híbrido donde la estructura no limita la flexibilidad, y la composición no destruye la claridad.

---

### 4. Simplified dependency injection

Creemos que la inyección de dependencias es fundamental para escalar aplicaciones, pero que su complejidad debe ser intencional.

Signals Framework adopta un enfoque de **dependency injection simplificado**, suficiente para estructurar sistemas complejos sin introducir fricción innecesaria.

Porque a veces, **menos es más**.

---

### 5. State-driven styling

Creemos que el estado no solo controla el comportamiento, sino también la presentación.

Signals Framework adopta un enfoque de **state-driven styling**, donde los estilos reaccionan al estado con la misma precisión que la UI.

CSS in JS es el mecanismo que permite integrar estado y diseño de forma directa y coherente.

---

### 6. Opinionated by design

Creemos que un framework debe tomar decisiones claras.

Signals Framework es **opinionated por diseño**: resolvemos los problemas estructurales de antemano y entregamos un sistema coherente, listo para usar.

Así puedes enfocarte en resolver problemas reales, no en decisiones repetidas.

---

### 7. Single integrated system

Creemos que una aplicación es más que una capa de UI.

Signals Framework ofrece un **sistema integrado**, donde las piezas centrales están diseñadas para trabajar juntas desde el inicio:

* Router
* Normalized data store
* Sistema de cache
* UI constraints resolver
* Game loop

Todo pensado para funcionar como un solo sistema, no como herramientas independientes ensambladas a la fuerza.
