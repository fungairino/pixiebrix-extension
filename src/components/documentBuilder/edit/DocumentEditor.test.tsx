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

import { useFormikContext } from "formik";
import React from "react";
import { createNewElement } from "@/components/documentBuilder/createNewElement";
import { type DocumentElement } from "@/components/documentBuilder/documentBuilderTypes";
import DocumentEditor from "./DocumentEditor";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import userEvent from "@testing-library/user-event";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { validateRegistryId } from "@/types/helpers";
import { render, screen } from "@/pageEditor/testHelpers";
import { actions } from "@/pageEditor/slices/editorSlice";
import { type IntegrationDependency } from "@/integrations/integrationTypes";

import { uuidSequence } from "@/testUtils/factories/stringFactories";
import {
  baseExtensionStateFactory,
  formStateFactory,
} from "@/testUtils/factories/pageEditorFactories";
import { brickConfigFactory } from "@/testUtils/factories/brickFactories";
import { integrationDependencyFactory } from "@/testUtils/factories/integrationFactories";
import { validateOutputKey } from "@/runtime/runtimeTypes";
import { toExpression } from "@/utils/expressionUtils";

beforeAll(() => {
  registerDefaultWidgets();
});

describe("move element", () => {
  function renderDocumentEditor(
    documentElements: DocumentElement[],
    initialActiveElement: string = null,
  ) {
    const formState = formStateFactory({
      extension: baseExtensionStateFactory({
        blockPipeline: [
          brickConfigFactory({
            config: {
              body: documentElements,
            },
          }),
        ],
      }),
    });

    return render(
      <DocumentEditor documentBodyName="extension.blockPipeline.0.config.body" />,
      {
        initialValues: formState,
        setupRedux(dispatch) {
          dispatch(actions.addElement(formState));
          dispatch(actions.selectElement(formState.uuid));
          dispatch(
            actions.setElementActiveNodeId(
              formState.extension.blockPipeline[0].instanceId,
            ),
          );
          dispatch(actions.setNodePreviewActiveElement(initialActiveElement));
        },
      },
    );
  }

  test("can move text element down", async () => {
    const documentElements = [
      createNewElement("text"),
      createNewElement("text"),
    ];
    documentElements[0].config.text = "test text 1";
    documentElements[1].config.text = "test text 2";
    renderDocumentEditor(documentElements, "0");

    // The first text element is active
    expect(screen.getByText("test text 1")).toBeInTheDocument();

    await userEvent.click(
      screen.getByText("Move down", { selector: "button" }),
    );

    // The element is still active
    expect(screen.getByText("test text 1")).toBeInTheDocument();

    // Now can move the element up
    expect(
      screen.getByText("Move up", { selector: "button" }),
    ).not.toBeDisabled();

    // Can't move it further down
    expect(
      screen.getByText("Move down", { selector: "button" }),
    ).toBeDisabled();
  });

  test("can move text element up", async () => {
    const documentElements = [
      createNewElement("text"),
      createNewElement("text"),
    ];
    documentElements[0].config.text = "test text 1";
    documentElements[1].config.text = "test text 2";
    renderDocumentEditor(documentElements, "1");

    // The second text element is active
    expect(screen.getByText("test text 2")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Move up", { selector: "button" }));

    // The element is still active
    expect(screen.getByText("test text 2")).toBeInTheDocument();

    // Can't move the element up
    expect(screen.getByText("Move up", { selector: "button" })).toBeDisabled();

    // Can move it down
    expect(
      screen.getByText("Move down", { selector: "button" }),
    ).not.toBeDisabled();
  });
});

describe("remove element", () => {
  /**
   * Renders the DocumentEditor inside Formik context.
   * @returns Rendered result and reference to the current Formik state.
   */
  function renderDocumentEditorWithFormState(
    formState: ModComponentFormState,
    initialActiveElement: string = null,
  ) {
    const formikStateRef = {
      current: formState,
    };

    const WrappedEditor = () => {
      const { values } = useFormikContext<ModComponentFormState>();
      formikStateRef.current = values;

      return (
        <DocumentEditor documentBodyName="extension.blockPipeline.0.config.body" />
      );
    };

    return render(<WrappedEditor />, {
      initialValues: formState,
      setupRedux(dispatch) {
        dispatch(actions.addElement(formState));
        dispatch(actions.selectElement(formState.uuid));
        dispatch(
          actions.setElementActiveNodeId(
            formState.extension.blockPipeline[0].instanceId,
          ),
        );
        dispatch(actions.setNodePreviewActiveElement(initialActiveElement));
      },
    });
  }

  test("removes integration dependency", async () => {
    // Integration dependencies included in the form state
    const integrationDependencies: IntegrationDependency[] = [
      integrationDependencyFactory({
        integrationId: validateRegistryId("@test/service"),
        outputKey: validateOutputKey("serviceOutput"),
        configId: uuidSequence,
      }),
    ];

    // Document brick definition
    const documentWithButtonConfig = {
      body: [
        {
          type: "button",
          config: {
            title: "Action",
            onClick: toExpression("pipeline", [
              {
                id: validateRegistryId("@test/action"),
                instanceId: uuidSequence(2),
                config: {
                  input: toExpression("var", "@serviceOutput"),
                },
              },
            ]),
          },
        },
      ],
    };

    // Form state for the test
    const formState = formStateFactory({
      integrationDependencies,
      extension: baseExtensionStateFactory({
        blockPipeline: [
          brickConfigFactory({ config: documentWithButtonConfig }),
        ],
      }),
    });

    const { getFormState } = renderDocumentEditorWithFormState(formState, "0");

    await userEvent.click(screen.getByText("Remove element"));

    expect(getFormState().integrationDependencies).toStrictEqual([]);
  });
});
