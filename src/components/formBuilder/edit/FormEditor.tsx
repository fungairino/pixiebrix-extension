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

import styles from "./FormEditor.module.scss";

import { useField } from "formik";
import React, { useEffect, useMemo } from "react";
import {
  type RJSFSchema,
  type SelectStringOption,
  type SetActiveField,
} from "@/components/formBuilder/formBuilderTypes";
import { Button, Col, Row } from "react-bootstrap";
import FieldEditor from "./FieldEditor";
import {
  DEFAULT_FIELD_TYPE,
  generateNewPropertyName,
  moveStringInArray,
  normalizeSchema,
  getNormalizedUiOrder,
  replaceStringInArray,
} from "@/components/formBuilder/formBuilderHelpers";
import { UI_ORDER } from "@/components/formBuilder/schemaFieldNames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { type Schema } from "@/types/schemaTypes";
import { produce } from "immer";
import FieldTemplate from "@/components/form/FieldTemplate";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import LayoutWidget from "@/components/LayoutWidget";
import { findLast } from "lodash";
import { joinName } from "@/utils/formUtils";

export type FormEditorProps = {
  /**
   * The Formik name of the form field.
   */
  name: string;
  /**
   * If true, the form title and description fields will be shown (default: true).
   */
  showFormIntroFields?: boolean;
  activeField?: string;
  setActiveField: SetActiveField;
  fieldTypes?: SelectStringOption[];
};

/**
 * Form introductory fields for the form title and description.
 * @constructor
 */
export const FormIntroFields: React.FunctionComponent<{ name: string }> = ({
  name,
}) => {
  const { titleFieldProps, descriptionFieldProps } = useMemo(() => {
    const titleFieldProps: SchemaFieldProps = {
      name: joinName(name, "schema", "title"),
      schema: { type: "string" },
      label: "Form Title",
      description: "The form title to display",
    };
    const descriptionFieldProps: SchemaFieldProps = {
      name: joinName(name, "schema", "description"),
      schema: { type: "string" },
      label: "Form Description",
      description:
        "Form description or instructions. Supports [Markdown](https://docs.pixiebrix.com/developing-mods/developer-concepts/working-with-markdown)",
    };

    return { titleFieldProps, descriptionFieldProps };
  }, [name]);

  return (
    <>
      <SchemaField {...titleFieldProps} />
      <SchemaField {...descriptionFieldProps} />
    </>
  );
};

