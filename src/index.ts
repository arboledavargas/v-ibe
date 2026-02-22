declare global {
  namespace JSX {
    // Nota: Deberás asegurarte de que `jsx` y `Fragment` estén disponibles
    // si usas `ReturnType<typeof jsx>`.
    type Element = any; // Simplificamos aquí si es un problema de importación

    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export { BaseComponent } from "./components/base-component";
export { Component } from "./components/decorators/component";
export { Prop } from "./components/decorators/prop";
export { Param, Params, Query, QueryParams, Allow, Block, Redirect, Skip, getPolicyRules } from "./router/decorators";
export type { ParamMetadata, QueryParamMetadata, RouteConfig, PolicyDecisionType, PolicyRule, PolicyDecision } from "./router/decorators";
export { State } from "./reactivity/decorators/state";
export { Effect } from "./reactivity/decorators/effect";
export { Computed } from "./reactivity/decorators/computed";
export { Resource } from "./reactivity/decorators/resource";
export { Store } from "./reactivity/decorators/store";
export { RouteMetadata } from "./router/decorators/route-metadata";
export type { IResource } from "./reactivity/signals/resource";
export { Ctx } from "./reactivity/decorators/ctx";
export { collection, isObservableArray, isCollection, isReactiveArrayLike, unwrapReactiveArray } from "./reactivity/signals/reactive-array";
export type { ObservableArray, Collection } from "./reactivity/signals/reactive-array";
export { Emit } from "./events-handler/decorators/emit";
export { BaseStyleSheet } from "./styles/base-style-sheet";
export { Style } from "./styles/decorators/style";
export { Service } from "./DI/decorators/service";
export { Inject } from "./DI/decorators/inject";
export type { LifeCycle } from "./DI/lifecycle";
export { DIContainer } from "./DI/di-container";
export { ScopedContainer } from "./DI/scoped-container";
export { registerServiceMetadata, getServiceMetadata, getAllServiceMetadata, clearServiceMetadata } from "./DI/service-metadata";
export type { ServiceMetadata } from "./DI/service-metadata";
export { core } from "./core";
export { Rule } from "./styles/decorators/rule";
export type { CSSProperties } from "./styles/css-properties";
export { UseStyles } from "./styles/decorators/useStyles";
// Behaviors system
export { Behavior, Host, ComponentHost } from "./behaviors";
export { MediaQuery } from "./styles/decorators/factories";
export { Shared, ForDocument } from "./styles/decorators/scope";
export type { StyleScope } from "./styles/decorators/scope";
export { Keyframes } from "./styles/decorators/keyframes";
export type { KeyframesDefinition, KeyframeSelector } from "./styles/decorators/keyframes";
export { jsxContextualPlugin } from './vite-plugins/jsx-contextual';
export { jsxSignalsPlugin } from './vite-plugins/jsx-signals';
// Router exports commented out temporarily due to infinite loop issue
export { Router } from './router/router';
export { Route } from './router/decorators';
export { Trie } from './router/trie'
export { RouteView } from "./router/route-view";
export { Link } from './router/link.behavior';
export { Id, Model, Prop as Field, EntityStore, Consume, MemoryCache, LocalStorageCache, SessionStorageCache, Cache, TTL, CacheTags, CacheUpdate, CacheInvalidate } from './data-management'
export type { CacheProvider, CacheEntry, TagExtractor } from './data-management'

// Custom Components
export { For, Show } from './custom-components'
export type { ForProps, ShowProps } from './custom-components'
export { ReactiveArray } from './reactivity/signals/reactive-array'
