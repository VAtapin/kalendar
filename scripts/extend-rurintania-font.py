"""Add German umlauts and eszett to the bundled Rurintania TrueType font.

The added glyphs are composites of existing Rurintania glyphs. This keeps the
original outlines untouched and avoids introducing a second visual style.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen


ACCENTED_GLYPHS = {
    "ä": ("a", 420, 640, 105, 205),
    "Ä": ("A", 1009, 1215, 390, 560),
    "ö": ("o", 377, 635, 82, 185),
    "Ö": ("O", 1384, 1325, 510, 700),
    "ü": ("u", 437, 635, 110, 220),
    "Ü": ("U", 1422, 1355, 510, 700),
}


def cmap_for(font: TTFont) -> dict[int, str]:
    cmap: dict[int, str] = {}
    for table in font["cmap"].tables:
        cmap.update(table.cmap)
    return cmap


def composed_glyph(font: TTFont, parts: list[tuple[str, int, int]]):
    glyph_set = font.getGlyphSet()
    pen = TTGlyphPen(glyph_set)
    for glyph_name, x, y in parts:
        transformed = TransformPen(pen, (1, 0, 0, 1, x, y))
        glyph_set[glyph_name].draw(transformed)
    return pen.glyph()


def add_composite(font: TTFont, name: str, base: str, advance: int, dots_y: int, left_dot_x: int, right_dot_x: int) -> None:
    glyph = composed_glyph(font, [(base, 0, 0), ("period", left_dot_x, dots_y), ("period", right_dot_x, dots_y)])
    font["glyf"].glyphs[name] = glyph
    font["hmtx"].metrics[name] = (advance, font["hmtx"].metrics[base][1])


def add_eszett(font: TTFont) -> None:
    # Rurintania has a strongly stylised lowercase s and z. Their composite
    # is a closer match than importing a regular-text ß from another family.
    glyph = composed_glyph(font, [("s", 0, 0), ("z", 175, 0)])
    font["glyf"].glyphs["germandbls"] = glyph
    font["hmtx"].metrics["germandbls"] = (560, font["hmtx"].metrics["s"][1])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()

    font = TTFont(args.source)
    cmap = cmap_for(font)
    glyph_order = font.getGlyphOrder()
    required = {"a", "A", "o", "O", "u", "U", "s", "z", "period"}
    missing = sorted(glyph for glyph in required if glyph not in font["glyf"].glyphs)
    if missing:
        raise RuntimeError(f"Rurintania base glyphs are missing: {', '.join(missing)}")

    for character, (base, advance, dots_y, left_dot_x, right_dot_x) in ACCENTED_GLYPHS.items():
        name = {
            "ä": "adieresis",
            "Ä": "Adieresis",
            "ö": "odieresis",
            "Ö": "Odieresis",
            "ü": "udieresis",
            "Ü": "Udieresis",
        }[character]
        add_composite(font, name, base, advance, dots_y, left_dot_x, right_dot_x)
        if name not in glyph_order:
            glyph_order.append(name)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[ord(character)] = name

    add_eszett(font)
    glyph_order.append("germandbls")
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[0x00DF] = "germandbls"

    font.setGlyphOrder(glyph_order)
    font["name"].setName("Version 1.001 German glyph extension", 5, 3, 1, 0x409)
    args.target.parent.mkdir(parents=True, exist_ok=True)
    font.save(args.target, reorderTables=False)

    # Make the output self-checking for the characters this extension promises.
    result = TTFont(args.target)
    result_cmap = cmap_for(result)
    for character in ("ä", "Ä", "ö", "Ö", "ü", "Ü", "ß"):
        if result_cmap.get(ord(character), ".notdef") == ".notdef":
            raise RuntimeError(f"Generated font still lacks {character}")


if __name__ == "__main__":
    main()
