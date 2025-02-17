/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { expectContext } from "@/utils/expectContext";
import { once } from "lodash";
import { getErrorMessage, getRootCause } from "./errorHelpers";
import { CONTEXT_INVALIDATED_ERROR } from "@/errors/knownErrorMessages";

/**
 * Notification id to avoid displaying multiple notifications at once.
 */
const CONTEXT_INVALIDATED_NOTIFICATION_ID = "context-invalidated";

const CONTEXT_INVALIDATED_NOTIFICATION_DURATION_MS = 20_000;

/**
 * Display a notification when the background page unloads/reloads because at this point
 * all communication becomes impossible.
 */
export async function notifyContextInvalidated(): Promise<void> {
  // Lazily import React component. Also avoids a `webext-messenger` transitive dependency.
  // https://github.com/pixiebrix/pixiebrix-extension/pull/6234
  // https://github.com/pixiebrix/pixiebrix-extension/issues/4058#issuecomment-1217391772
  const { default: notify } = await import(
    /* webpackChunkName: "notify" */ "@/utils/notify"
  );

  notify.error({
    id: CONTEXT_INVALIDATED_NOTIFICATION_ID,
    message: "PixieBrix was updated or restarted. Reload the page to continue",
    reportError: false, // It cannot report it because its background page no longer exists
    autoDismissTimeMs: CONTEXT_INVALIDATED_NOTIFICATION_DURATION_MS,
  });
}

/** Detects whether an error is a fatal context invalidation */
export function isContextInvalidatedError(possibleError: unknown): boolean {
  // Do not use `wasContextInvalidated` in here because this function must return `true`
  // only if the specific error was an invalidation error.
  return (
    getErrorMessage(getRootCause(possibleError)) === CONTEXT_INVALIDATED_ERROR
  );
}

/**
 * Return true if the browser extension context has been invalidated, e.g., due to a restart/update/crash.
 */
export const wasContextInvalidated = () => !chrome.runtime?.id;

// eslint-disable-next-line local-rules/persistBackgroundData -- Unused in background
const invalidatedContextController = new AbortController();
export const invalidatedContextSignal = invalidatedContextController.signal;

/**
 * Returns a promise that resolves when the background script is unloaded,
 * which can only happens once per script lifetime.
 */
export const onContextInvalidated = once(async (): Promise<void> => {
  expectContext("extension");

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (wasContextInvalidated()) {
        resolve();
        invalidatedContextController.abort();
        clearInterval(interval);
      }
    }, 200);
  });
});
