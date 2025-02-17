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

import { type Except } from "type-fest";
import { type AxiosError, type AxiosResponse } from "axios";
import { isEmpty } from "lodash";
import { getReasonPhrase } from "http-status-codes";
import { isObject } from "@/utils/objectUtils";

/**
 * Axios offers its own serialization method, but it doesn't include the response.
 * By deleting toJSON, the serialize-error library will use its default serialization
 */
export type SerializableAxiosError = Except<AxiosError, "toJSON">;

// Copy of axios.isAxiosError, without risking to import the whole untreeshakeable axios library
export function isAxiosError(error: unknown): error is SerializableAxiosError {
  return (
    isObject(error) &&
    // To deal with original AxiosError as well as a serialized error
    // we check 'isAxiosError' property for a non-serialized Error and 'name' for serialized object
    // Related issue to revisit RTKQ error handling: https://github.com/pixiebrix/pixiebrix-extension/issues/4032
    (Boolean(error.isAxiosError) || error.name === "AxiosError")
  );
}

export const NO_INTERNET_MESSAGE =
  "No response received. You are not connected to the internet.";
export const NO_RESPONSE_MESSAGE =
  "No response received. Your browser may have blocked the request. See https://docs.pixiebrix.com/how-to/troubleshooting/troubleshooting-network-errors for troubleshooting information";

/**
 * @deprecated DO NOT CALL DIRECTLY. Call getErrorMessage
 * @see getErrorMessage
 */
export function selectNetworkErrorMessage(error: unknown): string | null {
  if (!isAxiosError(error)) {
    return null;
  }

  if (!navigator.onLine) {
    return NO_INTERNET_MESSAGE;
  }

  // The response object may exist even on "offline" errors
  if (error.response) {
    const serverErrorMessage = selectServerErrorMessage(error.response);
    if (serverErrorMessage) {
      return serverErrorMessage;
    }
  }

  // `error.status` is an incorrect declaration: https://github.com/axios/axios/pull/5331
  if (
    !(error.status || error.response?.status) ||
    error.message === "Network Error"
  ) {
    // No response, no status, not offline. The request likely failed in the browser
    return NO_RESPONSE_MESSAGE;
  }

  // Likely a non-200 error. No special handling needed, getErrorMessage can handle it
  return null;
}

/**
 * Version of getReasonPhrase that returns null for unknown status codes (i.e., instead of throwing an error)
 * @param code the HTML status code
 * @see getReasonPhrase statusText from the HTML standard
 */
export function safeGuessStatusText(code: string | number): string | null {
  try {
    return getReasonPhrase(code);
  } catch {
    return null;
  }
}

/**
 * Django Rest Framework (DRF) response payload for 400 validation error response for single object.
 */
type BadRequestObjectData = {
  // XXX: is it also still possible for __all__ to be returned if the Django (not DRF) throws an error when cleaning
  // the model? See: https://github.com/encode/django-rest-framework/issues/1450
  // If __all__ the  only key, it will still end up getting reported as the error message in getErrorMessage
  non_field_errors?: string[];
  [field: string]: string[] | undefined;
};
// If an array of objects is passed to an endpoint, DRF will return an array of BadRequestObjectData
type BadRequestData = BadRequestObjectData | BadRequestObjectData[];
/**
 * Django Rest Framework (DRF) response payload for 4XX error that's not associated with a serializer.
 */
type ClientErrorData = {
  detail: string;
};

export function isBadRequestObjectData(
  data: unknown,
): data is BadRequestObjectData {
  if (!isObject(data)) {
    return false;
  }

  return Object.values(data).every(
    (errors) =>
      Array.isArray(errors) &&
      errors.every((error) => typeof error === "string"),
  );
}

function isClientErrorData(data: unknown): data is ClientErrorData {
  // We could check for status > 400 and < 500 here, but might as well just go with duck typing on the body
  return isObject(data) && typeof data.detail === "string";
}

/**
 * Return true if response is a 400 Bad Request from the PixieBrix API.
 * @param response the API response
 */
function isBadRequestResponse(
  response?: AxiosResponse,
): response is AxiosResponse<BadRequestData> {
  if (!response) {
    return false;
  }

  if (response.status !== 400) {
    return false;
  }

  if (Array.isArray(response.data)) {
    return response.data.every((item) => isBadRequestObjectData(item));
  }

  return isBadRequestObjectData(response.data);
}

/**
 * Return true if error is a 400 Bad Request error for a single object from the PixieBrix API.
 *
 * @param error the API error
 */
export function isSingleObjectBadRequestError(
  error: unknown,
): error is AxiosError<BadRequestObjectData> {
  if (!isAxiosError(error)) {
    return false;
  }

  return (
    isBadRequestResponse(error.response) && !Array.isArray(error.response.data)
  );
}

/**
 * Return true if response is a 4XX request error from the PixieBrix API.
 *
 * Use isBadRequestResponse for 400 request errors.
 *
 * @param response the API response
 * @see isBadRequestResponse
 */
function isClientErrorResponse(
  response: AxiosResponse,
): response is AxiosResponse<ClientErrorData> {
  return isClientErrorData(response.data);
}

/**
 * Heuristically select the most user-friendly error message for an Axios response.
 *
 * Tries to handle:
 * - Errors produced by our backend (Django Rest Framework style)
 * - Common response body patterns of other APIs
 * - HTTP standards in statusText/status
 *
 * enrichBusinessRequestError is a related method which wraps an AxiosError in an Error subclass that encodes information
 * about why the request failed.
 *
 * @param response Response from the server. Must not be null
 *
 * @deprecated DO NOT CALL DIRECTLY. Call getErrorMessage
 * @see getErrorMessage
 * @see enrichBusinessRequestError
 */
function selectServerErrorMessage(response: AxiosResponse): string | null {
  if (response == null) {
    throw new Error("Expected response to be defined");
  }

  // For examples of DRF errors, see the pixiebrix-app repository:
  // http://github.com/pixiebrix/pixiebrix-app/blob/5ef1e4e414be6485fae999440b69f2b6da993668/api/tests/test_errors.py#L15-L15

  // Handle 400 responses created by DRF serializers
  if (isBadRequestResponse(response)) {
    const data = Array.isArray(response.data)
      ? response.data.find((x) => isEmpty(x))
      : response.data;

    if (!data) {
      return null;
    }

    const objectLevelError = data.non_field_errors?.[0];
    const arbitraryFieldMessage = Object.values(data)[0]?.[0];

    return objectLevelError ?? arbitraryFieldMessage ?? null;
  }

  // Handle 4XX responses created by DRF
  if (isClientErrorResponse(response)) {
    return response.data.detail;
  }

  // Handle other likely API JSON body response formats
  // Some servers produce an HTML document for server responses even if you requested JSON. Check the response headers
  // to avoid dumping JSON to the user
  if (
    typeof response.data === "string" &&
    typeof response.headers["content-type"] === "string" &&
    ["text/plain", "application/json"].includes(
      response.headers["content-type"],
    )
  ) {
    return response.data;
  }

  // Handle common keys from other APIs
  for (const messageKey of ["message", "reason"]) {
    // eslint-disable-next-line security/detect-object-injection -- constant defined above
    const message = response.data?.[messageKey];
    if (typeof message === "string" && !isEmpty(message)) {
      return message;
    }
  }

  // Otherwise, rely on HTTP REST statusText/status
  if (!isEmpty(response.statusText)) {
    return response.statusText;
  }

  return safeGuessStatusText(response.status);
}
