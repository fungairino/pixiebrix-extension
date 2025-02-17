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

import { EffectABC } from "@/types/bricks/effectTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import { uniq } from "lodash";
import { $safeFind } from "@/utils/domUtils";

// Adapted from https://github.com/refined-github/refined-github/blob/main/source/helpers/get-text-nodes.ts
function getTextNodes(roots: Node[]): Text[] {
  const textNodes: Text[] = [];

  for (const root of roots) {
    // `ownerDocument` is null for documents
    const nodeDocument = root.ownerDocument ?? (root as Document);
    const walker = nodeDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    let node;

    do {
      node = walker.nextNode();

      if (node) {
        textNodes.push(node as Text);
      }
    } while (node);
  }

  return uniq(textNodes);
}

/**
 * Recursively replace text in an element and its children, without modifying the structure of the document.
 */
function replaceText({
  nodes,
  pattern,
  replacement,
}: {
  nodes: Node[];
  pattern: string | RegExp;
  replacement: string;
}) {
  for (const node of getTextNodes(nodes)) {
    node.textContent = node.textContent.replaceAll(pattern, replacement);
  }
}

class ReplaceTextEffect extends EffectABC {
  constructor() {
    super(
      "@pixiebrix/html/replace-text",
      "Replace Text",
      "Replace text within an HTML document or subtree",
    );
  }

  inputSchema: Schema = {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "A string or regular expression to match",
      },
      replacement: {
        type: "string",
        description:
          "A string or replacement pattern: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_the_replacement",
      },
      isRegex: {
        type: "boolean",
        description: "Whether the pattern is a regular expression",
        default: false,
      },
      selector: {
        type: "string",
        format: "selector",
        description:
          "An optional JQuery element selector to limit replacement to document subtree(s)",
      },
    },
    required: ["pattern", "replacement"],
  };

  override async isRootAware(): Promise<boolean> {
    return true;
  }

  async effect(
    {
      pattern,
      replacement,
      selector,
      isRegex = false,
    }: BrickArgs<{
      pattern: string;
      replacement: string;
      isRegex?: boolean;
      selector?: string;
    }>,
    { root }: BrickOptions,
  ): Promise<void> {
    // Don't make replacements outside the `body`, like in `title`
    const { body } = root.ownerDocument ?? (root as Document);
    if (root.contains(body)) {
      root = body;
    }

    const $elements = selector ? $safeFind(selector, root) : $(root);

    // eslint-disable-next-line security/detect-non-literal-regexp -- regex brick
    const convertedPattern = isRegex ? new RegExp(pattern, "g") : pattern;

    replaceText({
      nodes: $elements.get(),
      pattern: convertedPattern,
      replacement,
    });
  }
}

export default ReplaceTextEffect;
