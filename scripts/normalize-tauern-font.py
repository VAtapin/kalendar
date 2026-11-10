"""Rebuild a legacy TrueType cmap without changing outlines, names or metrics.

Development-only tool; requires fontTools. Does not run during deployment.
Usage: python scripts/normalize-tauern-font.py SOURCE.ttf OUTPUT.ttf
"""
import argparse
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.DefaultTable import DefaultTable


def normalize(source: Path, output: Path) -> None:
    if source.resolve() == output.resolve():
        raise ValueError("Use a separate output file to preserve the original")
    parsed = TTFont(source, recalcTimestamp=False)
    cmap = parsed["cmap"].compile(parsed)
    # Keep other tables opaque: a full decompile/save also rewrites glyph names.
    result = TTFont(source, recalcTimestamp=False, recalcBBoxes=False)
    result["cmap"] = DefaultTable("cmap")
    result["cmap"].data = cmap
    result.save(output)

    checked = TTFont(output, recalcTimestamp=False)
    assert parsed.getGlyphOrder() == checked.getGlyphOrder(), "Glyph order changed"
    assert parsed.getBestCmap() == checked.getBestCmap(), "Unicode mappings changed"
    for tag in parsed.reader.keys():
        if tag not in ("cmap", "head"):
            assert parsed.reader[tag] == checked.reader[tag], f"Unexpected table change: {tag}"
    old_head, new_head = parsed.reader["head"], checked.reader["head"]
    assert old_head[:8] + old_head[12:] == new_head[:8] + new_head[12:], "Head changed beyond checksum"
    print("PASS: rebuilt cmap and sfnt directory; glyphs, mappings, metrics and all other tables unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    normalize(args.source, args.output)
