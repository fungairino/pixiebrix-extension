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

import blockRegistry from "@/bricks/registry";
import {
  echoBrick,
  simpleInput,
  testOptions,
} from "@/runtime/pipelineTests/pipelineTestHelpers";
import { reducePipeline } from "@/runtime/reducePipeline";
import MapValues from "@/bricks/transformers/controlFlow/MapValues";
import { toExpression } from "@/utils/expressionUtils";

const mapValueBrick = new MapValues();

beforeEach(() => {
  blockRegistry.clear();
  blockRegistry.register([echoBrick, mapValueBrick]);
});

describe("MapValues", () => {
  test("loop", async () => {
    const pipeline = {
      id: mapValueBrick.id,
      config: {
        elements: toExpression("var", "@input.elements"),
        body: toExpression("pipeline", [
          {
            id: echoBrick.id,
            config: {
              message: toExpression("nunjucks", "iteration {{ @element }}"),
            },
          },
        ]),
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({ elements: [1, 2, 3] }),
      testOptions("v3"),
    );
    expect(result).toStrictEqual([
      { message: "iteration 1" },
      { message: "iteration 2" },
      { message: "iteration 3" },
    ]);
  });
});
