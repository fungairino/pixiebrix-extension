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
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import UrlMatchPatternField from "@/pageEditor/fields/UrlMatchPatternField";
import LocationWidget from "@/pageEditor/fields/LocationWidget";
import { useField, useFormikContext } from "formik";
import { type TriggerFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { getDefaultReportModeForTrigger } from "@/starterBricks/triggerExtension";
import { makeLockableFieldProps } from "@/pageEditor/fields/makeLockableFieldProps";
import BooleanWidget from "@/components/fields/schemaFields/widgets/BooleanWidget";
import { partial } from "lodash";
import MatchRulesSection from "@/pageEditor/tabs/MatchRulesSection";
import DebounceFieldSet from "@/pageEditor/tabs/trigger/DebounceFieldSet";
import { type DebounceOptions } from "@/starterBricks/types";
import ExtraPermissionsSection from "@/pageEditor/tabs/ExtraPermissionsSection";
import { type Trigger } from "@/starterBricks/triggerExtensionTypes";
import { useSelector } from "react-redux";
import { selectExtensionKnownEventNames } from "@/pageEditor/slices/editorSelectors";
import SchemaSelectWidget from "@/components/fields/schemaFields/widgets/SchemaSelectWidget";
import { joinName } from "@/utils/formUtils";

function supportsSelector(trigger: Trigger) {
  return !["load", "interval", "selectionchange", "statechange"].includes(
    trigger,
  );
}

function supportsTargetMode(trigger: Trigger) {
  // XXX: why doesn't `appear` support target mode?
  return supportsSelector(trigger) && trigger !== "appear";
}

const TriggerConfiguration: React.FC<{
  isLocked: boolean;
}> = ({ isLocked = false }) => {
  const fieldName = partial(joinName, "extensionPoint.definition");

  const [{ value: trigger }] = useField<Trigger>(fieldName("trigger"));

  const [{ value: debounce }] = useField<DebounceOptions | null>(
    fieldName("debounce"),
  );

  const { setFieldValue } = useFormikContext<TriggerFormState>();

  const knownEventNames = useSelector(selectExtensionKnownEventNames);

  const onTriggerChange = ({
    currentTarget,
  }: React.FormEvent<HTMLSelectElement>) => {
    const nextTrigger = currentTarget.value as Trigger;

    if (!supportsSelector(nextTrigger)) {
      void setFieldValue(fieldName("rootSelector"), null);
      void setFieldValue(fieldName("attachMode"), null);
    }

    if (!supportsTargetMode(nextTrigger)) {
      void setFieldValue(fieldName("targetMode"), null);
    }

    if (nextTrigger !== "interval") {
      void setFieldValue(fieldName("intervalMillis"), null);
      void setFieldValue(fieldName("background"), null);
    }

    if (nextTrigger === "custom") {
      void setFieldValue(fieldName("customEvent"), { eventName: "" });
    } else {
      void setFieldValue(fieldName("customEvent"), null);
    }

    void setFieldValue(
      fieldName("reportMode"),
      getDefaultReportModeForTrigger(nextTrigger),
    );

    if (nextTrigger === "selectionchange" && debounce == null) {
      // Add debounce by default, because the selection event fires for every event when clicking and dragging
      void setFieldValue(fieldName("debounce"), {
        waitMillis: 250,
        leading: false,
        trailing: true,
      });
    }

    void setFieldValue(fieldName("trigger"), currentTarget.value);
  };

  return (
    <>
      <ConnectedFieldTemplate
        name={fieldName("trigger")}
        as="select"
        description="Select a browser event to trigger or launch this mod"
        onChange={onTriggerChange}
        {...makeLockableFieldProps("Trigger Event", isLocked)}
      >
        <option value="load">Page Load / Navigation</option>
        <option value="interval">Interval</option>
        <option value="initialize">Initialize</option>
        <option value="appear">Appear</option>
        <option value="click">Click</option>
        <option value="dblclick">Double Click</option>
        <option value="blur">Blur</option>
        <option value="mouseover">Mouseover</option>
        <option value="hover">Hover</option>
        <option value="selectionchange">Selection Change</option>
        <option value="keydown">Keydown</option>
        <option value="keyup">Keyup</option>
        <option value="keypress">Keypress</option>
        <option value="change">Change</option>
        <option value="statechange">State Change</option>
        <option value="custom">Custom Event</option>
      </ConnectedFieldTemplate>

      {trigger === "custom" && (
        <ConnectedFieldTemplate
          title="Custom Event"
          description="The custom event name. Select an event from this Mod, or type a new event name"
          name={fieldName("customEvent", "eventName")}
          {...makeLockableFieldProps("Custom Event", isLocked)}
          as={SchemaSelectWidget}
          schema={{
            type: "string",
            examples: knownEventNames,
          }}
        />
      )}

      {trigger === "interval" && (
        <ConnectedFieldTemplate
          name={fieldName("intervalMillis")}
          title="Interval (ms)"
          type="number"
          description="Interval to run the trigger in milliseconds"
          {...makeLockableFieldProps("Interval", isLocked)}
        />
      )}

      <ConnectedFieldTemplate
        name={fieldName("background")}
        title="Run in Background"
        as={BooleanWidget}
        description="Run the trigger in inactive tabs."
        {...makeLockableFieldProps("Run in Background", isLocked)}
      />

      {supportsSelector(trigger) && (
        <>
          <ConnectedFieldTemplate
            name={fieldName("rootSelector")}
            as={LocationWidget}
            selectMode="element"
            description="Use your cursor to select an element on the page to watch"
            {...makeLockableFieldProps("Element Selector", isLocked)}
          />

          <ConnectedFieldTemplate
            name={fieldName("attachMode")}
            as="select"
            title="Attach Mode"
            description={
              <p>
                Use&nbsp;<code>once</code> to attach the trigger once one or
                more elements are available. Use&nbsp;
                <code>watch</code> to also add the trigger as new matching
                elements are added to the page.
              </p>
            }
            {...makeLockableFieldProps("Attach Mode", isLocked)}
          >
            <option value="once">Once</option>
            <option value="watch">Watch</option>
          </ConnectedFieldTemplate>
        </>
      )}

      {supportsTargetMode(trigger) && (
        <ConnectedFieldTemplate
          name={fieldName("targetMode")}
          as="select"
          title="Target Mode"
          description={
            <p>
              Use <code>eventTarget</code> to use the event target as the root
              element for brick execution. Use&nbsp;
              <code>root</code> to use the closest ancestor element matching the
              trigger&apos;s selector.
            </p>
          }
          {...makeLockableFieldProps("Target Mode", isLocked)}
        >
          <option value="eventTarget">eventTarget</option>
          <option value="root">root</option>
        </ConnectedFieldTemplate>
      )}

      <DebounceFieldSet isLocked={isLocked} />

      <UrlMatchPatternField
        name={fieldName("isAvailable", "matchPatterns")}
        {...makeLockableFieldProps("Sites", isLocked)}
      />

      <ConnectedFieldTemplate
        name={fieldName("showErrors")}
        as={BooleanWidget}
        title="Show Error Notifications"
        description={
          <p>Show an error to the mod user if the trigger fails to execute.</p>
        }
        {...makeLockableFieldProps("Show Error Notifications", isLocked)}
      />

      <ConnectedFieldTemplate
        name={fieldName("reportMode")}
        as="select"
        title="Telemetry Mode"
        description={
          <p>
            Events/errors to report telemetry. Select &ldquo;Report All Events
            and Errors&rdquo; to report all runs and errors. Select
            &ldquo;Report First Event and Error&rdquo; to only report the first
            run and first error.
          </p>
        }
        {...makeLockableFieldProps("Telemetry Mode", isLocked)}
      >
        <option value="all">Report All Events and Errors</option>
        <option value="once">Report First Event and Error</option>
      </ConnectedFieldTemplate>

      <MatchRulesSection isLocked={isLocked} />

      <ExtraPermissionsSection />
    </>
  );
};

export default TriggerConfiguration;
