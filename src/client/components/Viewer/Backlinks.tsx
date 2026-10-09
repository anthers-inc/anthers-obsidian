// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { Link } from "react-router-dom";
import { useBacklinks } from "../../hooks/useBacklinks";
import { useSlugMap } from "../../hooks/useSlugMap";

interface BacklinksProps {
  path: string;
}

export default function Backlinks({ path }: BacklinksProps) {
  const { data } = useBacklinks(path);
  const { data: slugMap } = useSlugMap();
  const [expanded, setExpanded] = useState(true);

  const backlinks = data?.backlinks ?? [];
  if (backlinks.length === 0) return null;

  return (
    <section className="backlinks">
      <button
        className="backlinks-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="backlinks-chevron">{expanded ? "▾" : "▸"}</span>
        <span>Backlinks ({backlinks.length})</span>
      </button>
      {expanded && (
        <ul className="backlinks-list">
          {backlinks.map((bl) => {
            const slug = slugMap?.byPath[bl.source];
            return (
              <li key={bl.source} className="backlink-item">
                {slug ? (
                  <Link to={`/${slug}`} className="backlink-source">
                    {bl.sourceName}
                  </Link>
                ) : (
                  <span className="backlink-source">{bl.sourceName}</span>
                )}
                {bl.context && (
                  <span className="backlink-context">{bl.context}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
