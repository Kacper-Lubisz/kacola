#!/usr/bin/env python3
"""Build the kacola brand assets from the pinned upstream fonts.

    python3 brand/scripts/build.py          (or: pnpm brand)

Steps, all reproducible from this file:
  1. fetch the OFL fonts from google/fonts at a pinned commit (cached in ~/.cache/kacola-brand)
  2. convert them to woff2 in brand/fonts/ (no subsetting), copying each family's OFL.txt
  3. draw the logos with the text converted to outlines (instanced variable fonts, shaped with HarfBuzz)
  4. rasterise the icons with Inkscape and pack favicon.ico and kacola.icns

Needs: fonttools, brotli, uharfbuzz (pip install --user fonttools brotli uharfbuzz) and inkscape on PATH.
The tokens (brand/tokens/*.css) are generated separately by brand/scripts/tokens.ts.
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

BRAND = Path(__file__).resolve().parent.parent
CACHE = Path.home() / '.cache' / 'kacola-brand'
GOOGLE_FONTS_SHA = '9710da1eacb3be272583c3224dcb70f9da6eadbb'

# (directory in google/fonts ofl/, upstream file, our woff2 name)
FONTS = [
    ('bricolagegrotesque', 'BricolageGrotesque[opsz,wdth,wght].ttf', 'BricolageGrotesque-Variable.woff2'),
    ('instrumentsans', 'InstrumentSans[wdth,wght].ttf', 'InstrumentSans-Variable.woff2'),
    ('instrumentsans', 'InstrumentSans-Italic[wdth,wght].ttf', 'InstrumentSans-Italic-Variable.woff2'),
    ('fraunces', 'Fraunces-Italic[SOFT,WONK,opsz,wght].ttf', 'Fraunces-Italic-Variable.woff2'),
    ('jetbrainsmono', 'JetBrainsMono[wght].ttf', 'JetBrainsMono-Variable.woff2'),
]
OFL_NAMES = {
    'bricolagegrotesque': 'BricolageGrotesque',
    'instrumentsans': 'InstrumentSans',
    'fraunces': 'Fraunces',
    'jetbrainsmono': 'JetBrainsMono',
}

# ---- palette (brand-spec.md) ------------------------------------------------------------------------------
OAT = '#FFFDF8'
EDGE = '#E2D9C6'
INK = '#1F1B16'
RED = '#E0482B'
DARK_BG = '#171411'
DARK_TILE = '#211D19'
DARK_EDGE = '#3A332B'
DARK_INK = '#F3ECE0'
DARK_RED = '#F0603F'
WHITE = '#FFFFFF'


def fetch(directory: str, name: str) -> Path:
    dest = CACHE / GOOGLE_FONTS_SHA / directory / name
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = (
            f'https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_SHA}/ofl/{directory}/'
            + urllib.parse.quote(name)
        )
        print(f'  fetch {url}')
        with urllib.request.urlopen(url) as r:
            dest.write_bytes(r.read())
    return dest


def build_fonts() -> None:
    out = BRAND / 'fonts'
    out.mkdir(exist_ok=True)
    for directory, name, woff2 in FONTS:
        font = TTFont(fetch(directory, name), recalcTimestamp=False)  # byte-identical rebuilds
        font.flavor = 'woff2'
        font.save(out / woff2)
    for directory, family in OFL_NAMES.items():
        shutil.copyfile(fetch(directory, 'OFL.txt'), out / f'{family}-OFL.txt')
    print(f'fonts: {len(FONTS)} woff2 + {len(OFL_NAMES)} OFL.txt -> {out.relative_to(BRAND.parent)}')


# ---- outlines ---------------------------------------------------------------------------------------------


@dataclass
class Face:
    """A variable font pinned to one instance: fontTools glyphs to draw, HarfBuzz to shape."""

    tt: TTFont
    hb_font: hb.Font
    upm: int


def load_face(directory: str, name: str, axes: dict[str, float]) -> Face:
    path = fetch(directory, name)
    tt = instancer.instantiateVariableFont(TTFont(path), axes)
    blob = hb.Blob.from_file_path(str(path))
    hb_font = hb.Font(hb.Face(blob))
    hb_font.set_variations(axes)
    return Face(tt, hb_font, tt['head'].unitsPerEm)


@dataclass
class Glyph:
    name: str
    x: float  # pen position in font units


def shape(face: Face, text: str, tracking_em: float = 0.0) -> tuple[list[Glyph], float]:
    """HarfBuzz shaping (GPOS kerning included) plus tracking after every glyph but the last."""
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(face.hb_font, buf, {'kern': True, 'liga': False})
    order = face.tt.getGlyphOrder()
    glyphs, x = [], 0.0
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        glyphs.append(Glyph(order[info.codepoint], x + pos.x_offset))
        x += pos.x_advance
        if i < len(buf.glyph_infos) - 1:
            x += tracking_em * face.upm
    return glyphs, x


def ink_bounds(face: Face, glyphs: list[Glyph]) -> tuple[float, float, float, float]:
    gs = face.tt.getGlyphSet()
    xs0, ys0, xs1, ys1 = [], [], [], []
    for g in glyphs:
        bp = BoundsPen(gs)
        gs[g.name].draw(bp)
        if bp.bounds:
            x0, y0, x1, y1 = bp.bounds
            xs0.append(x0 + g.x)
            ys0.append(y0)
            xs1.append(x1 + g.x)
            ys1.append(y1)
    return min(xs0), min(ys0), max(xs1), max(ys1)


def fmt(v: float) -> str:
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


class RoundingSVGPathPen(SVGPathPen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet, ntos=fmt)


def outline(face: Face, glyphs: list[Glyph], size: float, ox: float, baseline: float) -> str:
    """SVG path data for `glyphs` at `size` px with the pen origin at (ox, baseline) in SVG space."""
    gs = face.tt.getGlyphSet()
    s = size / face.upm
    pen = RoundingSVGPathPen(gs)
    for g in glyphs:
        gs[g.name].draw(TransformPen(pen, (s, 0, 0, -s, ox + g.x * s, baseline)))
    return pen.getCommands()


# ---- marks ------------------------------------------------------------------------------------------------


@dataclass
class Colours:
    tile: str | None
    edge: str | None
    k: str
    dot: str


ICON_LIGHT = Colours(OAT, EDGE, INK, RED)
ICON_DARK = Colours(DARK_TILE, DARK_EDGE, DARK_INK, DARK_RED)


@dataclass
class KSpec:
    size: float  # k em size in the 100-unit box
    cx: float  # centre of the k's ink box
    baseline: float
    dot: tuple[float, float, float]  # cx, cy, r


BIG_K = KSpec(70, 42, 72, (74, 62, 10))
# <=32 px: the k and dot grow to fill the tile and land on whole-ish pixels at 16/32 px.
# The dot is a 5 px disc on the 16 px grid (6.25 units per px): pixels 10-15 across, 9-14 down.
SMALL_K = KSpec(90, 37, 87.5, (78.125, 71.875, 15.625))

FRAUNCES = ('fraunces', 'Fraunces-Italic[SOFT,WONK,opsz,wght].ttf')
BIG_AXES = {'wght': 700, 'opsz': 144, 'SOFT': 0, 'WONK': 1}
# At 16-32 px the display cut's hairlines vanish: the text optical size and a heavier weight keep the k legible.
SMALL_AXES = {'wght': 800, 'opsz': 9, 'SOFT': 0, 'WONK': 1}


def k_path(fr: Face, spec: KSpec) -> str:
    glyphs, _ = shape(fr, 'k')
    x0, _, x1, _ = ink_bounds(fr, glyphs)
    s = spec.size / fr.upm
    ox = spec.cx - (x0 + x1) / 2 * s
    return outline(fr, glyphs, spec.size, ox, spec.baseline)


def circle(cx: float, cy: float, r: float, fill: str) -> str:
    return f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" fill="{fill}"/>'


def svg(view: tuple[float, float, float, float], body: str, label: str, extra: str = '') -> str:
    x, y, w, h = view
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(x)} {fmt(y)} {fmt(w)} {fmt(h)}"'
        f' role="img" aria-label="{label}"{extra}>{body}</svg>\n'
    )


def icon_body(fr: Face, c: Colours, spec: KSpec, edge: bool) -> str:
    parts = []
    if c.tile:
        if edge and c.edge:
            parts.append(
                f'<rect x="0.5" y="0.5" width="99" height="99" rx="23.5" fill="{c.tile}" stroke="{c.edge}"/>'
            )
        else:
            parts.append(f'<rect width="100" height="100" rx="24" fill="{c.tile}"/>')
    parts.append(f'<path fill="{c.k}" d="{k_path(fr, spec)}"/>')
    parts.append(circle(*spec.dot, c.dot))
    return ''.join(parts)


def icon_mono_body(fr: Face, spec: KSpec, colour: str) -> str:
    """One-colour tile with the k and dot knocked out (transparent), for print and stamps."""
    return (
        '<mask id="k-knockout">'
        '<rect width="100" height="100" fill="#fff"/>'
        f'<path fill="#000" d="{k_path(fr, spec)}"/>{circle(*spec.dot, "#000")}'
        '</mask>'
        f'<rect width="100" height="100" rx="24" fill="{colour}" mask="url(#k-knockout)"/>'
    )


@dataclass
class Wordmark:
    body: str  # drawn with the baseline at y=0 and the ink starting at x=0
    width: float
    top: float  # ascender top (negative)
    x_height: float


WORDMARK_SIZE = 64.0


def wordmark(bg: Face, ink: str, dot: str, size: float = WORDMARK_SIZE) -> Wordmark:
    glyphs, _ = shape(bg, 'kacola', tracking_em=-0.04)
    x0, _, x1, y1 = ink_bounds(bg, glyphs)
    s = size / bg.upm
    body = f'<path fill="{ink}" d="{outline(bg, glyphs, size, -x0 * s, 0)}"/>'
    r = 0.1 * size
    cx = (x1 - x0) * s + 0.06 * size + r
    body += circle(cx, -r, r, dot)
    xh = bg.tt['OS/2'].sxHeight * s
    return Wordmark(body, cx + r, -y1 * s, xh)


def translate(body: str, x: float, y: float, scale: float = 1.0) -> str:
    sc = '' if scale == 1 else f' scale({fmt(scale)})'
    return f'<g transform="translate({fmt(x)} {fmt(y)}){sc}">{body}</g>'


def build_logos() -> dict[str, str]:
    fr = load_face(*FRAUNCES, BIG_AXES)
    fr_small = load_face(*FRAUNCES, SMALL_AXES)
    bg = load_face(
        'bricolagegrotesque', 'BricolageGrotesque[opsz,wdth,wght].ttf', {'wght': 700, 'opsz': 96, 'wdth': 100}
    )
    out: dict[str, str] = {}
    box = (0, 0, 100, 100)
    out['icon.svg'] = svg(box, icon_body(fr, ICON_LIGHT, BIG_K, edge=True), 'kacola')
    out['icon-dark.svg'] = svg(box, icon_body(fr, ICON_DARK, BIG_K, edge=True), 'kacola')
    out['icon-mono.svg'] = svg(box, icon_mono_body(fr, BIG_K, INK), 'kacola')
    out['icon-small.svg'] = svg(box, icon_body(fr_small, ICON_LIGHT, SMALL_K, edge=False), 'kacola')
    out['symbolic.svg'] = symbolic(fr_small)

    def wm_svg(ink: str, dot: str) -> str:
        w = wordmark(bg, ink, dot)
        return svg((0, w.top, w.width, -w.top), w.body, 'kacola')

    out['wordmark.svg'] = wm_svg(INK, RED)
    out['wordmark-dark.svg'] = wm_svg(DARK_INK, DARK_RED)
    out['wordmark-mono.svg'] = wm_svg(INK, INK)
    out['wordmark-white.svg'] = wm_svg(WHITE, WHITE)

    def lockup(c: Colours, ink: str, dot: str) -> str:
        w = wordmark(bg, ink, dot)
        icon, gap = 76.0, 18.0
        # centre the icon on the wordmark's ink block (ascender top to baseline)
        top = w.top / 2 - icon / 2
        body = translate(icon_body(fr, c, BIG_K, edge=True), 0, top, icon / 100)
        body += translate(w.body, icon + gap, 0)
        return svg((0, top, icon + gap + w.width, icon), body, 'kacola')

    def stacked(c: Colours, ink: str, dot: str) -> str:
        w = wordmark(bg, ink, dot)
        icon, gap = 96.0, 22.0
        width = max(icon, w.width)
        body = translate(icon_body(fr, c, BIG_K, edge=True), (width - icon) / 2, 0, icon / 100)
        base = icon + gap - w.top
        body += translate(w.body, (width - w.width) / 2, base)
        return svg((0, 0, width, base), body, 'kacola')

    out['lockup.svg'] = lockup(ICON_LIGHT, INK, RED)
    out['lockup-dark.svg'] = lockup(ICON_DARK, DARK_INK, DARK_RED)
    out['lockup-stacked.svg'] = stacked(ICON_LIGHT, INK, RED)

    logo = BRAND / 'logo'
    logo.mkdir(exist_ok=True)
    for name, text in out.items():
        (logo / name).write_text(text)
    print(f'logos: {len(out)} svgs -> {logo.relative_to(BRAND.parent)}')
    return out


def symbolic(fr: Face) -> str:
    """Glyph-only single-colour mark (tray / menu bar): the k and dot, no tile, currentColor."""
    spec = KSpec(15, 6, 14, (13, 12, 2))
    body = f'<path fill="currentColor" d="{k_path(fr, spec)}"/>{circle(*spec.dot, "currentColor")}'
    return svg((0, 0, 16, 16), body, 'kacola')


def favicon_svg(fr: Face) -> str:
    """The small-size drawing, recoloured for dark browser chrome via prefers-color-scheme."""
    style = (
        '<style>.t{fill:%s}.k{fill:%s}.d{fill:%s}'
        '@media (prefers-color-scheme:dark){.t{fill:%s}.k{fill:%s}.d{fill:%s}}</style>'
        % (OAT, INK, RED, DARK_TILE, DARK_INK, DARK_RED)
    )
    cx, cy, r = SMALL_K.dot
    body = (
        style
        + '<rect class="t" width="100" height="100" rx="24"/>'
        + f'<path class="k" d="{k_path(fr, SMALL_K)}"/>'
        + f'<circle class="d" cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}"/>'
    )
    return svg((0, 0, 100, 100), body, 'kacola')


# ---- rasters ----------------------------------------------------------------------------------------------

PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
HICOLOR_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
SMALL_MAX = 32


def rasterise(svg_path: Path, size: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ['inkscape', str(svg_path), '--export-type=png', f'--export-filename={dest}', f'--export-width={size}', f'--export-height={size}'],
        check=True,
        capture_output=True,
    )


def build_icons() -> None:
    logo, icons = BRAND / 'logo', BRAND / 'icons'
    png = icons / 'png'
    for size in PNG_SIZES:
        src = logo / ('icon-small.svg' if size <= SMALL_MAX else 'icon.svg')
        rasterise(src, size, png / f'{size}.png')
    for size in HICOLOR_SIZES:
        dest = icons / 'hicolor' / f'{size}x{size}' / 'apps' / 'app.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(png / f'{size}.png', dest)
    for sub, src, name in [('scalable', 'icon.svg', 'app.svg'), ('symbolic', 'symbolic.svg', 'app-symbolic.svg')]:
        d = icons / 'hicolor' / sub / 'apps'
        d.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(logo / src, d / name)

    (icons / 'favicon.svg').write_text(favicon_svg(load_face(*FRAUNCES, SMALL_AXES)))
    write_ico(icons / 'favicon.ico', [(s, (png / f'{s}.png').read_bytes()) for s in (16, 32, 48)])
    write_icns(icons / 'kacola.icns', logo)
    print(f'icons: {len(PNG_SIZES)} png, hicolor tree, favicon.ico/.svg, kacola.icns -> {icons.relative_to(BRAND.parent)}')


def write_ico(dest: Path, images: list[tuple[int, bytes]]) -> None:
    """ICO with PNG-compressed entries (supported since Windows Vista and by every browser)."""
    header = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, data = b'', b''
    for size, blob in images:
        d = size % 256  # 0 means 256
        entries += struct.pack('<BBBBHHII', d, d, 0, 0, 1, 32, len(blob), offset + len(data))
        data += blob
    dest.write_bytes(header + entries + data)


# macOS icns PNG entry types -> pixel size. The body follows the macOS icon grid: 824/1024 content, centred.
ICNS_TYPES = [
    (b'icp4', 16),
    (b'icp5', 32),
    (b'ic11', 32),
    (b'icp6', 64),
    (b'ic12', 64),
    (b'ic07', 128),
    (b'ic08', 256),
    (b'ic13', 256),
    (b'ic09', 512),
    (b'ic14', 512),
    (b'ic10', 1024),
]


def write_icns(dest: Path, logo: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        for name in ('icon.svg', 'icon-small.svg'):
            inner = (logo / name).read_text()
            inner = inner[inner.index('>') + 1 : inner.rindex('</svg>')]
            pad = 100 * (1024 - 824) / 824 / 2
            (t / name).write_text(svg((-pad, -pad, 100 + 2 * pad, 100 + 2 * pad), inner, 'kacola'))
        chunks = b''
        rendered: dict[int, bytes] = {}
        for kind, size in ICNS_TYPES:
            if size not in rendered:
                src = t / ('icon-small.svg' if size <= SMALL_MAX else 'icon.svg')
                rasterise(src, size, t / f'{size}.png')
                rendered[size] = (t / f'{size}.png').read_bytes()
            blob = rendered[size]
            chunks += kind + struct.pack('>I', 8 + len(blob)) + blob
    dest.write_bytes(b'icns' + struct.pack('>I', 8 + len(chunks)) + chunks)


def main() -> None:
    if shutil.which('inkscape') is None:
        sys.exit('inkscape is required on PATH')
    build_fonts()
    build_logos()
    build_icons()


if __name__ == '__main__':
    main()
