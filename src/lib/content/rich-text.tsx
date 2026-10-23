import { Fragment, type ReactNode } from "react";

/**
 * Safe renderer for CMS body text (docs/architecture.md ADR-13).
 * A small Markdown subset is turned into React elements — raw HTML is never
 * interpreted, so CMS content can't inject scripts or styles.
 *
 * Supported: blank-line paragraphs, "## " and "### " headings, "- " and
 * "1. " lists, **bold**, *italic*, [link](https://…).
 */

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

export function isSafeHref(href: string): boolean {
  return SAFE_URL.test(href.trim());
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[1] !== undefined) nodes.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={key}>{match[2]}</em>);
    else if (match[3] !== undefined && match[4] !== undefined) {
      const href = match[4];
      if (isSafeHref(href)) {
        const external = /^https?:/i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            className="text-primary underline underline-offset-4"
            {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
          >
            {match[3]}
          </a>,
        );
      } else {
        nodes.push(match[3]);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: "h2" | "h3" | "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", text: heading[2] });
    } else if (bullet || numbered) {
      flush();
      const type = bullet ? "ul" : "ol";
      const text = (bullet ?? numbered)![1];
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === type) prev.items.push(text);
      else blocks.push({ type, items: [text] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  if (!blocks.length) return null;
  return (
    <div className={className ?? "text-body-lg space-y-5"}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case "h2":
            return (
              <h2 key={key} className="text-display-3 pt-4">
                {renderInline(block.text, key)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={key} className="pt-2 text-lg font-semibold">
                {renderInline(block.text, key)}
              </h3>
            );
          case "ul":
          case "ol": {
            const List = block.type;
            return (
              <List key={key} className={block.type === "ul" ? "list-disc space-y-1 pl-6" : "list-decimal space-y-1 pl-6"}>
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </List>
            );
          }
          default:
            return <p key={key}>{renderInline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}

/** Splits "one item per line" CMS fields into a list. */
export function linesOf(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

export function Lines({ source }: { source: string }) {
  return (
    <>
      {linesOf(source).map((line, i) => (
        <Fragment key={i}>
          {line}
          <br />
        </Fragment>
      ))}
    </>
  );
}
