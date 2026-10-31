import { z } from "zod";

/**
 * The venue's food menu, edited in the CRM and printed as a PDF (owner,
 * 29 Oct 2026). The defaults are the business's own menu PDF of 28 Oct 2026,
 * typed in as supplied; staff change items, prices and notes from here.
 */

const text = (max: number) => z.string().trim().max(max);

export const rateRowSchema = z.object({
  /** Serial number shown in the first column ("" for continuation rows). */
  no: text(4),
  name: text(60),
  /** One value per price column, e.g. "ANY 2", "COMMON", "—". */
  values: z.array(text(30)).max(6),
  /** A section label row (e.g. MAIN COURSE) or a highlighted row (e.g. COUNTER). */
  style: z.enum(["item", "heading", "highlight"]).default("item"),
});

export const menuGroupSchema = z.object({
  heading: text(60),
  items: z.array(text(80)).max(80),
  /** A booking's menu only: which items are picked (blue, printed) — same order as items. */
  picked: z.array(z.boolean()).max(80).optional(),
});

export const menuSectionSchema = z.object({
  title: text(60),
  subtitle: text(60),
  groups: z.array(menuGroupSchema).min(1).max(4),
});

export const foodMenuSchema = z.object({
  businessName: text(60),
  place: text(40),
  rateList: z.object({
    title: text(80),
    prices: z.array(text(20)).min(1).max(6),
    rows: z.array(rateRowSchema).max(30),
    notesLabel: text(40),
    notes: z.array(text(160)).max(12),
  }),
  footer: z.object({
    brand: text(60),
    tagline: text(80),
    contact: text(60),
  }),
  sections: z.array(menuSectionSchema).max(20),
  /** A booking's menu only: false leaves the rate-list page out of its print. */
  showRateList: z.boolean().optional(),
});

export type FoodMenu = z.infer<typeof foodMenuSchema>;

/** Download link of the menu PDF (an API route, so a plain link downloads it). */
export const FOOD_MENU_PDF_URL = "/api/food-menu/pdf";
export type MenuSection = z.infer<typeof menuSectionSchema>;

/** Download link of one booking's menu (only its picked items). */
export const bookingFoodMenuPdfUrl = (bookingId: string) =>
  `${FOOD_MENU_PDF_URL}?booking=${encodeURIComponent(bookingId)}`;

/** A venue menu copied for a booking: every item starts unpicked (red) until staff tick it. */
export function menuForBooking(menu: FoodMenu): FoodMenu {
  return {
    ...menu,
    showRateList: true,
    sections: menu.sections.map((s) => ({
      ...s,
      groups: s.groups.map((g) => ({ ...g, picked: g.items.map(() => false) })),
    })),
  };
}

/** Drops blank items (with their pick marks) before saving. */
export function cleanMenu(menu: FoodMenu): FoodMenu {
  const notes = menu.rateList.notes.map((n) => n.trim()).filter(Boolean);
  return {
    ...menu,
    rateList: { ...menu.rateList, notes },
    sections: menu.sections.map((s) => ({
      ...s,
      groups: s.groups.map((g) => {
        const keep = g.items.map((item) => item.trim() !== "");
        return {
          ...g,
          items: g.items.filter((_, k) => keep[k]).map((i) => i.trim()),
          ...(g.picked ? { picked: g.picked.filter((_, k) => keep[k]) } : {}),
        };
      }),
    })),
  };
}

/** What prints: for a booking's menu only the picked items (sections with none are left out). */
export function printableMenu(menu: FoodMenu): FoodMenu {
  const picking = menu.sections.some((s) => s.groups.some((g) => g.picked));
  const sections = menu.sections.map((s) => ({
    ...s,
    groups: s.groups.map((g) =>
      g.picked
        ? {
            heading: g.heading,
            items: g.items.filter((_, k) => g.picked?.[k] === true),
          }
        : g,
    ),
  }));
  return {
    ...menu,
    sections: picking
      ? sections
          .map((s) => ({
            ...s,
            groups: s.groups.filter((g) => g.items.length),
          }))
          .filter((s) => s.groups.length)
      : sections,
  };
}

const row = (
  no: string,
  name: string,
  values: string[],
  style: "item" | "heading" | "highlight" = "item",
) => ({ no, name, values, style });
const one = (title: string, items: string[], subtitle = ""): MenuSection => ({
  title,
  subtitle,
  groups: [{ heading: "", items }],
});

