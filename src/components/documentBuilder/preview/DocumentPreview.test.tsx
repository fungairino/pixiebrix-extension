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

import React, { useState } from "react";
import { createNewElement } from "@/components/documentBuilder/createNewElement";
import {
  type DocumentElement,
  type ListDocumentElement,
} from "@/components/documentBuilder/documentBuilderTypes";
import { fireEvent, screen } from "@testing-library/react";
import DocumentPreview from "@/components/documentBuilder/preview/DocumentPreview";
import userEvent from "@testing-library/user-event";
import { render } from "@/pageEditor/testHelpers";
import { DocumentRenderer } from "@/bricks/renderers/document";
import { actions } from "@/pageEditor/slices/editorSlice";
import DisplayTemporaryInfo from "@/bricks/transformers/temporaryInfo/DisplayTemporaryInfo";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import blockRegistry from "@/bricks/registry";
import { waitForEffect } from "@/testUtils/testHelpers";
import { type PipelineExpression } from "@/types/runtimeTypes";
import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";
import { toExpression } from "@/utils/expressionUtils";

function renderDocumentPreview(documentElement: DocumentElement) {
  const formState = formStateFactory(undefined, [
    {
      id: DocumentRenderer.BLOCK_ID,
      config: {
        body: [documentElement],
      },
    },
  ]);

  const PreviewContainer = () => {
    const [activeElement, setActiveElement] = useState<string | null>(null);
    return (
      <DocumentPreview
        documentBodyName="extension.blockPipeline[0].config.body"
        activeElement={activeElement}
        setActiveElement={setActiveElement}
      />
    );
  };

  return render(<PreviewContainer />, {
    initialValues: formState,
    setupRedux(dispatch) {
      dispatch(actions.addElement(formState));
      dispatch(actions.selectElement(formState.uuid));
      dispatch(
        actions.setElementActiveNodeId(
          formState.extension.blockPipeline[0].instanceId,
        ),
      );
    },
  });
}

const documentBlock = new DocumentRenderer();
const temporaryDisplayBlock = new DisplayTemporaryInfo();

beforeAll(async () => {
  registerDefaultWidgets();
  blockRegistry.clear();
  blockRegistry.register([documentBlock, temporaryDisplayBlock]);
});

describe("Add new element", () => {
  // TODO: find a better way to access the elements so we can remove the linting exceptions
  test("Dropdown 'Add new element' stays open on hovering different elements", async () => {
    // Create a container with a list with a container inside
    const listElement = createNewElement("list") as ListDocumentElement;
    listElement.config.element.__value__ = createNewElement("container");
    const containerElement = createNewElement("container");
    // There's a row in the container and a column in the row.
    // eslint-disable-next-line testing-library/no-node-access
    containerElement.children[0].children[0].children[0] = listElement;

    const { container } = renderDocumentPreview(containerElement);

    // Select a dropdown inside a Col in List and open it
    await userEvent.click(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelector(".col .col .addElement button"),
    );
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelector(".col .col .addElement button"),
    ).toHaveAttribute("aria-expanded", "true");

    // Hover over the Col in the list
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseOver(container.querySelector(".col .col"));
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelector(".col .col .addElement button"),
    ).toHaveAttribute("aria-expanded", "true");

    // Hover over the Container of the List, .root.root - is the Document root element
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseOver(container.querySelector(".root.root > .container"));
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelector(".col .col .addElement button"),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("can add an element to a container", async () => {
    const { container } = renderDocumentPreview(createNewElement("container"));

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    await userEvent.click(container.querySelector(".col .addElement button"));
    await userEvent.click(screen.getByText("Header", { selector: "a" }));

    const header = screen.getByRole("heading", { level: 1 });

    expect(header).toBeInTheDocument();
    expect(header).toHaveTextContent("Header");
  });
});

describe("Show live preview", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  function renderPreviewInTemporaryDisplayPipeline() {
    const documentElement = createNewElement("container");
    const formState = formStateFactory(undefined, [
      {
        id: DisplayTemporaryInfo.BRICK_ID,
        instanceId: uuidSequence(1),
        config: {
          title: toExpression("nunjucks", "Test Tab"),
          body: toExpression("pipeline", [
            {
              id: DocumentRenderer.BLOCK_ID,
              instanceId: uuidSequence(2),
              config: {
                body: [documentElement],
              },
            },
          ]),
        },
      },
    ]);

    const PreviewContainer = () => {
      const [activeElement, setActiveElement] = useState<string | null>(null);
      return (
        <DocumentPreview
          documentBodyName="extension.blockPipeline[0].config.body.__value__[0].config.body"
          activeElement={activeElement}
          setActiveElement={setActiveElement}
        />
      );
    };

    const pipelineField = formState.extension.blockPipeline[0].config
      .body as PipelineExpression;

    return render(<PreviewContainer />, {
      initialValues: formState,
      setupRedux(dispatch) {
        dispatch(actions.addElement(formState));
        dispatch(actions.selectElement(formState.uuid));
        dispatch(
          actions.setElementActiveNodeId(pipelineField.__value__[0].instanceId),
        );
      },
    });
  }

  test("it renders the button", async () => {
    renderPreviewInTemporaryDisplayPipeline();
    await waitForEffect();
    jest.runOnlyPendingTimers();
    expect(screen.getByText("Show Live Preview")).toBeInTheDocument();
  });
});
