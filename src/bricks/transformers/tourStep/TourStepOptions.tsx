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

import React, { type ChangeEvent } from "react";
import { type BlockOptionProps } from "@/components/fields/schemaFields/genericOptionsFactory";
import { partial } from "lodash";
import { Card } from "react-bootstrap";
import TourStepTransformer, {
  type StepInputs,
  StepSchema,
} from "@/bricks/transformers/tourStep/tourStep";
import { useField, useFormikContext } from "formik";
import { type Expression } from "@/types/runtimeTypes";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import SwitchButtonWidget, {
  type CheckBoxLike,
} from "@/components/form/widgets/switchButton/SwitchButtonWidget";
import FieldTemplate from "@/components/form/FieldTemplate";
import { createNewConfiguredBrick } from "@/pageEditor/exampleBrickConfigs";
import { DocumentRenderer } from "@/bricks/renderers/document";
import { isPipelineExpression, toExpression } from "@/utils/expressionUtils";
import { joinName } from "@/utils/formUtils";
import { getSubSchema } from "@/utils/schemaUtils";
import PipelineToggleField from "@/pageEditor/fields/PipelineToggleField";

import styles from "./TourStepOptions.module.scss";

const Section: React.FunctionComponent<{ title: string }> = ({
  title,
  children,
}) => (
  <>
    <Card.Header className={styles.sectionHeader}>{title}</Card.Header>
    <Card.Body>{children}</Card.Body>
  </>
);

const TourStepOptions: React.FunctionComponent<BlockOptionProps> = ({
  name,
  configKey,
}) => {
  const { setFieldValue } = useFormikContext<ModComponentFormState>();

  const configName = partial(joinName, name, configKey);
  const schemaFieldProps = (...parts: string[]) => ({
    name: configName(...parts),
    schema: getSubSchema(StepSchema, joinName(null, ...parts)),
  });

  const [{ value: body }] = useField<Expression>(configName("body"));
  const [{ value: appearance }] = useField<StepInputs["appearance"] | null>(
    configName("appearance"),
  );

  return (
    <>
      <SchemaField
        name={configName("title")}
        label="Step Title"
        {...schemaFieldProps("title")}
        isRequired
      />

      <SchemaField label="Target Selector" {...schemaFieldProps("selector")} />

      <Card>
        <Section title="Step Body">
          <FieldTemplate
            as={SwitchButtonWidget}
            label="Custom Body"
            description="Toggle on to provide a renderer brick for the step body. Edit the body in the Outline Panel"
            name={configName("body")}
            value={isPipelineExpression(body)}
            onChange={async ({ target }: ChangeEvent<CheckBoxLike>) => {
              if (target.value) {
                await setFieldValue(
                  configName("body"),
                  toExpression("pipeline", [
                    createNewConfiguredBrick(DocumentRenderer.BLOCK_ID, {
                      parentBrickId: TourStepTransformer.BRICK_ID,
                    }),
                  ]),
                );
                await setFieldValue(
                  configName("appearance", "refreshTrigger"),
                  "manual",
                );
              } else {
                await setFieldValue(
                  configName("body"),
                  toExpression(
                    "nunjucks",
                    "Enter step content, supports **markdown**",
                  ),
                );
              }
            }}
          />

          {isPipelineExpression(body) && (
            <SchemaField
              label="Auto Refresh"
              {...schemaFieldProps("appearance", "refreshTrigger")}
              isRequired
            />
          )}

          {!isPipelineExpression(body) && (
            <SchemaField
              label="Body"
              name={configName("body")}
              isRequired
              schema={{
                type: "string",
                format: "markdown",
                description: "Content of the step, supports markdown",
              }}
            />
          )}
        </Section>

        <Section title="Targeting Behavior">
          <FieldTemplate
            as={SwitchButtonWidget}
            label="Wait for Target"
            description="Wait for the target element to be added to the page"
            name={configName("appearance", "wait")}
            value={Boolean(appearance?.wait)}
            onChange={async ({ target }: ChangeEvent<CheckBoxLike>) => {
              if (target.value) {
                await setFieldValue(configName("appearance", "wait"), {
                  maxWaitMillis: 0,
                });
              } else {
                await setFieldValue(configName("appearance", "wait"), null);
              }
            }}
          />

          {appearance.wait && (
            <SchemaField
              label="Max Wait Time (ms)"
              {...schemaFieldProps("appearance", "wait", "maxWaitMillis")}
            />
          )}

          <SchemaField
            label="Skippable"
            {...schemaFieldProps("appearance", "skippable")}
            isRequired
          />
        </Section>

        <Section title="Step Actions">
          <PipelineToggleField
            label="Pre-Step Actions"
            description="Toggle on to run actions before the step is shown. Edit the actions in the Outline Panel"
            name={configName("onBeforeShow")}
          />

          <PipelineToggleField
            label="Post-Step Actions"
            description="Toggle on to run actions after the step is completed. Edit the actions in the Outline Panel"
            name={configName("onAfterShow")}
          />
        </Section>

        <Section title="Step Controls">
          <SchemaField
            label="Outside Click Behavior"
            {...schemaFieldProps("appearance", "controls", "outsideClick")}
          />

          <SchemaField
            label="Close Button Behavior"
            {...schemaFieldProps("appearance", "controls", "closeButton")}
          />

          <SchemaField label="Last Step?" {...schemaFieldProps("isLastStep")} />

          <SchemaField
            label="Actions"
            {...schemaFieldProps("appearance", "controls", "actions")}
          />
        </Section>

        <Section title="Scroll Behavior">
          <FieldTemplate
            as={SwitchButtonWidget}
            label="Scroll to Element"
            description="Toggle on to automatically scroll to the element"
            name={configName("appearance", "scroll")}
            value={Boolean(appearance?.scroll)}
            onChange={async ({ target }: ChangeEvent<CheckBoxLike>) => {
              if (target.value) {
                await setFieldValue(configName("appearance", "scroll"), {
                  behavior: "auto",
                });
              } else {
                await setFieldValue(configName("appearance", "scroll"), null);
              }
            }}
          />

          {appearance?.scroll && (
            <SchemaField
              label="Scroll Behavior"
              {...schemaFieldProps("appearance", "scroll", "behavior")}
            />
          )}
        </Section>

        <Section title="Highlight Behavior">
          <SchemaField
            label="Highlight Color"
            {...schemaFieldProps("appearance", "highlight", "backgroundColor")}
          />
        </Section>

        <Section title="Overlay Behavior">
          <SchemaField
            label="Show Overlay"
            {...schemaFieldProps("appearance", "showOverlay")}
          />
        </Section>

        <Section title="Popover Behavior">
          <SchemaField
            label="Placement"
            {...schemaFieldProps("appearance", "popover", "placement")}
          />
        </Section>
      </Card>
    </>
  );
};

export default TourStepOptions;
