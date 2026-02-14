import { Router } from './router/router';
import { Trie } from './router/trie';
import { PolicyEvaluator } from './router/policy-evaluator';
import { EventEmitter } from './events-handler/event-emitter.service';

/**
 * Core framework services.
 * Include these in your root component's services array.
 *
 * @example
 * ```typescript
 * import { BaseComponent, Component, core, RouteView } from 'signalsframework';
 *
 * @Component({
 *   services: [...core, AuthService, MyPolicy]
 * })
 * export class App extends BaseComponent {
 *   view() {
 *     return <RouteView />;
 *   }
 * }
 * ```
 */
export const core = [Router, Trie, PolicyEvaluator, EventEmitter];
