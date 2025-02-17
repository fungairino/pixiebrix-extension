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

import { getModComponentState } from "@/store/extensionsStorage";
import extensionPointRegistry from "@/starterBricks/registry";
import { updateNavigationId } from "@/contentScript/context";
import * as sidebar from "@/contentScript/sidebarController";
import { NAVIGATION_RULES } from "@/contrib/navigationRules";
import { testMatchPatterns } from "@/bricks/available";
import reportError from "@/telemetry/reportError";
import { compact, debounce, groupBy, intersection, uniq } from "lodash";
import oneEvent from "one-event";
import { resolveExtensionInnerDefinitions } from "@/registry/internal";
import { traces } from "@/background/messenger/api";
import { isDeploymentActive } from "@/utils/deploymentUtils";
import { PromiseCancelled } from "@/errors/genericErrors";
import { getThisFrame } from "webext-messenger";
import { type StarterBrick } from "@/types/starterBrickTypes";
import { type UUID } from "@/types/stringTypes";
import { type RegistryId } from "@/types/registryTypes";
import { RunReason } from "@/types/runtimeTypes";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { type SidebarStarterBrickABC } from "@/starterBricks/sidebarExtension";
import {
  getReloadOnNextNavigate,
  setReloadOnNextNavigate,
} from "@/contentScript/ready";
import { logPromiseDuration, pollUntilTruthy } from "@/utils/promiseUtils";
import { $safeFind } from "@/utils/domUtils";
import { invalidatedContextSignal } from "@/errors/contextInvalidated";

/**
 * True if handling the initial page load.
 * @see loadPersistedExtensionsOnce
 */
let _initialLoad = true;

/**
 * Promise to memoize fetching extension points and extensions from storage
 * @see loadPersistedExtensionsOnce
 */
let pendingLoadPromise: Promise<StarterBrick[]> | null;

/**
 * Map from persisted extension IDs to their extension points.
 *
 * Mutually exclusive with _editorExtensions.
 *
 * @see _editorExtensions
 */
// eslint-disable-next-line local-rules/persistBackgroundData -- Unused there
const _persistedExtensions = new Map<UUID, StarterBrick>();

/**
 * Map from extension IDs currently being edited in the Page Editor to their extension points.
 *
 * Mutually exclusive with _persistedExtensions.
 *
 * @see _persistedExtensions
 */
// eslint-disable-next-line local-rules/persistBackgroundData -- Unused there
const _editorExtensions = new Map<UUID, StarterBrick>();

/**
 * Extension points active/installed on the page.
 */
// eslint-disable-next-line local-rules/persistBackgroundData -- Unused there
const _activeExtensionPoints = new Set<StarterBrick>();

/**
 * Used to ignore navigation events that don't change the URL.
 */
let lastUrl: string | undefined;

/**
 * Abort controllers for navigation events for Single Page Applications (SPAs).
 */
// eslint-disable-next-line local-rules/persistBackgroundData -- Functions
const _navigationListeners = new Set<() => void>();

const WAIT_LOADED_INTERVAL_MS = 25;

/**
 * Run an extension point and specified ModComponentBases.
 * @param extensionPoint the extension point to install/run
 * @param reason the reason code for the run
 * @param extensionIds the ModComponentBases to run on the extension point, or undefined to run all ModComponentBases
 * @param abortSignal abort signal to cancel the install/run
 */
