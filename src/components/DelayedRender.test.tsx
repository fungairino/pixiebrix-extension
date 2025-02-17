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
import { render } from "@testing-library/react";
import DelayedRender from "./DelayedRender";

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

describe("DelayedRender", () => {
  test("renders", async () => {
    const { asFragment } = render(
      <DelayedRender millis={300}>Delayed content</DelayedRender>,
    );

    expect(asFragment()).toMatchInlineSnapshot(`
      <DocumentFragment>
        <div
          hidden=""
        >
          Delayed content
        </div>
      </DocumentFragment>
    `);

    jest.runAllTimers();
    expect(asFragment()).toMatchInlineSnapshot(`
      <DocumentFragment>
        Delayed content
      </DocumentFragment>
    `);
  });
});
