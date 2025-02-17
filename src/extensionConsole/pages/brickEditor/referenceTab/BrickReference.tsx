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

import styles from "./BrickReference.module.scss";

import React, { useEffect, useMemo, useState } from "react";
import {
  Col,
  Container,
  // eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
  Form,
  InputGroup,
  ListGroup,
  Row,
} from "react-bootstrap";
import Fuse from "fuse.js";
import { sortBy } from "lodash";
import Loader from "@/components/Loader";
import BrickDetail from "./BrickDetail";
import BlockResult from "./BlockResult";
import { isOfficial } from "@/bricks/util";
import { find } from "@/registry/packageRegistry";
import { brickToYaml } from "@/utils/objToYaml";
import { useGetOrganizationsQuery } from "@/services/api";
import { type Metadata } from "@/types/registryTypes";
import useAsyncState from "@/hooks/useAsyncState";

type BrickReferenceProps<T extends Metadata> = {
  bricks: T[];
  initialSelected?: T;
};

const BrickReference = ({
  bricks,
  initialSelected,
}: BrickReferenceProps<Metadata>) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Metadata>(initialSelected);
  const { data: organizations = [] } = useGetOrganizationsQuery();

  const sortedBricks = useMemo(
    () =>
      sortBy(
        bricks ?? [],
        (x) => (isOfficial(x.id) ? 0 : 1),
        (x) => x.name,
      ),
    [bricks],
  );

  useEffect(() => {
    if (sortedBricks.length > 0 && selected == null) {
      setSelected(sortedBricks[0]);
    }
  }, [sortedBricks, selected, setSelected]);

  const { data: brickConfig, isLoading: isBrickConfigLoading } =
    useAsyncState(async () => {
      if (!selected?.id) {
        return null;
      }

      const brickPackage = await find(selected.id);
      if (brickPackage?.config) {
        delete brickPackage.config.sharing;
        return brickToYaml(brickPackage.config);
      }

      return null;
    }, [selected]);

  const fuse: Fuse<Metadata> = useMemo(
    () =>
      new Fuse(sortedBricks, {
        // Prefer name, then id
        keys: ["name", "id"],
      }),
    [sortedBricks],
  );

  const results = useMemo(() => {
    let matches =
      query.trim() === ""
        ? sortedBricks
        : fuse.search(query).map((x) => x.item);

    // If a brick is selected, have it show up at the top of the list
    if (selected && selected.id === initialSelected?.id) {
      matches = [selected, ...matches.filter((x) => x.id !== selected.id)];
    }

    return matches.slice(0, 10);
  }, [selected, initialSelected, query, fuse, sortedBricks]);

  return (
    <Container className="h-100" fluid>
      <Row className="h-100">
        <Col md={4} className="h-100 px-0">
          <InputGroup className="mr-sm-2">
            <InputGroup.Prepend>
              <InputGroup.Text>Search</InputGroup.Text>
            </InputGroup.Prepend>
            <Form.Control
              id="query"
              placeholder="Start typing to find results"
              value={query}
              onChange={({ target }) => {
                setQuery(target.value);
              }}
            />
          </InputGroup>
          <ListGroup className={styles.blockResults}>
            {results.map((result) => (
              <BlockResult
                key={result.id}
                block={result}
                active={selected?.id === result.id}
                onSelect={() => {
                  setSelected(result);
                }}
                organizations={organizations}
              />
            ))}
          </ListGroup>
        </Col>
        <Col md={8} className={styles.detailColumn}>
          {selected ? (
            <BrickDetail
              brick={selected}
              brickConfig={brickConfig}
              isBrickConfigLoading={isBrickConfigLoading}
            />
          ) : (
            <div>
              <Loader />
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default BrickReference;
