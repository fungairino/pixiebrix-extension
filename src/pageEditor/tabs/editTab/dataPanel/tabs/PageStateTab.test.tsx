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
import { waitForEffect } from "@/testUtils/testHelpers";
import { render } from "@/pageEditor/testHelpers";
import PageStateTab from "./PageStateTab";
import { actions } from "@/pageEditor/slices/editorSlice";
import { getPageState } from "@/contentScript/messenger/api";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { Tab } from "react-bootstrap";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";
import { modMetadataFactory } from "@/testUtils/factories/modComponentFactories";
import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";

describe("PageStateTab", () => {
  beforeAll(() => {
    jest.mocked(getPageState).mockResolvedValue({
      foo: "bar",
      baz: 32,
    });
  });

  async function renderPageStateTab(formState: ModComponentFormState) {
    const utils = render(
      <Tab.Container activeKey={DataPanelTabKey.PageState}>
        <PageStateTab />
      </Tab.Container>,
      {
        setupRedux(dispatch) {
          dispatch(actions.addElement(formState));
          dispatch(actions.selectElement(formState.uuid));
        },
      },
    );

    await waitForEffect();

    return utils;
  }

  test("it renders with orphan extension", async () => {
    const formState = formStateFactory();
    const { asFragment } = await renderPageStateTab(formState);
    expect(asFragment()).toMatchSnapshot();
  });

  test("it renders with recipe extension", async () => {
    const formState = formStateFactory({
      recipe: modMetadataFactory(),
    });
    const { asFragment } = await renderPageStateTab(formState);
    expect(asFragment()).toMatchSnapshot();
  });
});
