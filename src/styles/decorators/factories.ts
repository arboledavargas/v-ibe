import { createEventDecorator } from "../../reactivity/decorators/create-event-decorator";
import { eventListener } from "../../reactivity/signals/event";
import { Signal } from "../../reactivity/signals/signal";

// === VIEWPORT & LAYOUT ===

/**
 * Reactive media query that updates when viewport conditions change
 * @param queryString CSS media query string
 * @example @MediaQuery('(max-width: 768px)') isMobile!: boolean;
 */
const createMediaQuerySignal = (queryString: string) =>
  eventListener(
    window.matchMedia(queryString),
    "change",
    () => window.matchMedia(queryString).matches,
  );

/**
 * Reactive window dimensions that update on resize
 * @example @WindowSize windowSize!: { width: number; height: number };
 */
const createWindowSizeSignal = () =>
  eventListener(window, "resize", () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

/**
 * Reactive window width only
 * @example @WindowWidth width!: number;
 */
const createWindowWidthSignal = () =>
  eventListener(window, "resize", () => window.innerWidth);

const createWindowHeightSignal = () =>
  eventListener(window, "resize", () => window.innerHeight);

const createScrollPositionSignal = () =>
  eventListener(window, "scroll", () => window.scrollY);

const createScrollXYSignal = () =>
  eventListener(window, "scroll", () => ({
    x: window.scrollX,
    y: window.scrollY,
  }));

// === DEVICE & SYSTEM ===

const createNetworkStatusSignal = () =>
  eventListener(window, "online", () => navigator.onLine);

const createDeviceOrientationSignal = () =>
  eventListener(
    window,
    "orientationchange",
    () => screen.orientation?.type || "unknown",
  );

const createPageVisibilitySignal = () =>
  eventListener(
    document,
    "visibilitychange",
    () => document.visibilityState === "visible",
  );

const createReducedMotionSignal = () =>
  eventListener(
    window.matchMedia("(prefers-reduced-motion: reduce)"),
    "change",
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

const createDarkModeSignal = () =>
  eventListener(
    window.matchMedia("(prefers-color-scheme: dark)"),
    "change",
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

// === MOUSE & INTERACTION ===

const createMousePositionSignal = () =>
  eventListener(document, "mousemove", (event: MouseEvent) => ({
    x: event.clientX,
    y: event.clientY,
  }));

const createMouseXSignal = () =>
  eventListener(document, "mousemove", (event: MouseEvent) => event.clientX);

const createMouseYSignal = () =>
  eventListener(document, "mousemove", (event: MouseEvent) => event.clientY);

// === KEYBOARD ===

const createKeyPressedSignal = (key: string) => {
  let isPressed = false;

  const keydownListener = eventListener(
    document,
    "keydown",
    (event: KeyboardEvent) => {
      if (event.key === key) {
        isPressed = true;
        return true;
      }
      return isPressed;
    },
  );

  const keyupListener = eventListener(
    document,
    "keyup",
    (event: KeyboardEvent) => {
      if (event.key === key) {
        isPressed = false;
        return false;
      }
      return isPressed;
    },
  );

  // Return a combined signal - this would need special handling in createEventDecorator
  return keydownListener;
};

const createModifierKeysSignal = () =>
  eventListener(document, "keydown", (event: KeyboardEvent) => ({
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
    meta: event.metaKey,
  }));

// === FOCUS & SELECTION ===

const createWindowFocusSignal = () =>
  eventListener(window, "focus", () => document.hasFocus());

const createTextSelectionSignal = () =>
  eventListener(
    document,
    "selectionchange",
    () => window?.getSelection()?.toString().length ?? 0 > 0,
  );

// === PERFORMANCE ===

const createFrameRateSignal = () => {
  let fps = 60;
  let lastTime = performance.now();
  let frameCount = 0;

  const updateFPS = () => {
    const now = performance.now();
    frameCount++;

    if (now - lastTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastTime));
      frameCount = 0;
      lastTime = now;
    }

    requestAnimationFrame(updateFPS);
    return fps;
  };

  requestAnimationFrame(updateFPS);

  return eventListener(window, "focus", () => fps); // Dummy event for the structure
};

// === FACTORY FUNCTIONS ===

/**
 * Creates a decorator for custom DOM events
 * @param eventName Custom event name
 * @example const UserAction = CustomEvent('user-action');
 *          @UserAction userActionFired!: boolean;
 */
const CustomEvent = (eventName: string) => {
  const createCustomEventSignal = () =>
    eventListener(document, eventName, () => true);
  return createEventDecorator(createCustomEventSignal);
};

/**
 * Creates a decorator that tracks if a specific element is in viewport
 * @param selector CSS selector for the element to observe
 * @example const HeaderVisible = ElementInView('.header');
 *          @HeaderVisible headerInView!: boolean;
 */
const ElementInView = (selector: string) => {
  const createIntersectionSignal = () => {
    const signal = new Signal(false);

    const observer = new IntersectionObserver((entries) => {
      const isInView = entries[0]?.isIntersecting || false;
      signal.set(isInView);
    });

    const element = document.querySelector(selector);
    if (element) {
      observer.observe(element);
    }

    return {
      signal,
      cleanup: () => observer.disconnect(),
    };
  };

  return createEventDecorator(createIntersectionSignal);
};

// === EXPORTS ===

// Viewport & Layout
export const MediaQuery = createEventDecorator(createMediaQuerySignal);
export const WindowSize = createEventDecorator(createWindowSizeSignal);
export const WindowWidth = createEventDecorator(createWindowWidthSignal);
export const WindowHeight = createEventDecorator(createWindowHeightSignal);
export const ScrollPosition = createEventDecorator(createScrollPositionSignal);
export const ScrollXY = createEventDecorator(createScrollXYSignal);

// Device & System
export const NetworkStatus = createEventDecorator(createNetworkStatusSignal);
export const DeviceOrientation = createEventDecorator(
  createDeviceOrientationSignal,
);
export const PageVisibility = createEventDecorator(createPageVisibilitySignal);
export const ReducedMotion = createEventDecorator(createReducedMotionSignal);
export const DarkMode = createEventDecorator(createDarkModeSignal);

// Mouse & Interaction
export const MousePosition = createEventDecorator(createMousePositionSignal);
export const MouseX = createEventDecorator(createMouseXSignal);
export const MouseY = createEventDecorator(createMouseYSignal);

// Keyboard
export const KeyPressed = createEventDecorator(createKeyPressedSignal);
export const ModifierKeys = createEventDecorator(createModifierKeysSignal);

// Focus & Selection
export const WindowFocus = createEventDecorator(createWindowFocusSignal);
export const TextSelection = createEventDecorator(createTextSelectionSignal);

// Performance
export const FrameRate = createEventDecorator(createFrameRateSignal);

// Factory Functions
export { CustomEvent, ElementInView };
