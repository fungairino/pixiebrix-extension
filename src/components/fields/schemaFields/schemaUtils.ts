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

import { type Schema } from "@/types/schemaTypes";
import { isEmpty } from "lodash";

type SchemaProperties = Record<string, Schema>;

type TypePredicate = (schema: Schema) => boolean;

export const textPredicate = (schema: Schema) => schema.type === "string";
export const booleanPredicate = (schema: Schema) => schema.type === "boolean";

export function findOneOf(schema: Schema, predicate: TypePredicate): Schema {
  return schema.oneOf?.find(
    (x) => typeof x === "object" && predicate(x),
  ) as Schema;
}

/**
 * Wrap a JSON Schema as an array schema.
 */
export function arraySchema(itemSchema: Schema): Schema {
  return {
    type: "array",
    items: itemSchema,
  };
}

/**
 * Returns a Schema. If an normal object is passed in, casts it to an object Schema.
 */
export function castSchema(
  schemaOrProperties: Schema | SchemaProperties,
): Schema {
  // XXX: this isn't quite right -- the check won't work if there's a title/description for the empty schema
  if (isEmpty(schemaOrProperties)) {
    // Empty schema means allow anything
    return {} as Schema;
  }

  if (schemaOrProperties.type && schemaOrProperties.type !== "object") {
    // Is another type of schema
    return schemaOrProperties;
  }

  if (schemaOrProperties.type && schemaOrProperties.properties) {
    return schemaOrProperties as Schema;
  }

  return {
    type: "object",
    properties: schemaOrProperties as SchemaProperties,
  };
}
