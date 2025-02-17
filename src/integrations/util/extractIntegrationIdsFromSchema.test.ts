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

import {
  BASE_SHEET_SCHEMA,
  SHEET_SERVICE_SCHEMA,
} from "@/contrib/google/sheets/core/schemas";
import { inputProperties as httpInputProperties } from "@/bricks/transformers/remoteMethod";
import extractIntegrationIdsFromSchema from "@/integrations/util/extractIntegrationIdsFromSchema";

describe("extractIntegrationIdsFromSchema", () => {
  it("errors by default if not found", () => {
    expect(() => extractIntegrationIdsFromSchema({})).toThrow();
  });

  it("can suppress error", () => {
    expect(
      extractIntegrationIdsFromSchema({}, { suppressNotFoundError: true }),
    ).toEqual([]);
  });

  it("can extract from ref", () => {
    expect(extractIntegrationIdsFromSchema(SHEET_SERVICE_SCHEMA)).toEqual([
      "google/sheet",
    ]);
  });

  it("ignores non-service ref", () => {
    expect(extractIntegrationIdsFromSchema({ $ref: "tacos" })).toEqual([]);
  });

  it("does not error if value is not found in sub-schema", () => {
    const schema = {
      oneOf: [SHEET_SERVICE_SCHEMA, BASE_SHEET_SCHEMA],
    };

    expect(extractIntegrationIdsFromSchema(schema)).toEqual(["google/sheet"]);
  });

  it("returns empty for HTTP brick", () => {
    // Returns empty because the $ref is https://app.pixiebrix.com/schemas/service#/definitions/configuredService
    // which is not a specific service schema.
    expect(
      extractIntegrationIdsFromSchema(httpInputProperties.service),
    ).toEqual([]);
  });
});
