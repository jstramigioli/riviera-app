"""One-shot: parse Excel 202526 → menu-202526.json. Not used at runtime."""
import json
import re
import sys
from pathlib import Path

import openpyxl

EXCEL = Path(
    r"C:\Users\julii\AppData\Local\Cursor\AgentStores\cursor_agent_stores"
    r"\bc-04f1ca1f-09c2-4eb6-9b5f-83c5b6a47bda\files\docs\menu-precios.xlsx"
)
OUT = Path(__file__).with_name("menu-202526.json")

SECTION_MAP = {
    "cafetería": "CAFETERIA",
    "cafeteria": "CAFETERIA",
    "pastelería": "CAFETERIA",
    "pasteleria": "CAFETERIA",
    "licuados": "CAFETERIA",
    "ensaladas": "MINUTAS",
    "mermeladas": "MINUTAS",
    "carnes": "MINUTAS",
    "pescados": "MINUTAS",
    "pastas": "MINUTAS",
    "salsas": "MINUTAS",
    "postres": "MINUTAS",
    "bebidas sin alcohol": "BEBIDAS",
    "bebidas con alcohol": "BEBIDAS",
    "vinos": "BEBIDAS",
    "espumoso": "BEBIDAS",
    "blancos": "BEBIDAS",
    "dulces": "BEBIDAS",
    "rosado": "BEBIDAS",
    "tintos": "BEBIDAS",
}
VARIETY_SECTIONS = {"ensaladas", "mermeladas"}


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip())


def main():
    wb = openpyxl.load_workbook(EXCEL, data_only=True)
    ws = wb["202526"]
    items = []
    current_cat = None
    current_section = None
    variety_mode = None
    orden = {"BEBIDAS": 0, "MINUTAS": 0, "CAFETERIA": 0}

    for i in range(1, 170):
        b = ws.cell(i, 2).value
        c = ws.cell(i, 3).value
        d = ws.cell(i, 4).value
        name = norm(b) if b else ""

        # Fila vacía: corta subsección (p.ej. Salsas → guarniciones) sin cambiar categoría
        if not name and c is None and d is None:
            if current_section and current_section.lower() == "salsas":
                current_section = None
            variety_mode = None
            continue

        if name and isinstance(c, str) and isinstance(d, str):
            key = name.lower()
            if key in SECTION_MAP:
                current_cat = SECTION_MAP[key]
                current_section = name
                variety_mode = (norm(c), norm(d))
            continue

        key = name.lower() if name else ""
        if (
            name
            and key in SECTION_MAP
            and not isinstance(c, (int, float))
            and not isinstance(d, (int, float))
        ):
            current_cat = SECTION_MAP[key]
            current_section = name
            variety_mode = None
            continue

        # Mermeladas: precios sin nombre en fila siguiente
        if (
            not name
            and variety_mode
            and current_section
            and current_section.lower() == "mermeladas"
            and isinstance(c, (int, float))
            and c > 0
        ):
            orden[current_cat] += 10
            varieties = [{"name": variety_mode[0], "price": float(c), "ordenIndex": 10}]
            if isinstance(d, (int, float)) and d > 0:
                varieties.append(
                    {"name": variety_mode[1], "price": float(d), "ordenIndex": 20}
                )
            items.append(
                {
                    "category": current_cat,
                    "name": "Mermelada",
                    "price": float(c),
                    "description": None,
                    "ordenIndex": orden[current_cat],
                    "section": current_section,
                    "varieties": varieties,
                }
            )
            continue

        if not name or not current_cat:
            continue

        has_c = isinstance(c, (int, float)) and c > 0
        has_d = isinstance(d, (int, float)) and d > 0
        if not has_c and not has_d:
            continue

        m = re.match(r"^(.+?)\s*\((.+)\)\s*$", name)
        if m and len(m.group(1)) >= 2:
            short, desc = m.group(1).strip(), m.group(2).strip()
        else:
            short, desc = name, None

        if current_section and current_section.lower() == "salsas":
            if not short.lower().startswith("salsa"):
                short = f"Salsa {short}"

        orden[current_cat] += 10
        entry = {
            "category": current_cat,
            "name": short,
            "price": float(c) if has_c else float(d),
            "description": desc,
            "ordenIndex": orden[current_cat],
            "section": current_section,
            "varieties": [],
        }
        if (
            variety_mode
            and current_section
            and current_section.lower() in VARIETY_SECTIONS
            and has_c
            and has_d
        ):
            entry["varieties"] = [
                {"name": variety_mode[0], "price": float(c), "ordenIndex": 10},
                {"name": variety_mode[1], "price": float(d), "ordenIndex": 20},
            ]
            entry["price"] = float(c)
        items.append(entry)

    OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    by_cat = {k: sum(1 for i in items if i["category"] == k) for k in orden}
    with_var = sum(1 for i in items if i["varieties"])
    print(f"Wrote {OUT} count={len(items)} byCat={by_cat} withVar={with_var}")
    for it in items:
        vars_s = ""
        if it["varieties"]:
            vars_s = " | " + ", ".join(
                f"{v['name']}:{v['price']}" for v in it["varieties"]
            )
        print(f"{it['category']:10} {it['ordenIndex']:4} {it['name']} ${it['price']}{vars_s}")


if __name__ == "__main__":
    main()