async function runExtensionPoint(
  extensionPoint: StarterBrick,
  {
    reason,
    extensionIds,
    abortSignal,
  }: { reason: RunReason; extensionIds?: UUID[]; abortSignal: AbortSignal },
): Promise<void> {
  // Could potentially call _activeExtensionPoints.delete here, but assume the extension point is still available
  // until we know for sure that it's not

  if (!(await extensionPoint.isAvailable())) {
    // `extensionPoint.install` should short-circuit return false if it's not available. But be defensive.
    return;
  }

  let installed = false;

  // Details to make it easier to debug extension point lifecycle
  const details = {
    extensionPointId: extensionPoint.id,
    kind: extensionPoint.kind,
    name: extensionPoint.name,
    permissions: extensionPoint.permissions,
    extensionIds,
    reason,
  };

  try {
    installed = await extensionPoint.install();
  } catch (error) {
    if (error instanceof PromiseCancelled) {
      console.debug(
        `Skipping ${extensionPoint.kind} ${extensionPoint.id} because user navigated away from the page`,
        details,
      );

      _activeExtensionPoints.delete(extensionPoint);
      return;
    }

    throw error;
  }

  if (!installed) {
    console.debug(
      `Skipping ${extensionPoint.kind} ${extensionPoint.id} because it was not installed on the page`,
      details,
    );

    _activeExtensionPoints.delete(extensionPoint);
    return;
  }

  if (abortSignal.aborted) {
    console.debug(
      `Skipping ${extensionPoint.kind} ${extensionPoint.id} because user navigated away from the page`,
      details,
    );

    _activeExtensionPoints.delete(extensionPoint);
    return;
  }

  console.debug(
    `Installed extension point ${extensionPoint.kind}: ${extensionPoint.id}`,
    details,
  );

  await extensionPoint.runModComponents({ reason, extensionIds });
  _activeExtensionPoints.add(extensionPoint);

  console.debug(
    `Ran extension point ${extensionPoint.kind}: ${extensionPoint.id}`,
    details,
  );
}

/**
 * Ensure all extension points are installed that have StarterBrick.syncInstall set to true.
 *
 * Currently, includes:
 * - Sidebar Extension Points
 * - Context Menu Extension Points
 *
 * Used to ensure all sidebar extension points have had a chance to reserve panels before showing the sidebar.
 *
 * @see StarterBrick.isSyncInstall
 */
export async function ensureInstalled(): Promise<void> {
  const extensionPoints = await loadPersistedExtensionsOnce();
  const sidebarExtensionPoints = extensionPoints.filter((x) => x.isSyncInstall);
  // Log to help debug race conditions
  console.debug("lifecycle:ensureInstalled", {
    sidebarExtensionPoints,
  });
  await Promise.allSettled(
    sidebarExtensionPoints.map(async (x) => x.install()),
  );
}

/**
 * Warn if any lifecycle state assumptions are violated.
 */
function checkLifecycleInvariants(): void {
  const installedIds = [..._persistedExtensions.keys()];
  const editorIds = [..._editorExtensions.keys()];

  if (intersection(installedIds, editorIds).length > 0) {
    console.warn("Installed and editor extensions are not mutually exclusive", {
      installedIds,
      editorIds,
    });
  }
}

/**
 * Returns all the extension points currently running on the page. Includes both persisted extensions and extensions
 * being edited in the Page Editor.
 */
export function getActiveExtensionPoints(): StarterBrick[] {
  return [..._activeExtensionPoints];
}

/**
 * Test helper to get internal persisted extension state
 * @constructor
 */
export function TEST_getPersistedExtensions(): Map<UUID, StarterBrick> {
  return _persistedExtensions;
}

/**
 * Test helper to get internal editor extension state
 * @constructor
 */
export function TEST_getEditorExtensions(): Map<UUID, StarterBrick> {
  return _editorExtensions;
}

/**
 * Remove an extension from an extension point on the page if a persisted extension (i.e. in extensionsSlice)
 */
export function removePersistedExtension(extensionId: UUID): void {
  // Leaving the extension point in _activeExtensionPoints. Could consider removing if this was the last extension
  const extensionPoint = _persistedExtensions.get(extensionId);
  extensionPoint?.removeModComponent(extensionId);
  _persistedExtensions.delete(extensionId);
}

/**
 * Remove a page editor extensions extension(s) from the page.
 *
 * NOTE: if the dynamic extension was taking the place of a "permanent" extension, call `reactivate` or a similar
 * method for the extension to be reloaded.
 *
 * NOTE: this works by removing all extensions attached to the extension point. Call `reactivate` or a similar
 * method to re-install the installed extensions.
 *
 * @param extensionId the uuid of the dynamic extension, or undefined to clear all dynamic extensions
 * @param options options to control clear behavior
 */
