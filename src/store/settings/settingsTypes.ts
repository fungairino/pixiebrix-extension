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

import { type Theme } from "@/themes/themeTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type Except } from "type-fest";

type InstallMode = "local" | "remote";

export const AUTH_METHODS = [
  "default",
  "pixiebrix-token",
  "partner-token",
  "partner-oauth2",
] as const;

export type SkunkworksSettingsFlags = {
  /**
   * Experimental feature to suggest HTML elements to select in the Page Editor
   */
  suggestElements?: boolean;

  /**
   * Experimental setting to detect and exclude random classes when generating selectors
   */
  excludeRandomClasses?: boolean;

  /**
   * Experimental setting to track runtime performance
   */
  performanceTracing?: boolean;

  /**
   * Experimental setting to run some code in a sandbox
   */
  sandboxedCode?: boolean;
};

export type GeneralSettingsFlags = {
  /**
   * Setting to support autosuggest for variables in the Page Editor
   */
  varAutosuggest?: boolean;

  /**
   * Button to enable the floating action button on the page
   */
  isFloatingActionButtonEnabled?: boolean;
};

export type SettingsFlags = SkunkworksSettingsFlags & GeneralSettingsFlags;

/**
 * @deprecated - Do not use versioned state types directly
 */
export type SettingsStateV1 = SkunkworksSettingsFlags &
  GeneralSettingsFlags & {
    /**
     * Whether the extension is synced to the app for provisioning.
     *
     * NOTE: `local` is broken in many places. The only current valid value is remote.
     */
    mode: InstallMode;

    /**
     * Time to snooze updates until (in milliseconds from the epoch), or null.
     *
     * The banners still show, however no modals will be shown for the browser extension or team deployments.
     */
    nextUpdate: number | null;

    /**
     * Timestamps the update modal was first shown. Used to calculate time remaining for enforceUpdateMillis
     *
     * @since 1.7.1
     * @see AuthState.enforceUpdateMillis
     */
    updatePromptTimestamp: number | null;

    /**
     * Whether the non-Chrome browser warning has been dismissed.
     */
    browserWarningDismissed: boolean;

    /**
     * Partner id for the user, if any.
     */
    partnerId: string | null;

    /**
     * Registry id of the integration to use for authentication with the PixieBrix server.
     *
     * For partner integrations, PixieBrix is supporting using partner JWT for authenticating. The PixieBrix server
     * verifies the JWT.
     *
     * Only set if the user has provided the settings on the Settings Screen. Otherwise, is determined by configuration
     * of the user's primary organization.
     *
     * @since 1.7.5
     */
    authServiceId: RegistryId | null;

    /**
     * Force a particular authentication method. Will force user to authenticate, even if the user is authenticated via
     * another method.
     *
     * Use "default" to infer based on primary organization, etc.
     *
     * @since 1.7.12
     */
    authMethod: (typeof AUTH_METHODS)[number] | null;

    /**
     * Theme name for the extension
     */
    theme: Theme;
  };

/**
 * @deprecated - Do not use versioned state types directly
 */
export type SettingsStateV2 = Except<SettingsStateV1, "authServiceId"> & {
  /**
   * Registry id of the integration to use for authentication with the PixieBrix server.
   *
   * For partner integrations, PixieBrix is supporting using partner JWT for authenticating. The PixieBrix server
   * verifies the JWT.
   *
   * Only set if the user has provided the settings on the Settings Screen. Otherwise, is determined by configuration
   * of the user's primary organization.
   *
   * @since 1.7.5
   * @since 1.7.41 SettingsStateV2 renames authServiceId --> authIntegrationId
   */
  authIntegrationId: RegistryId | null;
};

/**
 * @deprecated - Do not use versioned state types directly
 */
export type SettingsStateV3 = SettingsStateV2 & {
  /**
   * @since 1.8.6 SettingsStateV3 makes varAutosuggest required
   */
  varAutosuggest: boolean;
};

export type SettingsState = SettingsStateV3;

export type SettingsRootState = {
  settings: SettingsState;
};
