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

import React from "react";
import { renderHook } from "@testing-library/react-hooks";
import useRequiredPartnerAuth from "@/auth/useRequiredPartnerAuth";
import { Provider } from "react-redux";
import { appApi } from "@/services/api";
import { uuidv4 } from "@/types/helpers";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice } from "@/auth/authSlice";
import integrationsSlice, {
  type IntegrationsState,
} from "@/integrations/store/integrationsSlice";
import { type AuthState } from "@/auth/authTypes";
import settingsSlice from "@/store/settings/settingsSlice";
import { type SettingsState } from "@/store/settings/settingsTypes";

import { type Me } from "@/types/contract";
import useManagedStorageState from "@/store/enterprise/useManagedStorageState";
import { type IntegrationConfig } from "@/integrations/integrationTypes";
import { waitForEffect } from "@/testUtils/testHelpers";
import { CONTROL_ROOM_OAUTH_INTEGRATION_ID } from "@/integrations/constants";

jest.mock("@/store/enterprise/useManagedStorageState", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ data: {}, isLoading: false }),
}));

jest.mock("@/services/api", () => ({
  appApi: {
    endpoints: {
      getMe: {
        useQueryState: jest.fn(() => ({
          data: {},
          isLoading: false,
        })),
      },
    },
  },
}));

function mockMeQuery(state: {
  isLoading: boolean;
  data?: Me;
  error?: any;
  isSuccess?: boolean;
}) {
  jest.mocked(appApi.endpoints.getMe.useQueryState).mockReturnValue(state);
}

function testStore(initialState?: {
  auth: AuthState;
  integrations: IntegrationsState;
  settings: SettingsState;
}) {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      integrations: integrationsSlice.reducer,
      settings: settingsSlice.reducer,
    },
    preloadedState: initialState,
  });
}

const useManagedStorageStateMock = jest.mocked(useManagedStorageState);

beforeEach(() => {
  useManagedStorageStateMock.mockReturnValue({
    data: {},
    isLoading: false,
  });
});

describe("useRequiredPartnerAuth", () => {
  test("no partner", async () => {
    const store = testStore();

    mockMeQuery({
      isSuccess: true,
      isLoading: false,
      data: {
        id: uuidv4(),
        partner: null,
        milestones: [],
      } as any,
    });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: false,
      partnerKey: undefined,
      requiresIntegration: false,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    });
  });

  test("require partner via settings screen", async () => {
    const store = testStore({
      auth: authSlice.getInitialState(),
      integrations: integrationsSlice.getInitialState(),
      settings: {
        ...settingsSlice.getInitialState(),
        authIntegrationId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
        authMethod: "partner-oauth2",
      },
    });

    mockMeQuery({
      isSuccess: true,
      isLoading: false,
      data: {
        id: uuidv4(),
        partner: null,
        milestones: [],
      } as any,
    });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: false,
      partnerKey: undefined,
      requiresIntegration: true,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    });
  });

  test("requires integration", async () => {
    const store = testStore();

    mockMeQuery({
      isSuccess: true,
      isLoading: false,
      data: {
        id: uuidv4(),
        partner: {
          id: uuidv4(),
          theme: "automation-anywhere",
        },
        milestones: [],
        organization: {
          control_room: {
            id: uuidv4(),
            url: "https://control-room.example.com",
          },
        },
      } as any,
    });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: true,
      partnerKey: "automation-anywhere",
      requiresIntegration: true,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    });
  });

  test("requires integration for managed storage partner", async () => {
    const store = testStore();

    useManagedStorageStateMock.mockReturnValue({
      data: { partnerId: "automation-anywhere" },
      isLoading: false,
    });

    // Unauthenticated user
    mockMeQuery({ data: {} as any, isLoading: false, isSuccess: true });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: true,
      partnerKey: "automation-anywhere",
      requiresIntegration: true,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    });
  });

  test("requires integration for CE user", async () => {
    const store = testStore();

    mockMeQuery({
      isSuccess: true,
      isLoading: false,
      data: {
        id: uuidv4(),
        partner: {
          id: uuidv4(),
          theme: "automation-anywhere",
        },
        milestones: [{ key: "aa_community_edition_register" }],
        organization: null,
      } as any,
    });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: true,
      partnerKey: "automation-anywhere",
      requiresIntegration: true,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    });
  });

  test("does not require integration for CE user once partner is removed", async () => {
    const store = testStore();

    mockMeQuery({
      isSuccess: true,
      isLoading: false,
      data: {
        id: uuidv4(),
        // Partner becomes null once full PixieBrix is toggled on in the Admin Console
        partner: null,
        milestones: [{ key: "aa_community_edition_register" }],
        organization: null,
      } as any,
    });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: false,
      partnerKey: undefined,
      requiresIntegration: false,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    });
  });

  test("has required integration", async () => {
    const store = testStore({
      auth: authSlice.getInitialState(),
      integrations: {
        ...integrationsSlice.getInitialState(),
        configured: {
          [uuidv4()]: {
            integrationId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
          } as IntegrationConfig,
        },
      },
      settings: settingsSlice.getInitialState(),
    });

    mockMeQuery({
      isSuccess: true,
      isLoading: false,
      data: {
        id: uuidv4(),
        milestones: [],
        partner: {
          id: uuidv4(),
          theme: "automation-anywhere",
        },
        organization: {
          control_room: {
            id: uuidv4(),
            url: "https://control-room.example.com",
          },
        },
      } as any,
    });

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    expect(result.current).toStrictEqual({
      hasPartner: true,
      partnerKey: "automation-anywhere",
      requiresIntegration: true,
      hasConfiguredIntegration: true,
      isLoading: false,
      error: undefined,
    });
  });
});
