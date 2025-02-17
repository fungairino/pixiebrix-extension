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
import { getApiClient, getLinkedApiClient } from "@/services/apiClient";
import { isAppUrl } from "@/services/requestErrorUtils";
import { expectContext, forbidContext } from "@/utils/expectContext";
import { EndpointAuthError } from "@/errors/genericErrors";
import { isAxiosError } from "@/errors/networkErrorHelpers";
import { isAbsoluteUrl } from "@/utils/urlUtils";

const HTTP_401_UNAUTHENTICATED = 401;

type FetchOptions = {
  requireLinked?: true;
};

/**
 * A `fetch` method that automatically authenticates calls to the app API. Prefer RTK Query in React code.
 * @see getLinkedApiClient
 * @see getApiClient
 */
export async function fetch<TData = unknown>(
  relativeOrAbsoluteUrl: string,
  options: FetchOptions = {},
): Promise<TData> {
  expectContext("extension");
  forbidContext(
    "contentScript",
    "fetch should not be called from the contentScript due to CSP",
  );

  const absolute = isAbsoluteUrl(relativeOrAbsoluteUrl);

  const { requireLinked } = {
    requireLinked: false,
    ...options,
  };

  if (absolute) {
    if (!(await isAppUrl(relativeOrAbsoluteUrl))) {
      const { data } = await axios.get<TData>(relativeOrAbsoluteUrl);
      return data;
    }

    console.warn(
      "fetch calls for the PixieBrix API should use relative URLs to support a dynamic base URL",
      {
        relativeOrAbsoluteUrl,
      },
    );
  }

  const client = await (requireLinked ? getLinkedApiClient() : getApiClient());

  try {
    const { data } = await client.get(relativeOrAbsoluteUrl);
    return data;
  } catch (error) {
    if (
      isAxiosError(error) &&
      // There are some cases where `response` is undefined (because the browser blocked the request, e.g., b/c CORS)
      error.response?.status === HTTP_401_UNAUTHENTICATED
    ) {
      throw new EndpointAuthError(relativeOrAbsoluteUrl);
    }

    throw error;
  }
}
