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

import styles from "./EditorNodeConfigPanel.module.scss";

import React from "react";
import { Col, Row } from "react-bootstrap";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import BrickConfiguration from "@/pageEditor/tabs/effect/BrickConfiguration";
import blockRegistry from "@/bricks/registry";
import { showOutputKey } from "@/pageEditor/tabs/editTab/editHelpers";
import KeyNameWidget from "@/components/form/widgets/KeyNameWidget";
import getType from "@/runtime/getType";
import PopoverInfoLabel from "@/components/form/popoverInfoLabel/PopoverInfoLabel";
import AnalysisResult from "@/pageEditor/tabs/editTab/AnalysisResult";
import { useSelector } from "react-redux";
import { selectActiveNodeInfo } from "@/pageEditor/slices/editorSelectors";
import { useGetMarketplaceListingsQuery } from "@/services/api";
import cx from "classnames";
import { MARKETPLACE_URL } from "@/urlConstants";
import CommentsPreview from "@/pageEditor/tabs/editTab/editorNodeConfigPanel/CommentsPreview";
import useAsyncState from "@/hooks/useAsyncState";

const EditorNodeConfigPanel: React.FC = () => {
  const {
    blockId: brickId,
    path: brickFieldName,
    blockConfig: { comments },
  } = useSelector(selectActiveNodeInfo);
  const { data: brickInfo } = useAsyncState(async () => {
    const brick = await blockRegistry.lookup(brickId);
    return {
      block: brick,
      type: await getType(brick),
    };
  }, [brickId]);

  const { data: listings = {} } = useGetMarketplaceListingsQuery({
    package__name: brickId,
  });

  const { instructions: listingInstructions, id: listingId } =
    listings[brickId] ?? {};

  const isOutputDisabled = !(
    brickInfo === null || showOutputKey(brickInfo?.type)
  );
  const outputDescription = isOutputDisabled
    ? "Effect and renderer bricks do not produce outputs"
    : "Provide an output variable name to refer to the outputs of this brick later.";

  const PopoverOutputLabel = (
    <PopoverInfoLabel
      name="output-label"
      label="Output"
      description={outputDescription}
    />
  );

  const showDocumentationLink = listingInstructions && listingId;

  return (
    <>
      <AnalysisResult />
      <Row className={cx(styles.brickInfo, "justify-content-between")}>
        <Col>
          <p>{brickInfo?.block.name}</p>
        </Col>
        {showDocumentationLink && (
          <Col xs="auto">
            <a
              href={`${MARKETPLACE_URL}${listingId}/?utm_source=pixiebrix&utm_medium=page_editor&utm_campaign=docs&utm_content=view_docs_link`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Documentation
            </a>
          </Col>
        )}
      </Row>
      <Row className={styles.topRow}>
        <Col xl>
          <ConnectedFieldTemplate
            name={`${brickFieldName}.label`}
            label="Step Name"
            fitLabelWidth
            placeholder={brickInfo?.block.name}
          />
        </Col>
        <Col xl>
          <ConnectedFieldTemplate
            name={`${brickFieldName}.outputKey`}
            label={PopoverOutputLabel}
            fitLabelWidth
            disabled={isOutputDisabled}
            as={KeyNameWidget}
          />
        </Col>
      </Row>
      {comments && <CommentsPreview comments={comments} />}

      <BrickConfiguration name={brickFieldName} brickId={brickId} />
    </>
  );
};

export default EditorNodeConfigPanel;
