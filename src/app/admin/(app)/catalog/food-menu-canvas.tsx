"use client";

import { Plus } from "lucide-react";
import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent,
  SetStateAction,
} from "react";

import type { FoodMenu, MenuSection } from "@/lib/menu/food-menu";
import { FOOD_MENU_PAGE_CSS, itemStyle } from "@/lib/pdf/food-menu-html";

export type MenuImages = {
  coverBg: string;
  pageTop: string;
  pageBottom: string;
};

/** Hover and focus marks for editable text; never printed (the PDF uses its own HTML). */
const EDIT_CSS = `
.fm [contenteditable] { outline: none; border-radius: 2px; cursor: text; }
.fm [contenteditable]:hover { box-shadow: 0 0 0 1px var(--color-gold); }
.fm [contenteditable]:focus { box-shadow: 0 0 0 2px var(--color-primary); background: var(--color-surface); }
.fm .tools { position: absolute; top: 4mm; right: 4mm; z-index: 3; display: flex; gap: 1.5mm; }
.fm .tool { font: 600 9pt var(--fm-sans); background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border-strong); border-radius: 4px; padding: 1mm 2.5mm; cursor: pointer; }
.fm .tool.danger { color: var(--color-danger); }
.fm .row-remove { float: right; font: 600 11pt var(--fm-sans); color: var(--color-danger); background: none; border: 0; cursor: pointer; opacity: 0; }
.fm tr:hover .row-remove, .fm .row-remove:focus { opacity: 1; }
.fm .add-page { font: 600 11pt var(--fm-sans); color: var(--color-primary); background: var(--color-surface); border: 1px dashed var(--color-primary); border-radius: 6px; padding: 3mm 8mm; cursor: pointer; }
.fm .add-item { font: inherit; font-size: 9pt; color: var(--color-primary); background: none; border: 1px dashed var(--color-primary); border-radius: 4px; padding: 0.5mm 2mm; margin-top: 2mm; cursor: pointer; }
`;

/** One editable piece of text: click, type, then click away (Enter also finishes). */
function Text({
  value,
  onChange,
  as: Tag = "span",
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: "span" | "div" | "h1" | "h2" | "h3";
  className?: string;
  style?: CSSProperties;
}) {
  const finish = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };
  return (
    <Tag
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      className={className}
      style={style}
      onKeyDown={finish}
      onBlur={(e) => {
        const next = (e.currentTarget.textContent ?? "").trim();
        if (next !== value) onChange(next);
      }}
    >
      {value}
    </Tag>
  );
}

/**
 * The menu pages as they print, with every text editable in place (like a
 * design tool, without one: plain contentEditable, no extra library). Empty
 * items are dropped when the menu is saved.
 */
