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

import { TransformerABC } from "@/types/bricks/transformerTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { BusinessError } from "@/errors/businessErrors";

export class ParseCsv extends TransformerABC {
  constructor() {
    super("@pixiebrix/parse/csv", "Parse CSV", "Parse a string as a CSV file");
  }

  override async isPure(): Promise<boolean> {
    return true;
  }

  inputSchema: Schema = propertiesToSchema(
    {
      content: {
        type: "string",
        description: "The contents of the CSV file",
      },
    },
    ["content"],
  );

  override outputSchema: Schema = propertiesToSchema(
    {
      data: {
        type: "array",
        description:
          "The rows of the CSV, with a property for each header/column",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      meta: {
        type: "object",
        properties: {
          fieldNames: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },
    },
    ["data", "meta"],
  );

  async transform(
    { content }: BrickArgs<{ content: string }>,
    { logger }: BrickOptions,
  ): Promise<unknown> {
    const { default: Papa } = await import(
      /* webpackChunkName: "papaparse" */ "papaparse"
    );
    const { data, errors } = Papa.parse(content);

    if (errors.length > 0) {
      logger.warn("Error(s) parsing CSV file", { errors });
      throw new BusinessError(errors[0].message);
    }

    return {
      data,
    };
  }
}