export const DEFAULT_FOOD_MENU: FoodMenu = {
  businessName: "The Sundaram Palace",
  place: "REWA",
  rateList: {
    title: "RATE LIST FOR 600 + PAX",
    prices: ["₹ 699 /-", "₹ 799 /-", "₹ 899 /-", "₹ 999 /-"],
    rows: [
      row("1", "SOUP", ["ANY 1", "ANY 2", "ANY 2", "ANY 2"]),
      row("2", "MOCKTAIL", ["—", "—", "ANY 1", "ANY 2"]),
      row("3", "STARTERS", ["ANY 2", "ANY 3", "ANY 4", "ANY 4"]),
      row("", "MAIN COURSE", [], "heading"),
      row("4", "SEASONAL VEG", ["ANY 1", "ANY 1", "ANY 2", "ANY 3"]),
      row("", "PANEER GRAVY", ["ANY 1", "ANY 1", "ANY 1", "ANY 1"]),
      row("", "DAL", ["ANY 1", "ANY 1", "ANY 1", "LIVE COUNTER"]),
      row("", "RICE", ["ANY 1", "ANY 1", "ANY 1", "LIVE COUNTER"]),
      row("", "ASSORTED BREADS", ["COMMON", "COMMON", "COMMON", "COMMON"]),
      row("", "DESSERTS", ["ANY 1", "ANY 2", "ANY 2", "ANY 3"]),
      row("5", "COUNTER", ["ANY 2", "ANY 3", "ANY 4", "ANY 5"], "highlight"),
      row("6", "MOUTH FRESHNER", ["COMMON", "COMMON", "COMMON", "PAAN LIVE"]),
    ],
    notesLabel: "Only For Menu",
    notes: [
      "This Menu Is Applicable For 600+ Pax",
      "Water Bottle are Available @ 20 Rs Extra Per Person",
      "Delhi Chaat is consist 4 counter ie:- Raj Kachori, Dahi Bhalla, Basker Chaat Aloo & Samosa Chaat + Pani Puri",
      "Premium Counter Rate @ 80/- Rs Extra Per Person",
      "Taxes Extra",
    ],
  },
  footer: {
    brand: "#CULTURE CATERING",
    tagline: "Designed - Planned - Made Memorable",
    contact: "CONTACT : 87707 56683",
  },
  sections: [
    one("SOUP AND APPITIZERS", [
      "VEG MANCHOW SOUP",
      "VEG HOT N SOUR",
      "TOMOTO BASIL",
      "LEMON CORRINDER",
      "VEG CLEAR",
      "YAKNI ALMOND SHORBA",
      "VEG JADE SOUP",
      "CORN PALAK SHORBA",
      "CREAM OF MUSHROOM",
      "LEMON MINT SOUP",
      "LEMON MINT COLLER",
      "MASALA MINT SODA",
      "BLUE SPARKLE",
      "STRAWERRY SURPRISE",
      "ASSORTED SOFT DRINKS",
      "EVIL PRINCESS",
      "PERU PYALA",
      "PINA COLADA",
      "BUBBLEGUM SURPRISE",
    ]),
    one("STARTERS", [
      "CHANNA JOR GARAM KEBEB",
      "GREEN PEAS TIKKI",
      "PAN-FRIED CHICKPEA KEBEB",
      "DAHI GULKAND KEBEB",
      "SUGAR SPANICH ROLLS",
      "GREEN BEAN KEBEB",
      "IMLI GULAB KEBEB",
      "SAFFRON MINT TIKKI",
      "PANEER GULDASTA",
      "DAHI ANJEER KEBEB",
      "LALL MIRCH PANEER TIKKA",
      "KASUNDI VEGGIES",
      "TEEKHA MARATHI KEBBE",
      "PANEER ANGARA",
      "PANNER CHEESE ROLLS",
      "MAKAI GILAFI KEBEB",
      "CORN BITES",
      "PEANUTS RAJMA TIKKI",
      "MALAI SABJ TIKKI",
      "MANGO CHUNDA KEBEB",
      "PAN FRIED CHATPATE ALOO",
      "PERU CORN KEBAB",
      "SUFIYANA PANEER TIKKA",
      "HARI MIRCH KA BHUNAPANEER",
      "SAAG CORN KEBEB",
      "METHI TIKKI",
    ]),
    one(
      "SALAD AND PAPAD",
      [
        "CURD PREPRATION",
        "CHIRONJI MUSHROOM PALAK",
        "PANEER PAKIZA",
        "PANEER ROGAN JOSH",
        "KASUNDI MIRCH ADRAKI ALOO",
        "GUCCHI KUMBH HARA PYAZ",
        "GULAB JAMUN KI SABZI",
        "MARATHI MIRCH MASALA",
        "ANAR BADAM KE ALOO",
        "ENGLISH SUBZ MASALA",
        "SAVORY TAWA",
        "MALAI DOODH MUSHROOM",
        "KHATTE CHOLE ANARDANA",
        "ANARI KOFTA CURRY",
        "DRY FRUITS TAWA PANEER",
        "PANEER HARI MIRCH KA SALAN",
        "KADAI DUM KA PANEER",
        "PANEER AKBARI",
        "PANEER ANGOOR KOFTA CURRY",
        "PANEER CORN MASALA",
        "KHADE MASALKE KA BHUNAPANNER",
        "PANEER DUM DO PAYAZA",
        "DHEKCHA PANEER",
        "MIRCH MAKAI HARA PYAZ",
        "DUM KI CHAAP",
        "JAMMU RAJMA",
        "CORN CHATKARA PALAK",
        "GOBHI ANGARA",
        "PATHHAR MUTTOR KEEMA",
        "PAN FRIED SUBZ",
        "ANGLO INDIAN BAHAR",
        "VEG KOFTA CURRY",
        "DUM ALOO",
        "SEASONAL VEG",
        "METHI CHAMAN",
        "CORN KUMBH DO PAYZA",
        "STEAM KEBEB SUBZI",
        "PANEER PALAK",
        "PANEER BETROOT",
        "BUNDELI PANNER",
        "WATER MELON PANEER",
        "COCONUT PANEER PYAZA",
        "BAMBOO PANNER",
        "PANEER SUFIYANA",
        "MUTTOR PANEER",
        "MAKHHANWALA PANNER",
      ],
      "MAIN-COURSE",
    ),
    one("DAL AND RICE", [
      "JEERA RICE",
      "VEG PULAO",
      "GHEE RICE",
      "TAWA PULAO",
      "VEG DUM BIRYANI",
      "LEMON RICE",
      "HYDERABDI BIRYANI",
      "SADA CHAWAL",
      "DHANIYA KALI MIRCH BASMATI",
      "JEERA DAL",
      "LAHSUN MIRCH DAL",
      "DAL TADKA",
      "PANCH DAL",
      "MORADABADI DAL",
      "LALLA MUSSA DAL",
      "KADI",
      "DAL MASALA",
      "DAL SUNHARI TADKA",
    ]),
    {
      title: "LIVE PREMIUM COUNTER",
      subtitle: "",
      groups: [
        {
          heading: "PUNJAB KI KHUSBOO",
          items: [
            "LALLA MUSSA DAL",
            "GHEE ROAST PANEER",
            "MARTMAAN KE CHOLEY",
            "JAMMU RAJMA",
            "KULCHEY",
            "SAAG",
            "PUNJABI KADI PAKODA",
            "PYAZ KI KHATTI MITTHI CHUTNEY",
          ],
        },
        {
          heading: "TASTE OF RAJASTHAN",
          items: [
            "SARSO BAIGAN BHARTA",
            "RAJASTHANI DAL",
            "WAAFLE",
            "GATTE KI SABJI",
            "CHANNA PULAO",
            "CHURMA",
          ],
        },
      ],
    },
    {
      title: "LIVE PREMIUM COUNTER",
      subtitle: "",
      groups: [
        {
          heading: "AAGAN",
          items: [
            "BHUNJI SABJI",
            "KHTTE BAIGAN BHARTA",
            "MEEDA",
            "CHANNA DAL",
            "GHEE RICE",
            "CHULHA ROTI",
            "ALOO BHAJI",
            "SILBATTA CHUTNEY",
            "RAS KHEER",
          ],
        },
        {
          heading: "LIVE KITCHEN",
          items: [
            "PANEER SABJI",
            "LIVE VEG GRAVY",
            "LIVE DAL",
            "LIVE RICE",
            "LIVE FULKA ROTI",
            "LIVE PAPAD",
          ],
        },
      ],
    },
    one("PREMIUM COUNTER", [
      "ASSORTED KULFI",
      "FALOODA KULFI",
      "LIVE MOCKTAIL COUNTER",
      "ASSORTED FRUIT COUNTER",
    ]),
    one("MITHAI", [
      "MAKHHAN BHOG",
      "KESAR MIL",
      "GULAB E GULKAND",
      "MAWA BAATI",
      "MANGO KHEER",
      "MOONG HALWA",
      "KHOWA JALEBI",
      "GULAB LADDU",
      "BETRROT HALWA",
      "COCONUT JALEBI CUPCAKES",
      "MUD POT",
      "ROSE KHEER",
      "KESARIYA JALEBI",
      "MILK CAKE",
      "ICE CREAM",
      "THANDAI RABDI",
      "GULAB JAMUN PAN CAKES",
      "HONEY MALPUA",
      "MANGO GUJIYA",
      "SHAHI TUKDA",
      "BASUNDI",
      "RABDI BALUSHAHI",
      "HALWA LADDU",
      "BLUEBERRY BARFI",
      "ANJEER MOONG HALWA",
      "STRAWERRY SHOTS",
    ]),
    one("LIVE COUNTER", [
      "CHAAT",
      "SEZWAN TANGO DOSA",
      "BOMBAY SOYA PAV",
      "CHINEASE CUSINE",
      "ALFREDO PASTA",
      "ARABITTA PASTA",
      "MASALA DOSA",
      "CHILLA",
      "CORN CHAAT",
      "KATHI ROLLS",
      "BOMBAY BENJO",
      "MUMBAI VADA PAV",
      "PIZZA",
      "BURGER",
      "STUFFED ROLLS",
      "BHEL COUNTER",
      "MOMOS",
      "MAGGI BHEL",
      "SEZWAN VARITY FULKI",
      "DAHI BHALLA CHAAT",
      "BOMBAY SOYA PAV",
      "POPCORN",
      "FLOOSS CANDY",
      "ASSORTED PARATHA",
      "BAMBOO BIRYANI",
      "CUTTING CHAI BAR",
      "TURKISH COFFEE",
      "ASSORTED FRIES",
      "MISSAL PAV",
    ]),
  ],
};
