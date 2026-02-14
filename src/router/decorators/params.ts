import { Constructor } from "../../DI/types";
import { Router } from "../router";

// Metadata for parameter decorators
export interface ParamMetadata {
  paramName: string;
  propertyKey: string;
  target: Constructor;
}

export interface QueryParamMetadata {
  queryName: string;
  propertyKey: string;
  target: Constructor;
}

// Storage for parameter metadata
const PARAM_METADATA_KEY = Symbol('paramMetadata');
const QUERY_PARAM_METADATA_KEY = Symbol('queryParamMetadata');

/**
 * Decorator for individual route parameters
 * @param paramName The name of the route parameter (e.g., 'id' for '/users/:id')
 */
export function Param(paramName: string) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== "field") {
      throw new Error("@Param can only be used on fields");
    }

    context.addInitializer(function (this: any) {
      const ctor = this.constructor as Constructor;

      const metadata: ParamMetadata = {
        paramName,
        propertyKey: context.name as string,
        target: ctor
      };

      // Store metadata on the constructor
      if (!(ctor as any)[PARAM_METADATA_KEY]) {
        (ctor as any)[PARAM_METADATA_KEY] = [];
      }
      (ctor as any)[PARAM_METADATA_KEY].push(metadata);

      // Define the property with a getter that retrieves the parameter value
      Object.defineProperty(this, context.name, {
        enumerable: true,
        configurable: true,
        get() {
          const router = (this as any).__container.get(Router);
          return router.$params[paramName] || null;
        }
      });
    });
  };
}

/**
 * Decorator for all route parameters as an object
 */
export function Params() {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== "field") {
      throw new Error("@Params can only be used on fields");
    }

    context.addInitializer(function (this: any) {
      // Define the property with a getter that retrieves all parameters
      Object.defineProperty(this, context.name, {
        enumerable: true,
        configurable: true,
        get() {
          const router = (this as any).__container.get(Router);
          return router.$params;
        }
      });
    });
  };
}

/**
 * Decorator for individual query parameters
 * @param queryName The name of the query parameter (e.g., 'page' for '?page=1')
 */
export function Query<This extends object>(queryName: string) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== "field") {
      throw new Error("@Query can only be used on fields");
    }

    context.addInitializer(function (this: any) {
      const ctor = this.constructor as Constructor;

      const metadata: QueryParamMetadata = {
        queryName,
        propertyKey: context.name as string,
        target: ctor
      };

      // Store metadata on the constructor
      if (!(ctor as any)[QUERY_PARAM_METADATA_KEY]) {
        (ctor as any)[QUERY_PARAM_METADATA_KEY] = [];
      }
      (ctor as any)[QUERY_PARAM_METADATA_KEY].push(metadata);

      // Define the property with a getter that retrieves the query parameter value
      Object.defineProperty(this, context.name, {
        enumerable: true,
        configurable: true,
        get() {
          const router = (this as any).__container.get(Router);
          return router.$queryParams[queryName] || null;
        }
      });
    });
  };
}

/**
 * Decorator for all query parameters as an object
 */
export function QueryParams() {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== "field") {
      throw new Error("@QueryParams can only be used on fields");
    }

    context.addInitializer(function (this: any) {
      // Define the property with a getter that retrieves all query parameters
      Object.defineProperty(this, context.name, {
        enumerable: true,
        configurable: true,
        get() {
          const router = (this as any).__container.get(Router);
          return router.$queryParams;
        }
      });
    });
  };
}

// Helper functions to get metadata
export function getParamMetadata(target: Constructor): ParamMetadata[] {
  return (target as any)[PARAM_METADATA_KEY] || [];
}

export function getQueryParamMetadata(target: Constructor): QueryParamMetadata[] {
  return (target as any)[QUERY_PARAM_METADATA_KEY] || [];
}
