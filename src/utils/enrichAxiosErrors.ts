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

import axios from "axios";
import { expectContext } from "@/utils/expectContext";
import { getErrorMessage } from "@/errors/errorHelpers";
import {
  ClientNetworkError,
  ClientNetworkPermissionError,
  RemoteServiceError,
} from "@/errors/clientRequestErrors";
import { assertProtocolUrl } from "@/errors/assertProtocolUrl";
import {
  isAxiosError,
  NO_INTERNET_MESSAGE,
  NO_RESPONSE_MESSAGE,
} from "@/errors/networkErrorHelpers";
import { DEFAULT_SERVICE_URL } from "@/urlConstants";

export default function enrichAxiosErrors(): void {
  expectContext("extension");

  // Automatically wraps common Axios errors whenever possible
  // https://axios-http.com/docs/interceptors
  axios.interceptors.response.use(undefined, enrichBusinessRequestError);
}

/**
 * Turn AxiosErrors into BusinessErrors whenever possible
 */
async function enrichBusinessRequestError(error: unknown): Promise<never> {
  if (!isAxiosError(error)) {
    throw error;
  }

  console.trace("enrichBusinessRequestError", { error });

  // This should have already been called before attempting the request because Axios does not actually catch invalid URLs
  const url = assertProtocolUrl(error.config.url ?? "", ["https:", "http:"], {
    baseUrl: error.config.baseURL,
  });

  // In case of a CORS permission error, response.status can be 0. This case is handled below
  if (error.response != null && error.response.status !== 0) {
    // Exclude app errors, unless they're proxied requests
    if (
      url.href.startsWith(DEFAULT_SERVICE_URL) &&
      !url.pathname.startsWith("/api/proxy")
    ) {
      // TODO: Maybe handle app errors here too, like we do in `selectServerErrorMessage`
      // eslint-disable-next-line @typescript-eslint/no-throw-literal -- Duck-typed Error, still works
      throw error;
    }

    throw new RemoteServiceError(getErrorMessage(error), { cause: error });
  }

  if (!navigator.onLine) {
    throw new ClientNetworkError(NO_INTERNET_MESSAGE, { cause: error });
  }

  const hasPermissions = await browser.permissions.contains({
    origins: [url.href],
  });

  if (!hasPermissions) {
    throw new ClientNetworkPermissionError(
      "Insufficient browser permissions to make request.",
      { cause: error },
    );
  }

  throw new ClientNetworkError(NO_RESPONSE_MESSAGE, { cause: error });
}
