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
import { Tab } from "react-bootstrap";
import CommentsTab from "@/pageEditor/tabs/editTab/dataPanel/tabs/CommentsTab";
import { render, screen } from "@/pageEditor/testHelpers";
// eslint-disable-next-line no-restricted-imports -- used for testing purposes
import { Formik } from "formik";
import { menuItemFormStateFactory } from "@/testUtils/factories/pageEditorFactories";
import { brickConfigFactory } from "@/testUtils/factories/brickFactories";
import userEvent from "@testing-library/user-event";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { modMetadataFactory } from "@/testUtils/factories/modComponentFactories";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";

const reportEventMock = jest.mocked(reportEvent);

const commentsFieldName = "extension.blockPipeline.0.comments";
const initialComments = "Hello world!";
const formStateWithComments = menuItemFormStateFactory(
  {
    recipe: modMetadataFactory(),
  },
  [
    brickConfigFactory({
      comments: initialComments,
    }),
  ],
);

const formStateWithNoComments = menuItemFormStateFactory({}, [
  brickConfigFactory(),
]);
const renderCommentsTab = (formState = formStateWithComments) => {
  const brickId = formState.extension.blockPipeline[0].id;
  render(
    <Tab.Container defaultActiveKey={DataPanelTabKey.Comments}>
      <Formik onSubmit={jest.fn()} initialValues={formState}>
        <CommentsTab
          brickId={brickId}
          brickCommentsFieldName={commentsFieldName}
          modId={formState.recipe?.id}
        />
      </Formik>
    </Tab.Container>,
  );
};

describe("CommentsTab", () => {
  it("renders comments", () => {
    renderCommentsTab();
    expect(screen.getByRole("textbox")).toHaveTextContent(initialComments);
  });

  it("renders editable empty text area", async () => {
    renderCommentsTab(formStateWithNoComments);
    const textArea = screen.getByRole("textbox");
    expect(textArea).toBeInTheDocument();

    expect(textArea).toHaveValue("");

    const newComments = "I am a comment!";
    await userEvent.type(textArea, newComments);

    expect(textArea).toHaveValue(newComments);

    // Trigger onBlur event for the textarea
    await userEvent.keyboard("{tab}");
    const expectedBrickId =
      formStateWithNoComments.extension.blockPipeline[0].id;

    expect(reportEventMock).toHaveBeenCalledWith(Events.BRICK_COMMENTS_UPDATE, {
      commentsLength: newComments.length,
      brickId: expectedBrickId,
      modId: undefined,
    });
  });

  it("reports telemetry with mod id if available", async () => {
    renderCommentsTab(formStateWithComments);
    const textArea = screen.getByRole("textbox");

    const newComments = "I am a comment!";
    const expectedComments = `${initialComments}${newComments}`;
    await userEvent.type(textArea, newComments);

    expect(textArea).toHaveValue(expectedComments);

    // Trigger onBlur event for the textarea
    await userEvent.keyboard("{tab}");
    const expectedBrickId = formStateWithComments.extension.blockPipeline[0].id;

    expect(reportEventMock).toHaveBeenCalledWith(Events.BRICK_COMMENTS_UPDATE, {
      commentsLength: expectedComments.length,
      brickId: expectedBrickId,
      modId: formStateWithComments.recipe.id,
    });
  });
});