export function clearEditorExtension(
  extensionId?: UUID,
  options?: { clearTrace?: boolean; preserveSidebar?: boolean },
): void {
  const { clearTrace, preserveSidebar } = {
    clearTrace: true,
    preserveSidebar: false,
    ...options,
  };

  if (extensionId) {
    if (_editorExtensions.has(extensionId)) {
      // Don't need to call _installedExtensionPoints.delete(extensionPoint) here because that tracks non-dynamic
      // extension points
      console.debug(`lifecycle:clearEditorExtension: ${extensionId}`);
      const extensionPoint = _editorExtensions.get(extensionId);

      if (extensionPoint.kind === "actionPanel" && preserveSidebar) {
        const sidebar = extensionPoint as SidebarStarterBrickABC;
        // eslint-disable-next-line new-cap -- hack for action panels
        sidebar.HACK_uninstallExceptExtension(extensionId);
      } else {
        extensionPoint.uninstall({ global: true });
      }

      _activeExtensionPoints.delete(extensionPoint);
      _editorExtensions.delete(extensionId);
      sidebar.removeExtensions([extensionId]);
    } else {
      console.debug(`No dynamic extension exists for uuid: ${extensionId}`);
    }

    if (clearTrace) {
      void traces.clear(extensionId);
    }
  } else {
    for (const extensionPoint of _editorExtensions.values()) {
      try {
        extensionPoint.uninstall({ global: true });
        _activeExtensionPoints.delete(extensionPoint);
        sidebar.removeExtensionPoint(extensionPoint.id);
      } catch (error) {
        reportError(error);
      }
    }

    _editorExtensions.clear();

    if (clearTrace) {
      traces.clearAll();
    }
  }
}

/**
 * Return an AbortSignal that's aborted when the user navigates.
 */
function createNavigationAbortSignal(): AbortSignal {
  const controller = new AbortController();
  _navigationListeners.add(controller.abort.bind(controller));
  return controller.signal;
}

/**
 * Notifies all navigation listeners that the user has navigated in a way that changed the URL.
 */
function notifyNavigationListeners(): void {
  for (const listener of _navigationListeners) {
    listener();
  }

  _navigationListeners.clear();
}

/**
 * Run an extension including unsaved changes from the Page Editor
 * @param extensionId
 * @param extensionPoint
 */
export async function runEditorExtension(
  extensionId: UUID,
  extensionPoint: StarterBrick,
): Promise<void> {
  // Uninstall the installed extension point instance in favor of the dynamic extensionPoint
  if (_persistedExtensions.has(extensionId)) {
    removePersistedExtension(extensionId);
  }

  // Uninstall the previous extension point instance in favor of the updated extensionPoint
  if (_editorExtensions.has(extensionId)) {
    // Pass preserveSidebar to avoid flickering permanent sidebars
    clearEditorExtension(extensionId, {
      clearTrace: false,
      preserveSidebar: true,
    });
  }

  _editorExtensions.set(extensionId, extensionPoint);

  await runExtensionPoint(extensionPoint, {
    // The Page Editor is the only caller for runDynamic
    reason: RunReason.PAGE_EDITOR,
    extensionIds: [extensionId],
    abortSignal: createNavigationAbortSignal(),
  });

  checkLifecycleInvariants();
}

/**
 * Uninstall any extension points for mods that are no longer active.
 *
 * When mods are updated in the background script (i.e. via the Deployment updater), we don't remove
 * extension points from the current tab in order to not interrupt the user's workflow. This function can be
 * used to do that clean up at a more appropriate time, e.g. upon navigation.
 */
function cleanUpDeactivatedExtensionPoints(
  activeExtensionMap: Record<RegistryId, ResolvedModComponent[]>,
): void {
  for (const extensionPoint of _activeExtensionPoints) {
    const hasActiveExtensions = Object.hasOwn(
      activeExtensionMap,
      extensionPoint.id,
    );

    if (hasActiveExtensions) {
      continue;
    }

    try {
      extensionPoint.uninstall({ global: true });
      _activeExtensionPoints.delete(extensionPoint);
    } catch (error) {
      reportError(error);
    }
  }
}