export function FoodMenuCanvas({
  menu,
  setMenu,
  images,
}: {
  menu: FoodMenu;
  setMenu: Dispatch<SetStateAction<FoodMenu>>;
  images: MenuImages;
}) {
  const rate = menu.rateList;
  const setRate = (patch: Partial<FoodMenu["rateList"]>) =>
    setMenu((m) => ({ ...m, rateList: { ...m.rateList, ...patch } }));
  const setSection = (i: number, patch: Partial<MenuSection>) =>
    setMenu((m) => ({
      ...m,
      sections: m.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));
  const setItem = (i: number, g: number, k: number, value: string) =>
    setSection(i, {
      groups: menu.sections[i].groups.map((group, j) =>
        j === g
          ? {
              ...group,
              items: group.items.map((item, n) => (n === k ? value : item)),
            }
          : group,
      ),
    });
  const addItem = (i: number, g: number) =>
    setSection(i, {
      groups: menu.sections[i].groups.map((group, j) =>
        j === g ? { ...group, items: [...group.items, "NEW ITEM"] } : group,
      ),
    });
  const moveSection = (i: number, step: number) =>
    setMenu((m) => {
      const next = [...m.sections];
      const [s] = next.splice(i, 1);
      next.splice(i + step, 0, s);
      return { ...m, sections: next };
    });
  const removeSection = (i: number) =>
    setMenu((m) => ({ ...m, sections: m.sections.filter((_, j) => j !== i) }));
  const addSection = () =>
    setMenu((m) => ({
      ...m,
      sections: [
        ...m.sections,
        {
          title: "NEW PAGE",
          subtitle: "",
          groups: [{ heading: "", items: ["NEW ITEM"] }],
        },
      ],
    }));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg py-6">
      <style>{FOOD_MENU_PAGE_CSS + EDIT_CSS}</style>
      <div
        className="fm space-y-6"
        style={
          {
            "--fm-sans": "var(--font-sans)",
            "--fm-serif": "var(--font-display)",
          } as CSSProperties
        }
      >
        <section className="page cover shadow-[var(--shadow-card)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- design background (data URI) */}
          <img className="bg" src={images.coverBg} alt="" />
          <div className="content">
            <Text
              as="div"
              className="brand"
              value={menu.businessName}
              onChange={(v) => setMenu((m) => ({ ...m, businessName: v }))}
            />
            <Text
              as="div"
              className="place"
              value={menu.place}
              onChange={(v) => setMenu((m) => ({ ...m, place: v }))}
            />
            <Text
              as="div"
              className="rate-title"
              value={rate.title}
              onChange={(v) => setRate({ title: v })}
            />
            <table className="rates">
              <thead>
                <tr>
                  <th className="no">S.No</th>
                  <th className="menu">MENU</th>
                  {rate.prices.map((price, c) => (
                    <th key={c} className="price">
                      <Text
                        value={price}
                        onChange={(v) =>
                          setRate({
                            prices: rate.prices.map((p, j) =>
                              j === c ? v : p,
                            ),
                          })
                        }
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rate.rows.map((row, r) => {
                  const setRow = (patch: Partial<typeof row>) =>
                    setRate({
                      rows: rate.rows.map((x, j) =>
                        j === r ? { ...x, ...patch } : x,
                      ),
                    });
                  return (
                    <tr key={r} className={`row-${row.style}`}>
                      <td className={row.no ? "no" : undefined}>
                        <Text
                          value={row.no}
                          onChange={(v) => setRow({ no: v })}
                        />
                      </td>
                      <td className="name">
                        <Text
                          value={row.name}
                          onChange={(v) => setRow({ name: v })}
                        />
                        <button
                          type="button"
                          className="row-remove"
                          aria-label={`Remove the ${row.name || "empty"} row`}
                          onClick={() =>
                            setRate({
                              rows: rate.rows.filter((_, j) => j !== r),
                            })
                          }
                        >
                          ×
                        </button>
                      </td>
                      {rate.prices.map((_, c) =>
                        row.style === "heading" ? (
                          <td key={c} />
                        ) : (
                          <td key={c} className="val">
                            <Text
                              value={row.values[c] ?? ""}
                              onChange={(v) => {
                                const values = [...row.values];
                                values[c] = v;
                                setRow({ values });
                              }}
                            />
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              className="add-item"
              onClick={() =>
                setRate({
                  rows: [
                    ...rate.rows,
                    { no: "", name: "NEW ROW", values: [], style: "item" },
                  ],
                })
              }
            >
              <Plus className="inline size-3" aria-hidden="true" /> row
            </button>
            <div className="notes">
              <div className="notes-head">
                <span className="notes-label">Notes :</span>
                <Text
                  value={rate.notesLabel}
                  onChange={(v) => setRate({ notesLabel: v })}
                />
              </div>
              <ol>
                {rate.notes.map((note, n) => (
                  <li key={n}>
                    <Text
                      value={note}
                      onChange={(v) =>
                        setRate({
                          notes: rate.notes.map((x, j) => (j === n ? v : x)),
                        })
                      }
                    />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="add-item"
                onClick={() => setRate({ notes: [...rate.notes, "New note"] })}
              >
                <Plus className="inline size-3" aria-hidden="true" /> note
              </button>
            </div>
            <div className="footer">
              <Text
                as="div"
                className="b"
                value={menu.footer.brand}
                onChange={(v) =>
                  setMenu((m) => ({ ...m, footer: { ...m.footer, brand: v } }))
                }
              />
              <Text
                as="div"
                className="t"
                value={menu.footer.tagline}
                onChange={(v) =>
                  setMenu((m) => ({
                    ...m,
                    footer: { ...m.footer, tagline: v },
                  }))
                }
              />
              <Text
                as="div"
                className="c"
                value={menu.footer.contact}
                onChange={(v) =>
                  setMenu((m) => ({
                    ...m,
                    footer: { ...m.footer, contact: v },
                  }))
                }
              />
            </div>
          </div>
        </section>

        {menu.sections.map((section, i) => {
          const groups = section.groups;
          const plain = groups.length === 1 && !groups[0].heading;
          const single = plain && groups[0].items.length <= 6;
          const rows = plain
            ? single
              ? groups[0].items.length * 1.6
              : Math.ceil(groups[0].items.length / 2)
            : Math.max(...groups.map((g) => g.items.length), 1) + 2;
          const style = Object.fromEntries(
            itemStyle(rows)
              .split(";")
              .map((d) => d.split(":")),
          ) as Record<string, string>;
          const itemCss = {
            fontSize: style["font-size"],
            lineHeight: style["line-height"],
          };
          return (
            <section
              key={i}
              className="page section shadow-[var(--shadow-card)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- design background (data URI) */}
              <img className="top" src={images.pageTop} alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element -- design background (data URI) */}
              <img className="bottom" src={images.pageBottom} alt="" />
              <div className="tools">
                {i > 0 ? (
                  <button
                    type="button"
                    className="tool"
                    aria-label="Move this page up"
                    onClick={() => moveSection(i, -1)}
                  >
                    ↑
                  </button>
                ) : null}
                {i < menu.sections.length - 1 ? (
                  <button
                    type="button"
                    className="tool"
                    aria-label="Move this page down"
                    onClick={() => moveSection(i, 1)}
                  >
                    ↓
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tool danger"
                  onClick={() => {
                    if (window.confirm(`Remove the page “${section.title}”?`))
                      removeSection(i);
                  }}
                >
                  Remove page
                </button>
              </div>
              <div className="content">
                <Text
                  as="h1"
                  value={section.title}
                  onChange={(v) => setSection(i, { title: v })}
                />
                {section.subtitle ? (
                  <Text
                    as="h2"
                    className="sub"
                    value={section.subtitle}
                    onChange={(v) => setSection(i, { subtitle: v })}
                  />
                ) : null}
                {plain ? (
                  <div className={single ? "items single" : "items"}>
                    {groups[0].items.map((item, k) => (
                      <Text
                        key={k}
                        as="div"
                        className="item"
                        style={itemCss}
                        value={item}
                        onChange={(v) => setItem(i, 0, k, v)}
                      />
                    ))}
                    <button
                      type="button"
                      className="add-item"
                      onClick={() => addItem(i, 0)}
                    >
                      <Plus className="inline size-3" aria-hidden="true" /> item
                    </button>
                  </div>
                ) : (
                  <div className="groups">
                    {groups.map((group, g) => (
                      <div key={g}>
                        <Text
                          as="h3"
                          value={group.heading}
                          onChange={(v) =>
                            setSection(i, {
                              groups: groups.map((x, j) =>
                                j === g ? { ...x, heading: v } : x,
                              ),
                            })
                          }
                        />
                        {group.items.map((item, k) => (
                          <Text
                            key={k}
                            as="div"
                            className="item"
                            style={itemCss}
                            value={item}
                            onChange={(v) => setItem(i, g, k, v)}
                          />
                        ))}
                        <button
                          type="button"
                          className="add-item"
                          onClick={() => addItem(i, g)}
                        >
                          <Plus className="inline size-3" aria-hidden="true" />{" "}
                          item
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
        <div className="text-center">
          <button type="button" className="add-page" onClick={addSection}>
            <Plus className="inline size-4" aria-hidden="true" /> Add a page
          </button>
        </div>
      </div>
    </div>
  );
}
