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
import { type InputValidationError } from "@/bricks/errors";
import JsonTree from "@/components/jsonTree/JsonTree";
import styles from "./ErrorDetail.module.scss";

const InputValidationErrorDetail: React.FunctionComponent<{
  error: InputValidationError;
}> = ({ error }) => (
  <div className={styles.root}>
    <div className={styles.column}>
      <h5>Errors</h5>
      <ul>
        {error.errors.map((x) => (
          <li key={`${x.keywordLocation}-${x.error}`}>
            {x.keywordLocation}: {x.error}
          </li>
        ))}
      </ul>
    </div>
    <div className={styles.column}>
      <h5>Rendered Args</h5>
      <JsonTree data={error.input} />
    </div>
    <div className={styles.column}>
      <h5>Schema</h5>
      <JsonTree data={error.schema} />
    </div>
  </div>
);

export default InputValidationErrorDetail;