/**
 * Add extensions to their respective extension points.
 *
 * Includes starter bricks that are not available on the page.
 *
 * NOTE: Excludes dynamic extensions that are already on the page via the Page Editor.
 */
async function loadPersistedExtensions(): Promise<StarterBrick[]> {
  console.debug("lifecycle:loadPersistedExtensions");
  const options = await logPromiseDuration(
    "loadPersistedExtensions:loadOptions",
    getModComponentState(),
  );

  // Exclude the following:
  // - disabled deployments: the organization admin might have disabled the deployment because via Admin Console
  // - dynamic extensions: these are already installed on the page via the Page Editor
  const activeExtensions = options.extensions.filter(
    (extension) =>
      isDeploymentActive(extension) && !_editorExtensions.has(extension.id),
  );

  const resolvedActiveExtensions = await logPromiseDuration(
    "loadPersistedExtensions:resolveDefinitions",
    Promise.all(
      activeExtensions.map(async (x) => resolveExtensionInnerDefinitions(x)),
    ),
  );

  const activeExtensionMap = groupBy(
    resolvedActiveExtensions,
    (extension) => extension.extensionPointId,
  );

  cleanUpDeactivatedExtensionPoints(activeExtensionMap);

  _persistedExtensions.clear();

  const added = compact(
    await Promise.all(
      Object.entries(activeExtensionMap).map(
        async ([extensionPointId, extensions]: [
          RegistryId,
          ResolvedModComponent[],
        ]) => {
          try {
            const extensionPoint =
              await extensionPointRegistry.lookup(extensionPointId);

            // It's tempting to call extensionPoint.isAvailable here and skip if it's not available.
            // However, that would cause the extension point to be unavailable for the entire session
            // even if the SPA redirects to a page that matches.

            extensionPoint.synchronizeModComponents(extensions);

            // Mark the extensions as installed
            for (const extension of extensions) {
              _persistedExtensions.set(extension.id, extensionPoint);
            }

            return extensionPoint;
          } catch (error) {
            console.warn(`Error adding extension point: ${extensionPointId}`, {
              error,
            });
          }
        },
      ),
    ),
  );

  checkLifecycleInvariants();

  return added;
}

/**
 * Add the extensions to their respective extension points, and return the extension points with any extensions.
 *
 * Syncs the extensions, but does not call StarterBrick.install or StarterBrick.run.
 *
 * @see runExtensionPoint
 */
async function loadPersistedExtensionsOnce(): Promise<StarterBrick[]> {
  // Enforce fresh view for _reloadOnNextNavigate
  if (_initialLoad || getReloadOnNextNavigate()) {
    _initialLoad = false;
    setReloadOnNextNavigate(false);
    // XXX: could also include _editorExtensions to handle case where user activates a mod while the page editor
    // is open. However, that would require handling corner case where the user reactivating a mod that has dirty
    // changes. It's not worth the complexity of handling the corner case.

    pendingLoadPromise = logPromiseDuration(
      "loadPersistedExtensionsOnce:loadPersistedExtensions",
      loadPersistedExtensions(),
    );

    try {
      return await pendingLoadPromise;
    } finally {
      // MemoizedUntilSettled behavior
      pendingLoadPromise = null;
    }
  }

  if (pendingLoadPromise != null) {
    return pendingLoadPromise;
  }

  // NOTE: don't want _activeExtensionPoints, because we also want extension points that weren't active for the
  // previous page/navigation. (Because they may now be active)
  return uniq([
    ..._persistedExtensions.values(),
    ..._editorExtensions.values(),
  ]);
}

/**
 * Wait for the page to be ready according to the site-specific navigation rules.
 */
