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
import ErrorIcon from "@/icons/error.svg?loadAsComponent";
import WarningIcon from "@/icons/warning.svg?loadAsComponent";
import InfoIcon from "@/icons/info.svg?loadAsComponent";
import cx from "classnames";
import styles from "./FieldAnnotationAlert.module.scss";
import AsyncButton from "@/components/AsyncButton";
import { AnnotationType } from "@/types/annotationTypes";
import { type FieldAnnotation } from "@/components/form/FieldAnnotation";

const FieldAnnotationAlert: React.FunctionComponent<
  FieldAnnotation & { className?: string }
> = ({ message, type, actions, className }) => {
  let Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  switch (type) {
    case AnnotationType.Error: {
      Icon = ErrorIcon;
      break;
    }

    case AnnotationType.Warning: {
      Icon = WarningIcon;
      break;
    }

    case AnnotationType.Info: {
      Icon = InfoIcon;
      break;
    }

    default: {
      throw new Error(`Unsupported annotation type: ${type}`);
    }
  }

  return (
    // eslint-disable-next-line security/detect-object-injection -- annotation type, not user input
    <div className={cx(styles.root, styles[type], className)}>
      <div className={styles.alert}>
        {Icon && <Icon className={styles.icon} />}
        <div className={styles.message}>
          <span>{message}</span>
        </div>
      </div>
      {actions?.length ? (
        <div className={styles.actions}>
          {actions.map(({ caption, action }, index) => (
            <AsyncButton key={index} onClick={action}>
              {caption}
            </AsyncButton>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FieldAnnotationAlert;
