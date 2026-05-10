import { useState } from "react";
import type { ImageBlockData } from "../types";

interface Props {
  block: ImageBlockData;
}

/**
 * Renders an image content block (used for user-uploaded images).
 *
 * Images arrive on the message stream as base64-encoded payloads with an
 * explicit media type (e.g. `image/png`).  We compose a `data:` URL on
 * the fly so no network fetch is involved — the bytes are already in the
 * message store.
 *
 * The thumbnail is constrained in size so a casually-pasted screenshot
 * doesn't dominate the conversation column.  Click to open the full
 * resolution in a new tab via the system image viewer (`window.open`).
 *
 * Defensive fallback: if the source object is malformed (no media_type
 * or empty data) we render a small placeholder rather than a broken
 * image element, so a glitchy upload doesn't leave a dead box.
 */
export function ImageBlock({ block }: Props) {
  const [errored, setErrored] = useState(false);
  const src = block.source;
  if (!src || src.type !== "base64" || !src.data || !src.media_type) {
    return (
      <span className="agent-image-block-placeholder" aria-label="Missing image">
        [image attachment unavailable]
      </span>
    );
  }
  const dataUrl = `data:${src.media_type};base64,${src.data}`;
  if (errored) {
    return (
      <span className="agent-image-block-placeholder" aria-label="Image failed to render">
        [image attachment failed to render]
      </span>
    );
  }
  return (
    <a
      className="agent-image-block"
      href={dataUrl}
      target="_blank"
      rel="noreferrer noopener"
      title="Open image in new tab"
    >
      <img
        src={dataUrl}
        alt="User attachment"
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
      />
    </a>
  );
}
