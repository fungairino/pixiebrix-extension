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

import { cachedSearchBots } from "@/contrib/automationanywhere/aaApi";
import { performConfiguredRequestInBackground } from "@/background/messenger/api";
import { type RemoteResponse } from "@/types/contract";
import pDefer, { type DeferredPromise } from "p-defer";
import {
  type SanitizedConfig,
  type SanitizedIntegrationConfig,
} from "@/integrations/integrationTypes";

import { CONTROL_ROOM_TOKEN_INTEGRATION_ID } from "@/integrations/constants";

jest.mock("@/background/messenger/api");

const performConfiguredRequestInBackgroundMock = jest.mocked(
  performConfiguredRequestInBackground,
);

describe("aaApi", () => {
  it("should vary bot cache on workspace type", async () => {
    const deferred: Array<DeferredPromise<RemoteResponse>> = [];

    performConfiguredRequestInBackgroundMock.mockImplementation(async () => {
      const deferredResponse = pDefer<RemoteResponse>();
      deferred.push(deferredResponse);
      return deferredResponse.promise;
    });

    const partialConfig = {
      config: {
        folderId: null,
      } as unknown as SanitizedConfig,
      proxy: false,
      serviceId: CONTROL_ROOM_TOKEN_INTEGRATION_ID,
    } as SanitizedIntegrationConfig;

    const privatePromise1 = cachedSearchBots(partialConfig, {
      workspaceType: "private",
      query: "",
      value: null,
    });
    const privatePromise2 = cachedSearchBots(partialConfig, {
      workspaceType: "private",
      query: "",
      value: null,
    });
    const publicPromise1 = cachedSearchBots(partialConfig, {
      workspaceType: "public",
      query: "",
      value: null,
    });
    const publicPromise2 = cachedSearchBots(partialConfig, {
      workspaceType: "public",
      query: "",
      value: null,
    });

    expect(performConfiguredRequestInBackgroundMock).toHaveBeenCalledTimes(2);

    for (const { reject } of deferred) {
      reject("Reject to isn't cached across tests");
    }

    for (const promise of [
      privatePromise1,
      privatePromise2,
      publicPromise1,
      publicPromise2,
    ]) {
      // eslint-disable-next-line no-await-in-loop -- jest expect
      await expect(promise).rejects.toBe("Reject to isn't cached across tests");
    }
  });
});