async function waitDocumentLoad(abortSignal: AbortSignal): Promise<void> {
  const url = document.location.href;
  const rules = NAVIGATION_RULES.filter((rule) =>
    testMatchPatterns(rule.matchPatterns, url),
  );
  if (rules.length > 0) {
    const jointSelector = rules
      .flatMap((rule) => rule.loadingSelectors)
      .filter(Boolean) // Exclude empty selectors, if any
      .join(",");
    const poll = () => {
      if (abortSignal.aborted || $safeFind(jointSelector).length === 0) {
        return true;
      }

      console.debug(
        `Custom navigation rule detected that page is still loading: ${url}`,
      );
    };

    await pollUntilTruthy(poll, {
      intervalMillis: WAIT_LOADED_INTERVAL_MS,
    });
  }
}

function decideRunReason({ force }: { force: boolean }): RunReason {
  if (force) {
    return RunReason.MANUAL;
  }

  if (_initialLoad) {
    return RunReason.INITIAL_LOAD;
  }

  return RunReason.NAVIGATE;
}

/**
 * Handle a website navigation, e.g., page load or a URL change in an SPA.
 */
export async function handleNavigate({
  force,
}: { force?: boolean } = {}): Promise<void> {
  const runReason = decideRunReason({ force });
  const thisTarget = await getThisFrame();
  const { href } = location;
  if (!force && lastUrl === href) {
    console.debug(
      "handleNavigate:Ignoring NOOP navigation to %s",
      href,
      thisTarget,
    );
    return;
  }

  console.debug("handleNavigate:Handling navigation to %s", href, thisTarget);
  updateNavigationId();
  notifyNavigationListeners();

  const abortSignal = createNavigationAbortSignal();

  const extensionPoints = await loadPersistedExtensionsOnce();
  if (extensionPoints.length > 0) {
    // Wait for document to load, to ensure any selector-based availability rules are ready to be applied.
    await logPromiseDuration(
      "handleNavigate:waitDocumentLoad",
      waitDocumentLoad(abortSignal),
    );

    // Safe to use Promise.all because the inner method can't throw
    await logPromiseDuration(
      "handleNavigate:runExtensionPoints",
      Promise.all(
        extensionPoints.map(async (extensionPoint) => {
          // Don't await each extension point since the extension point may never appear. For example, an
          // extension point that runs on the contact information modal on LinkedIn
          const runPromise = runExtensionPoint(extensionPoint, {
            reason: runReason,
            abortSignal,
          }).catch((error) => {
            console.error("Error installing/running: %s", extensionPoint.id, {
              error,
            });
          });

          if (extensionPoint.isSyncInstall) {
            await runPromise;
          }
        }),
      ),
    );
  }
}

/**
 * Mark that mods should be reloaded on next navigation, e.g., because a mod was updated/activated.
 */
export async function queueReactivateTab(): Promise<void> {
  console.debug("contentScript will reload extensions on next navigation");
  setReloadOnNextNavigate(true);
}

/**
 * Reload and re-activate all mods on the current page.
 */
export async function reactivateTab(): Promise<void> {
  await loadPersistedExtensions();
  // Force navigate event even though the href hasn't changed
  await handleNavigate({ force: true });
}

// Ideally we only want to catch local URL changes, but there's no way to discern
// navigation events that cause the current document to unload in the `navigate ` event.
async function onNavigate(event: NavigateEvent): Promise<void> {
  if (
    // Ignore navigations to external pages
    !event.destination.url.startsWith(location.origin) ||
    // Ignore <a download> links
    event.downloadRequest !== null // Specifically `null` and not `''`
  ) {
    return;
  }

  try {
    await oneEvent(window, "beforeunload", {
      signal: AbortSignal.timeout(0),
    });
  } catch {
    // It timed out before the "beforeunload" event, so this is a same-document navigation
    await handleNavigate();
  }
}

export async function initNavigation() {
  // Initiate PB for the current page
  await handleNavigate();

  // Listen to page URL changes
  // Some sites use the hash to encode page state (e.g., filters). There are some non-navigation scenarios
  // where the hash could change frequently (e.g., there is a timer in the state). Debounce to avoid overloading.
  window.navigation?.addEventListener(
    "navigate",
    debounce(onNavigate, 100, {
      leading: true,
      trailing: true,
      maxWait: 1000,
    }),
    { signal: invalidatedContextSignal },
  );
}
