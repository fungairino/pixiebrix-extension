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

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  AUTH_METHODS,
  type SettingsFlags,
  type SettingsState,
} from "@/store/settings/settingsTypes";
import reportError from "@/telemetry/reportError";
import { isEmpty, once } from "lodash";
import { DEFAULT_THEME } from "@/themes/themeTypes";
import { isValidTheme } from "@/themes/themeUtils";
import { type RegistryId } from "@/types/registryTypes";
import { isRegistryId } from "@/types/helpers";
import { revertAll } from "@/store/commonActions";

export const initialSettingsState: SettingsState = {
  mode: "remote",
  nextUpdate: null,
  suggestElements: false,
  browserWarningDismissed: false,
  /**
   * @since 1.8.6 default to true
   */
  // The variable popover was GA in 1.8.4; we wrote a migration to turn it on for existing installs, but forgot
  // to update it here for new installations.
  varAutosuggest: true,
  /**
   * True to enable the floating action button, if the user is not an enterprise/partner user.
   * @since 1.7.35 default to true
   */
  isFloatingActionButtonEnabled: true,
  partnerId: null,
  authMethod: null,
  authIntegrationId: null,
  theme: DEFAULT_THEME,
  updatePromptTimestamp: null,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState: initialSettingsState,
  reducers: {
    setMode(state, { payload: { mode } }) {
      state.mode = mode;
    },
    setFlag(
      state,
      action: PayloadAction<{
        flag: keyof SettingsFlags;
        value: boolean;
      }>,
    ) {
      const { flag, value } = action.payload;
      // eslint-disable-next-line security/detect-object-injection -- type checked
      state[flag] = value;
    },
    snoozeUpdates(state, action: PayloadAction<{ durationMillis: number }>) {
      const { durationMillis } = action.payload;
      state.nextUpdate = Date.now() + durationMillis;
    },
    dismissBrowserWarning(state) {
      state.browserWarningDismissed = true;
    },
    setFloatingActionButtonEnabled(state, { payload }: { payload: boolean }) {
      state.isFloatingActionButtonEnabled = payload;
    },
    setPartnerId(
      state,
      { payload: { partnerId } }: { payload: { partnerId: string } },
    ) {
      state.partnerId = partnerId;
    },
    setAuthIntegrationId(
      state,
      {
        payload: { integrationId },
      }: { payload: { integrationId: RegistryId } },
    ) {
      // Ensure valid data for authServiceId
      state.authIntegrationId =
        !isEmpty(integrationId) && isRegistryId(integrationId)
          ? integrationId
          : null;
    },
    setAuthMethod(
      state,
      { payload: { authMethod } }: { payload: { authMethod: string } },
    ) {
      // Ignore invalid values
      if (AUTH_METHODS.includes(authMethod)) {
        state.authMethod = authMethod as SettingsState["authMethod"];
      } else {
        state.authMethod = null;
      }
    },
    recordUpdatePromptTimestamp(state) {
      // Don't overwrite the old timestamp
      if (state.updatePromptTimestamp == null) {
        state.updatePromptTimestamp = Date.now();
      }
    },
    resetUpdatePromptTimestamp(state) {
      state.updatePromptTimestamp = null;
    },
    setTheme(state, { payload: { theme } }: { payload: { theme: string } }) {
      if (isValidTheme(theme)) {
        state.theme = theme;
        return;
      }

      state.theme = DEFAULT_THEME;

      once(() => {
        reportError(new Error(`Selected theme "${theme}" doesn't exist.`));
      });
    },
  },
  extraReducers(builder) {
    builder.addCase(revertAll, () => initialSettingsState);
  },
});

export default settingsSlice;
