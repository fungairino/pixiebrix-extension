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
import TemplateWidget, {
  type Snippet,
} from "@/pageEditor/fields/TemplateWidget";
import MultiSelectWidget from "@/pageEditor/fields/MultiSelectWidget";
import { makeLockableFieldProps } from "@/pageEditor/fields/makeLockableFieldProps";
import ExtraPermissionsSection from "@/pageEditor/tabs/ExtraPermissionsSection";
import ConnectedCollapsibleFieldSection from "@/pageEditor/fields/ConnectedCollapsibleFieldSection";
import { useField } from "formik";
import SwitchButtonWidget from "@/components/form/widgets/switchButton/SwitchButtonWidget";

const menuSnippets: Snippet[] = [{ label: "selected text", value: "%s" }];

export const contextOptions = [
  "page",
  "all",
  "frame",
  "selection",
  "link",
  "editable",
  "image",
  "video",
  "audio",
].map((value) => ({
  value,
  label: value,
}));

const ContextMenuConfiguration: React.FC<{
  isLocked: boolean;
}> = ({ isLocked = false }) => {
  const [{ value: onSuccess }] = useField("extension.onSuccess");

  return (
    <>
      <ConnectedFieldTemplate
        name="extension.title"
        label="Title"
        as={TemplateWidget}
        rows={1}
        snippets={menuSnippets}
        description={
          <span>
            The context menu item caption. Use the <code>%s</code> placeholder
            to have the browser dynamically insert the current selection in the
            menu caption
          </span>
        }
      />

      <ConnectedFieldTemplate
        name="extensionPoint.definition.contexts"
        as={MultiSelectWidget}
        options={contextOptions}
        description={
          <span>
            Limit when the Context Menu item is shown. For example, selecting
            only the <code>link</code> option will show the item only when
            right-clicking on a link.
          </span>
        }
        {...makeLockableFieldProps("Menu context", isLocked)}
      />

      <UrlMatchPatternField
        name="extensionPoint.definition.documentUrlPatterns"
        {...makeLockableFieldProps("Sites", isLocked)}
        description={
          <span>
            URL match patterns to show the menu item on. See{" "}
            <a
              href="https://developer.chrome.com/docs/extensions/mv2/match_patterns/"
              target="_blank"
              rel="noreferrer"
            >
              <code>match_patterns</code> Documentation
            </a>{" "}
            for examples.
          </span>
        }
      />
      <ConnectedCollapsibleFieldSection title="Advanced">
        <ConnectedFieldTemplate
          name="extensionPoint.definition.targetMode"
          as="select"
          title="Target Mode"
          blankValue="legacy"
          description={
            <p>
              Use&nbsp;<code>eventTarget</code> to pass the target of the
              right-click as the action root. Use&nbsp;
              <code>document</code> to pass the document as the action root.
            </p>
          }
          {...makeLockableFieldProps("Target Mode", isLocked)}
        >
          <option value="eventTarget">eventTarget</option>
          <option value="document">document</option>
          <option value="legacy">legacy</option>
        </ConnectedFieldTemplate>

        {(typeof onSuccess === "boolean" || onSuccess == null) && (
          // Punt on object-based configuration for now. Enterprise customers are just asking to turn off the message.
          // If they want a custom message they can add an alert brick.
          <ConnectedFieldTemplate
            name="extension.onSuccess"
            label="Show Success Message"
            as={SwitchButtonWidget}
            description="Show the default success message when run"
            blankValue={true}
          />
        )}

        <UrlMatchPatternField
          name="extensionPoint.definition.isAvailable.matchPatterns"
          description={
            <span>
              URL match patterns give PixieBrix access to a page without you
              first clicking the context menu. Including URLs here helps
              PixieBrix run you action quicker, and accurately detect which page
              element you clicked to invoke the context menu.
            </span>
          }
          {...makeLockableFieldProps("Automatic Permissions", isLocked)}
        />
      </ConnectedCollapsibleFieldSection>

      <ExtraPermissionsSection />
    </>
  );
};

export default ContextMenuConfiguration;
