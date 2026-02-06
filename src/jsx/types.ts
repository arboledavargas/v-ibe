import { Signal } from "../reactivity/signals/signal";

// Base prop types
export type PropValue =
  | string
  | number
  | boolean
  | Function
  | Signal<any>
  | PropObject
  | PropArray
  | ClassNameProp
  | StyleProp
  | null
  | undefined;

// Object props (for style, data attributes, etc.)
export type PropObject = {
  [key: string]: string | number | boolean | null | undefined;
};

// Array props (for className arrays, etc.)
export type PropArray = (string | number | boolean | null | undefined)[];

// Specific prop types for better type safety
export type ClassNameProp =
  | string
  | string[]
  | { [className: string]: boolean | Signal<boolean> | (() => boolean) }
  | Signal<string | string[] | { [className: string]: boolean }>
  | (() => string | string[] | { [className: string]: boolean });

export type StyleProp =
  | string
  | { [property: string]: string | number | null | undefined }
  | Signal<string | { [property: string]: string | number | null | undefined }>
  | (() => string | { [property: string]: string | number | null | undefined });

// Event handler types
export type EventHandler<T = Event> = (event: T) => void;
export type CustomEventHandler<T = any> = (data: T) => void;

// Enhanced child types
export type ChildValue =
  | string
  | number
  | Element
  | Function
  | Signal<any>
  | ChildValue[]
  | null
  | undefined
  | boolean;

// Props interface for components
export interface ComponentProps {
  className?: ClassNameProp;
  style?: StyleProp;
  key?: string | number;

  // Event handlers
  onClick?: EventHandler<MouseEvent>;
  onInput?: EventHandler<InputEvent>;
  onChange?: EventHandler<Event>;
  onSubmit?: EventHandler<SubmitEvent>;

  // Custom event handlers (detected by on* pattern)
  [eventName: `on${string}`]:
    | CustomEventHandler<any>
    | EventHandler<any>
    | undefined;

  // Any other props
  [propName: string]: PropValue;
}

export const Fragment = Symbol.for("signalsframework.fragment");
