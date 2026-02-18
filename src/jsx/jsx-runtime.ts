/**
 * ⚠️ IMPORTANT: These functions should NEVER be called at runtime.
 * 
 * The jsxContextualPlugin transforms all jsx() calls to this.jsx()
 * during compilation. These exports exist ONLY for TypeScript type-checking.
 * 
 * If you see errors from these functions, it means:
 * 1. jsxContextualPlugin is not enabled in your vite.config
 * 2. You're not using Vite (unsupported)
 */

import { Fragment } from "./types";

function jsx(..._args: any[]): any {
  throw new Error(
    '[v-ibe] jsx() should never be called directly. ' +
    'Ensure jsxContextualPlugin is enabled in your vite.config.ts'
  );
}

export { Fragment, jsx, jsx as jsxs };
