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
import { type ComponentMeta, type ComponentStory } from "@storybook/react";
import SelectorListItem from "./SelectorListItem";

export default {
  title: "Components/SelectorListItem",
  component: SelectorListItem,
} as ComponentMeta<typeof SelectorListItem>;

const Story: ComponentStory<typeof SelectorListItem> = (args) => (
  <SelectorListItem {...args} />
);

const selector = ".main-content .container .foo.bar";

export const Plain = Story.bind({});
Plain.args = {
  value: selector,
  tag: null,
};

export const Tag = Story.bind({});
Tag.args = {
  value: selector,
  tag: "H1",
};
