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
import { useField } from "formik";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import useAsyncEffect from "use-async-effect";

const BooleanWidget: React.FC<SchemaFieldProps> = ({ name, focusInput }) => {
  const [{ value }, , { setValue }] = useField<boolean>(name);

  // Toggle the switch if it's autofocused - element ref doesn't work
  // with BootstrapSwitchButton
  useAsyncEffect(async () => {
    if (!focusInput) {
      return;
    }

    await setValue(true);
  }, [focusInput]);

  return (
    <BootstrapSwitchButton
      onlabel=" "
      offlabel=" "
      checked={value}
      onChange={setValue}
    />
  );
};

export default BooleanWidget;
