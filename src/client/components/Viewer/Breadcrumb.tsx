// SPDX-License-Identifier: Apache-2.0
import { Link } from "react-router-dom";

interface BreadcrumbProps {
  path: string;
}

/** Display form of a segment: decoded, extensionless, Johnny.Decimal prefix stripped. */
function displaySegment(segment: string, isLast: boolean): string {
  const decoded = decodeURIComponent(segment);
  return isLast
    ? decoded.replace(/\.(md|base|canvas)$/, "").replace(/^\d{2}(?:-\d{2}|\.\d{2})?(?:\s-\s|\s+)/, "")
    : decoded;
}

export default function Breadcrumb({ path }: BreadcrumbProps) {
  const segments = path.split("/");

  return (
    <nav className="breadcrumb">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="breadcrumb-segment">
            {i > 0 && <span className="breadcrumb-separator">/</span>}
            {isLast ? (
              <span className="breadcrumb-current">{displaySegment(segment, true)}</span>
            ) : (
              <span className="breadcrumb-folder">{displaySegment(segment, true)}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