const FormEditor: React.FC<FormEditorProps> = ({
  name,
  showFormIntroFields = true,
  activeField,
  setActiveField,
  fieldTypes,
}) => {
  const [
    { value: rjsfSchema = {} as RJSFSchema },
    ,
    { setValue: setRjsfSchema },
  ] = useField<RJSFSchema>(name);
  const [{ value: uiOrder }, , { setValue: setUiOrder }] = useField<string[]>(
    joinName(name, "uiSchema", UI_ORDER),
  );

  const { schema, uiSchema } = rjsfSchema;

  // Select the active field when FormEditor field changes
  useEffect(
    () => {
      // Trust that activeField changes properly with the schema name
      if (activeField != null) {
        return;
      }

      // eslint-disable-next-line security/detect-object-injection -- UI_ORDER is a known field
      const firstInOrder = uiSchema?.[UI_ORDER]?.[0];
      if (firstInOrder && firstInOrder !== "*") {
        setActiveField(firstInOrder);
        return;
      }

      const firstInProperties = Object.keys(schema?.properties ?? {})[0];
      if (firstInProperties) {
        setActiveField(firstInProperties);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetting activeField only on new name
    [name],
  );

  const propertyKeys = Object.keys(schema?.properties ?? {});

  const addProperty = async () => {
    const propertyName = generateNewPropertyName(propertyKeys);
    const newProperty: Schema = {
      title: propertyName,
      type: DEFAULT_FIELD_TYPE,
    };
    const nextUiOrder = activeField
      ? replaceStringInArray(
          getNormalizedUiOrder(propertyKeys, uiOrder),
          activeField,
          activeField,
          propertyName,
        )
      : replaceStringInArray(
          getNormalizedUiOrder(propertyKeys, uiOrder),
          "*",
          propertyName,
          "*",
        );

    const nextRjsfSchema = produce(rjsfSchema, (draft) => {
      normalizeSchema(draft);

      // eslint-disable-next-line security/detect-object-injection -- prop name is generated
      draft.schema.properties[propertyName] = newProperty;

      if (!uiSchema) {
        draft.uiSchema = {};
      }

      // eslint-disable-next-line security/detect-object-injection -- prop name is a constant
      draft.uiSchema[UI_ORDER] = nextUiOrder;
    });
    await setRjsfSchema(nextRjsfSchema);
    setActiveField(propertyName);
  };

  const moveProperty = async (direction: "up" | "down") => {
    const nextUiOrder = moveStringInArray(
      getNormalizedUiOrder(propertyKeys, uiOrder),
      activeField,
      direction,
    );
    await setUiOrder(nextUiOrder);
  };

  const removeProperty = async () => {
    const propertyToRemove = activeField;
    const nextUiOrder = replaceStringInArray(
      getNormalizedUiOrder(propertyKeys, uiOrder),
      propertyToRemove,
    );
    const nextActiveField = nextUiOrder.length > 1 ? nextUiOrder[0] : undefined;

    setActiveField(nextActiveField);

    const nextRjsfSchema = produce(rjsfSchema, (draft) => {
      normalizeSchema(draft);

      if (schema.required?.length > 0) {
        draft.schema.required = replaceStringInArray(
          schema.required,
          propertyToRemove,
        );
      }

      // eslint-disable-next-line security/detect-object-injection
      delete draft.schema.properties[propertyToRemove];

      if (!uiSchema) {
        draft.uiSchema = {};
      }

      // eslint-disable-next-line security/detect-object-injection -- prop name is a constant
      draft.uiSchema[UI_ORDER] = nextUiOrder;
      // eslint-disable-next-line security/detect-object-injection
      delete draft.uiSchema[propertyToRemove];
    });

    await setRjsfSchema(nextRjsfSchema);
  };

  // The uiOrder field may not be initialized yet
  const order = uiOrder ?? ["*"];
  const canMoveUp =
    Boolean(activeField) &&
    (order.length > 2
      ? order[0] !== activeField
      : propertyKeys[0] !== activeField);
  const canMoveDown =
    Boolean(activeField) &&
    (order.length === propertyKeys.length + 1
      ? order.at(-2) !== activeField
      : Array.isArray(order) &&
        findLast(propertyKeys, (key) => !order.includes(key)) !== activeField);

  return (
    <>
      {showFormIntroFields && (
        <>
          <FormIntroFields name={name} />
          <hr />
        </>
      )}
      <Row className={styles.addRow}>
        <Col>
          <Button onClick={addProperty} variant="primary" size="sm">
            <FontAwesomeIcon icon={faPlus} /> Add new field
          </Button>
        </Col>
      </Row>

      <Row className={styles.currentFieldRow}>
        <Col xl="3" className={styles.currentField}>
          <h6>Current Field</h6>
        </Col>
        {activeField && (
          <Col xl>
            <Button onClick={removeProperty} variant="danger" size="sm">
              <FontAwesomeIcon icon={faTrash} /> Remove field
            </Button>
          </Col>
        )}
        <Col xl>
          <small className="text-muted">
            Use the Preview Tab on the right to select a field to edit ⟶
          </small>
        </Col>
      </Row>

      {activeField && Boolean(schema?.properties?.[activeField]) && (
        <FieldEditor
          name={name}
          propertyName={activeField}
          setActiveField={setActiveField}
          fieldTypes={fieldTypes}
        />
      )}

      {activeField && (canMoveUp || canMoveDown) && (
        <FieldTemplate
          name="layoutButtons"
          label="Field Order"
          as={LayoutWidget}
          canMoveUp={canMoveUp}
          moveUp={async () => {
            await moveProperty("up");
          }}
          canMoveDown={canMoveDown}
          moveDown={async () => {
            await moveProperty("down");
          }}
        />
      )}
    </>
  );
};

export default FormEditor;
