#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Будка 1 (DXF) -> Word .docx, собранный ТОЛЬКО из примитивов Word (DrawingML shapes):
линии, прямоугольники, эллипс, текстовые надписи. Никаких картинок.
Масштаб 1:30, лист A4 ландшафт. Все размеры подписаны выноскими + размерными линиями
со стрелками; каждый размер = отдельная редактируемая фигура/текстбокс.

Генерирует:
  docs/Будка1_план_размеры.docx
  docs/_budka1_preview.html   (1:1 превью листа, для визуальной проверки)
  docs/_budka1_shapes.json    (перечень фигур и размеров)
"""
import json
import os
import zipfile
from xml.sax.saxutils import escape

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
WPS = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
MM = 36000  # EMU per mm

# ---------------------------------------------------------------- геометрия (модель, мм)
S = 1.0 / 30.0            # мм листа на мм модели  ->  М 1:30
PX0, PY0 = 60.0, 30.0     # позиция левого/верхнего края опорного прямоугольника на листе, мм


def PX(x):
    return PX0 + (x + 100.0) * S


def PY(y):
    return PY0 + (2400.0 - y) * S


def emu(v):
    return int(round(v * MM))


BLACK = "000000"
GREY = "808080"
FILL = "D9D9D9"
DIMC = "C00000"      # размеры
LABC = "7030A0"      # подписи элементов

shapes = []   # записи для docx и превью
idn = [1000]


def _nid(name):
    idn[0] += 1
    return idn[0], name


def line(name, x1, y1, x2, y2, pt, color, dash=None, arrow=None, layer="GEO"):
    shapes.append(dict(kind="line", name=name, x1=x1, y1=y1, x2=x2, y2=y2,
                       pt=pt, color=color, dash=dash, arrow=arrow, layer=layer))


def rect(name, x, y, w, h, pt, color, fill=None, dash=None, layer="GEO"):
    shapes.append(dict(kind="rect", name=name, x=x, y=y, w=w, h=h,
                       pt=pt, color=color, fill=fill, dash=dash, layer=layer))


def ellipse(name, cx, cy, rx, ry, pt, color, fill=None, dash=None, layer="GEO"):
    shapes.append(dict(kind="ellipse", name=name, cx=cx, cy=cy, rx=rx, ry=ry,
                       pt=pt, color=color, fill=fill, dash=dash, layer=layer))


def text(name, cx, cy, w, h, pt, color, lines, rot=0, bold=False, align="center", layer="GEO"):
    shapes.append(dict(kind="text", name=name, cx=cx, cy=cy, w=w, h=h, pt=pt, color=color,
                       lines=lines, rot=rot, bold=bold, align=align, layer=layer))


# ================================================================ РИСУНОК
THICK = 1.4      # контур разреза
MED = 1.0        # контур помещения
THIN = 0.35      # выноски / размерные линии
DASH_REF = "sysDash"


def build():
    # --- опорный прямоугольник 6000 x 2500 (для сопоставления масштаба)
    rect("Опорный прямоугольник 6000x2500", PX(-100), PY(2400), 6000 * S, 2500 * S,
         THIN, GREY, fill=None, dash=DASH_REF, layer="REF")
    text("Подпись: опорный прямоугольник", PX(-100) + 37, 25.5, 74, 4, 6.5, GREY,
         ["ОПОРНЫЙ ПРЯМОУГОЛЬНИК  6000 x 2500 мм  (6,0 x 2,5 м)"], align="center", layer="REF")

    # --- наружный контур плана 5800 x 2300
    rect("План. наружный габарит 5800x2300", PX(0), PY(2300), 5800 * S, 2300 * S, THICK, BLACK)

    # --- стена/перегородка 70 (2000..2070, y 0..2400)
    rect("Стена 70 (2000..2070, 0..2400)", PX(2000), PY(2400), 70 * S, 2400 * S, MED, BLACK, fill=FILL)
    # --- отсек 600 (2070..2670, y 0..2400)
    rect("Отсек 600 (2070..2670, 0..2400)", PX(2070), PY(2400), 600 * S, 2400 * S, MED, BLACK)
    # --- проём в верхней стене 3070..3920 (y 2300..2401)
    rect("Проём 850 в верхней стене (3070..3920)", PX(3070), PY(2401), 850 * S, 101 * S,
         MED, BLACK, fill=FILL)
    # --- отсек справа 5400..5800 (y 0..2300)
    rect("Отсек справа 400 (5400..5800)", PX(5400), PY(2300), 400 * S, 2300 * S, MED, BLACK)
    # --- отсек снизу 2670..5400 (y 0..400)
    rect("Отсек снизу 400 (2670..5400, 0..400)", PX(2670), PY(400), 2730 * S, 400 * S, MED, BLACK)
    # --- окружность R450 (дверь)
    ellipse("Окружность R450 (дверь)", PX(1510.695), PY(483.763), 450 * S, 450 * S,
            THIN, GREY, fill=None, dash="dash")

    # --- подписи элементов
    text("Подпись: стена 70", 126.5, PY(1200), 26, 4, 6.5, LABC, ["СТЕНА  70"], rot=-90, layer="LAB")
    text("Подпись: отсек 600", (PX(2070) + PX(2670)) / 2, PY(1200), 18, 4, 6.5, LABC, ["ОТСЕК 600"], layer="LAB")
    text("Подпись: отсек 400 (справа)", (PX(5400) + PX(5800)) / 2, PY(1150), 26, 4, 6.5, LABC,
         ["ОТСЕК 400"], rot=-90, layer="LAB")
    text("Подпись: отсек 400 (снизу)", PX(4035), PY(200), 26, 4, 6.5, LABC, ["ОТСЕК 400"], layer="LAB")
    text("Подпись: проём 850", PX(3495), PY(2200), 26, 4, 6.5, LABC, ["ПРОЁМ 850"], layer="LAB")
    text("Подпись: дверь", PX(1510.695), PY(483.763), 24, 4, 6.5, LABC, ["Ø900  ДВЕРЬ"], layer="LAB")

    # ---------- размеры снизу (цепочка от нижнего края плана y=0) ----------
    hchain(-600, [(0, 2000), (2000, 2070), (2070, 2670), (2670, 5400), (5400, 5800)], 0,
           {70: 1640})
    hdim(0, 5800, -1150, 0, "5800")
    hdim(-100, 5900, -1700, -100, "6000")

    # ---------- размеры сверху (y = 2300 / 2400 / 2401) ----------
    hchain(2700, [(2000, 2070), (3070, 3920)], 2400, {}, top=True, contiguous=False)
    # ---------- размеры слева ----------
    vdim(0, 2300, -700, 0, "2300")
    vdim(-100, 2400, -1250, -100, "2500")
    # ---------- размеры справа ----------
    vdim(0, 400, 6300, 5800, "400")
    vdim(2300, 2401, 4200, 3920, "101", text_pos=(205.0, 27.0))

    # --- заголовок листа
    text("Заголовок: Будка 1", PX(2900), 180.0, 150, 6, 11, BLACK,
         ["БУДКА 1  ·  ПЛАН  ·  М 1:30  ·  РАЗМЕРЫ В ММ"], bold=True, layer="LAB")


def hdim(x1, x2, ydim, yfeat, label, text_dx=None, top=False, ext="both"):
    """горизонтальный размер: выноски + линия со стрелками + текст"""
    yd = PY(ydim)
    over = ydim + (120 if top else -120)
    xs = (x1, x2) if ext == "both" else (x2,) if ext == "right" else ()
    for x in xs:
        line(f"Выноска x={x} y={ydim}", PX(x), PY(yfeat), PX(x), PY(over), THIN, DIMC, layer="DIM")
    line(f"Размерная линия {label}", PX(x1), yd, PX(x2), yd, THIN, DIMC, arrow="both", layer="DIM")
    cx = (PX(x1) + PX(x2)) / 2
    if text_dx is not None:
        cx = PX(text_dx)
    text(f"Размер {label}", cx, yd - 2.6, 18, 3.5, 8, DIMC, [label], layer="DIM")


def vdim(y1, y2, xdim, xfeat, label, text_pos=None):
    xd = PX(xdim)
    over = xdim + (-120 if xdim < 3000 else 120)
    for y in (y1, y2):
        line(f"Выноска y={y} x={xdim}", PX(xfeat), PY(y), PX(over), PY(y), THIN, DIMC, layer="DIM")
    line(f"Размерная линия {label}", xd, PY(y1), xd, PY(y2), THIN, DIMC, arrow="both", layer="DIM")
    if text_pos:                      # мелкий размер: подпись вне зоны, горизонтально, с выноской
        tx, ty = text_pos
        line(f"Выноска подписи {label}", xd, (PY(y1) + PY(y2)) / 2, tx, ty, THIN, DIMC, layer="DIM")
        text(f"Размер {label}", tx, ty, 18, 3.5, 8, DIMC, [label], layer="DIM")
        return
    off = -2.6 if xdim < 3000 else 2.6
    text(f"Размер {label}", xd + off, (PY(y1) + PY(y2)) / 2, 18, 3.5, 8, DIMC, [label],
         rot=-90, layer="DIM")


def hchain(ydim, segs, yfeat, dx_map, top=False, contiguous=True):
    """цепочка смежных размеров: одна выноска на Feature, без дублей"""
    if contiguous:
        line(f"Выноска x={segs[0][0]} y={ydim}", PX(segs[0][0]), PY(yfeat), PX(segs[0][0]),
             PY(ydim + (120 if top else -120)), THIN, DIMC, layer="DIM")
    for (a, b) in segs:
        hdim(a, b, ydim, yfeat, str(b - a), text_dx=dx_map.get(b - a), top=top,
             ext="right" if contiguous else "both")


build()

# ================================================================ DOCX


def dash_xml(dash):
    if not dash:
        return ""
    m = {"dash": "dash", "sysDash": "lgDash", "dashDot": "dashDot", "dot": "sysDot"}
    return f'<a:prstDash val="{m.get(dash, "dash")}"/>'


def ln_xml(pt, color, dash=None, arrow=None):
    w = int(round(pt * 12700))
    arr = ""
    if arrow == "both":
        arr = '<a:headEnd type="triangle" w="lg" len="lg"/><a:tailEnd type="triangle" w="lg" len="lg"/>'
    return (f'<a:ln w="{w}" cap="flat"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
            f'{dash_xml(dash)}{arr}</a:ln>')


def anchor(id_, name, cx, cy, offx, offy, inner, flipH=False, flipV=False, rot=0, eff=19050):
    fl = ""
    if flipH:
        fl += ' flipH="1"'
    if flipV:
        fl += ' flipV="1"'
    if rot:
        fl += f' rot="{rot * 60000}"'
    return (
        f'<w:r><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:drawing>'
        f'<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{id_}" '
        f'behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">'
        f'<wp:simplePos x="0" y="0"/>'
        f'<wp:positionH relativeFrom="page"><wp:posOffset>{emu(offx)}</wp:posOffset></wp:positionH>'
        f'<wp:positionV relativeFrom="page"><wp:posOffset>{emu(offy)}</wp:posOffset></wp:positionV>'
        f'<wp:extent cx="{emu(cx)}" cy="{emu(cy)}"/>'
        f'<wp:effectExtent l="{eff}" t="{eff}" r="{eff}" b="{eff}"/>'
        f'<wp:docPr id="{id_}" name="{escape(name)}"/>'
        f'<a:graphic xmlns:a="{A}"><a:graphicData uri="{WPS}">'
        f'<wps:wsp xmlns:wps="{WPS}">'
        f'{inner}'
        f'</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>'
    )


def xfrm(cx, cy, flipH=False, flipV=False, rot=0):
    fl = ""
    if flipH:
        fl += ' flipH="1"'
    if flipV:
        fl += ' flipV="1"'
    if rot:
        fl += f' rot="{(rot % 360) * 60000}"'
    return f'<a:xfrm{fl}><a:off x="0" y="0"/><a:ext cx="{emu(cx)}" cy="{emu(cy)}"/></a:xfrm>'


def sp_shape(sh):
    """wps:cNvSpPr + wps:spPr для геометрических фигур (без текста)"""
    k = sh["kind"]
    if k == "line":
        cx, cy = abs(sh["x2"] - sh["x1"]), abs(sh["y2"] - sh["y1"])
        flipH, flipV = sh["x2"] < sh["x1"], sh["y2"] < sh["y1"]
        geom = '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>'
        return ('<wps:cNvSpPr/>'
                f'<wps:spPr>{xfrm(cx, cy, flipH, flipV)}{geom}'
                f'{ln_xml(sh["pt"], sh["color"], sh.get("dash"), sh.get("arrow"))}</wps:spPr>'), \
            min(sh["x1"], sh["x2"]), min(sh["y1"], sh["y2"]), cx, cy
    if k == "rect":
        geom = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        fill = f'<a:solidFill><a:srgbClr val="{sh["fill"]}"/></a:solidFill>' if sh.get("fill") else '<a:noFill/>'
        return ('<wps:cNvSpPr/>'
                f'<wps:spPr>{xfrm(sh["w"], sh["h"])}{geom}{fill}'
                f'{ln_xml(sh["pt"], sh["color"], sh.get("dash"))}</wps:spPr>'), \
            sh["x"], sh["y"], sh["w"], sh["h"]
    if k == "ellipse":
        geom = '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>'
        fill = f'<a:solidFill><a:srgbClr val="{sh["fill"]}"/></a:solidFill>' if sh.get("fill") else '<a:noFill/>'
        return ('<wps:cNvSpPr/>'
                f'<wps:spPr>{xfrm(2 * sh["rx"], 2 * sh["ry"])}{geom}{fill}'
                f'{ln_xml(sh["pt"], sh["color"], sh.get("dash"))}</wps:spPr>'), \
            sh["cx"] - sh["rx"], sh["cy"] - sh["ry"], 2 * sh["rx"], 2 * sh["ry"]
    raise ValueError(k)


def txbx_xml(sh):
    ps = []
    for ln in sh["lines"]:
        ps.append(
            '<w:p><w:pPr>'
            f'<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'
            f'<w:jc w:val="{ "center" if sh["align"]=="center" else "left" }"/>'
            f'<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
            f'<w:b/><w:color w:val="{sh["color"]}"/><w:sz w:val="{int(sh["pt"]*2)}"/>'
            f'<w:szCs w:val="{int(sh["pt"]*2)}"/></w:rPr></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
            f'{"<w:b/>" if sh.get("bold") else ""}'
            f'<w:color w:val="{sh["color"]}"/><w:sz w:val="{int(sh["pt"]*2)}"/>'
            f'<w:szCs w:val="{int(sh["pt"]*2)}"/></w:rPr>'
            f'<w:t xml:space="preserve">{escape(ln)}</w:t></w:r></w:p>')
    rot = (sh.get("rot", 0) % 360)
    inner = ('<wps:cNvSpPr txBox="1"/>'
             f'<wps:spPr>{xfrm(sh["w"], sh["h"], rot=rot)}'
             '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>'
             '<a:ln w="6350"><a:noFill/></a:ln></wps:spPr>'
             f'<wps:txbx><w:txbxContent>{"".join(ps)}</w:txbxContent></wps:txbx>'
             '<wps:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="overflow" horzOverflow="overflow" '
             'vert="horz" wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" numCol="1" spcCol="0" '
             f'rtlCol="0" fromWord="1" anchor="ctr" anchorCtr="1" forceAA="0"><a:noAutofit/></wps:bodyPr>')
    offx, offy = sh["cx"] - sh["w"] / 2, sh["cy"] - sh["h"] / 2
    return anchor(*_nid(sh["name"]), inner, rot=0, cx=sh["w"], cy=sh["h"], offx=offx, offy=offy) \
        if False else anchor(_nid(sh["name"])[0], _nid(sh["name"])[1], sh["w"], sh["h"], offx, offy, inner,
                             rot=rot, eff=38100)


def shape_xml(sh):
    if sh["kind"] == "text":
        return txbx_xml(sh)
    inner, offx, offy, cx, cy = sp_shape(sh)
    return anchor(_nid(sh["name"])[0], _nid(sh["name"])[1], cx, cy, offx, offy, inner)


def sectpr(landscape=True):
    return ('<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
            '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" '
            'w:footer="425" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>')


def drawing_paragraph():
    runs = []
    order = [s for s in shapes if s["layer"] in ("REF", "GEO")] + \
            [s for s in shapes if s["layer"] == "DIM"] + \
            [s for s in shapes if s["layer"] == "LAB"]
    for s in order:
        runs.append(shape_xml(s))
    return ('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>'
            '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>' + "".join(runs) + '</w:p>')


def p(text_, sz=9, bold=False, after=60, align=None, color=None):
    rpr = f'<w:sz w:val="{int(sz*2)}"/><w:szCs w:val="{int(sz*2)}"/>'
    if color:
        rpr = f'<w:color w:val="{color}"/>' + rpr
    jc = f'<w:jc w:val="{align}"/>' if align else ""
    return (f'<w:p><w:pPr><w:spacing w:before="0" w:after="{after}" w:line="240" w:lineRule="auto"/>{jc}'
            f'<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
            f'{"<w:b/>" if bold else ""}{rpr}</w:rPr></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
            f'{"<w:b/>" if bold else ""}{rpr}</w:rPr>'
            f'<w:t xml:space="preserve">{escape(text_)}</w:t></w:r></w:p>')


def row(cells, bold=False, shade=None):
    tcs = []
    for c in cells:
        sh = f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>' if shade else ''
        tcs.append(f'<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>{sh}<w:vAlign w:val="center"/></w:tcPr>'
                   f'<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/>'
                   f'<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
                   f'{"<w:b/>" if bold else ""}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>'
                   f'<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
                   f'{"<w:b/>" if bold else ""}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>'
                   f'<w:t xml:space="preserve">{escape(c)}</w:t></w:r></w:p></w:tc>')
    return '<w:tr>' + "".join(tcs) + '</w:tr>'


def table(rows):
    grid = ('<w:tblGrid><w:gridCol w:w="4200"/><w:gridCol w:w="3200"/><w:gridCol w:w="2200"/>'
            '<w:gridCol w:w="2200"/></w:tblGrid>')
    borders = ('<w:tblBorders>'
               '<w:top w:val="single" w:sz="6" w:space="0" w:color="808080"/>'
               '<w:left w:val="single" w:sz="6" w:space="0" w:color="808080"/>'
               '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="808080"/>'
               '<w:right w:val="single" w:sz="6" w:space="0" w:color="808080"/>'
               '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="808080"/>'
               '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="808080"/></w:tblBorders>')
    return (f'<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>{borders}'
            f'<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" '
            f'w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>{grid}'
            + row(["Элемент (примитив Word)", "Габарит, мм", "X от", "Y от"], bold=True, shade="E8E8E8")
            + "".join(row(r) for r in rows) + '</w:tbl>')


DATA_ROWS = [
    ["Наружный контур плана (прямоугольник)", "5800 x 2300", "0", "0"],
    ["Стена / перегородка 70 (прямоугольник со штриховкой)", "70 x 2400", "2000", "0"],
    ["Отсек 600 (прямоугольник)", "600 x 2400", "2070", "0"],
    ["Проём в верхней стене (прямоугольник)", "850 x 101", "3070", "2300"],
    ["Отсек справа (прямоугольник)", "400 x 2300", "5400", "0"],
    ["Отсек снизу (прямоугольник)", "2730 x 400", "2670", "0"],
    ["Окружность (дверь)", "R450 / Ø900", "центр 1511", "центр 484"],
    ["Опорный прямоугольник 6 x 2,5 м (пунктир)", "6000 x 2500", "-100", "-100"],
]

NOTES = [
    "Рисунок собран из примитивов Word: линии, прямоугольники, эллипс, надписи. Картинки нет — всё правится.",
    "Один примитив = один объект. Клик — выделение; перетаскивание маркеров — изменение длины/высоты; "
    "стрелки на размерных линиях сохраняются.",
    "Размерные подписи — текстовые надписи (Text Box): двойной клик, править цифры. Цвет размеров — красный, "
    "подписи элементов — фиолетовый.",
    "Лист: A4 альбомный, масштаб 1:30 (1 мм на листе = 30 мм изделия). Все размеры в мм от точек DXF.",
    "Совет: File ▸ Options ▸ Advanced ▸ Display ▸ Measurement units = Centimetres, чтобы линейка совпадала с мм.",
    "Опорный прямоугольник 6000 x 2500 (6,0 x 2,5 м) — для визуальной проверки масштаба, при печати 100 % "
    "он даст ровно 200 x 83.3 мм.",
]

DOC_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:document xmlns:w="{W}" xmlns:wp="{WP}" xmlns:a="{A}" xmlns:r="'
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    '<w:body>'
    + drawing_paragraph()
    + '<w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/>'
    + sectpr() + '</w:pPr></w:p>'
    + p('БУДКА 1 — ведомость размеров', 13, bold=True, after=120)
    + table(DATA_ROWS)
    + p('', 6, after=40)
    + p('Как править', 11, bold=True, after=60)
    + "".join(p('—  ' + n, 9, after=40) for n in NOTES)
    + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>'
    + sectpr()
    + '</w:body></w:document>'
)

STYLES_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:styles xmlns:w="{W}"><w:docDefaults>'
    '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Times New Roman"/>'
    '<w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>'
    '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>'
    '</w:docDefaults>'
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>'
    '<w:qFormat/></w:style>'
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>'
    '<w:uiPriority w:val="39"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" '
    'w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" '
    'w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" '
    'w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style>'
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>'
    '<w:uiPriority w:val="99"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/>'
    '<w:tblCellMar><w:top w:w="28" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>'
    '<w:bottom w:w="28" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
    '</w:styles>'
)

SETTINGS_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:settings xmlns:w="{W}"><w:zoom w:percent="120"/><w:defaultTabStop w:val="708"/>'
    '<w:characterSpacingControl w:val="compressPunctuation"/>'
    '<w:compat><w:compatSetting w:name="compatibilityMode" '
    'w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>'
    '<w:themeFontLang w:val="ru-RU"/></w:settings>'
)

FONTTABLE_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:fonts xmlns:w="{W}">'
    '<w:font w:name="Arial"><w:panose1 w:val="020B0604020202020204"/><w:charset w:val="00"/>'
    '<w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>'
    '<w:font w:name="Times New Roman"><w:panose1 w:val="02020603050405020304"/><w:charset w:val="00"/>'
    '<w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>'
    '</w:fonts>'
)

CORE_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    '<dc:title>Будка 1 — план с размерами</dc:title><dc:creator>Hermes</dc:creator>'
    '<cp:lastModifiedBy>Hermes</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">'
    '2026-11-17T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">'
    '2026-11-17T00:00:00Z</dcterms:modified></cp:coreProperties>'
)

APP_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    '<Application>Microsoft Office Word</Application><AppVersion>16.0000</AppVersion></Properties>'
)

CT_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    '<Override PartName="/word/settings.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
    '<Override PartName="/word/fontTable.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>'
    '<Override PartName="/docProps/core.xml" ContentType='
    '"application/vnd.openxmlformats-package.core-properties+xml"/>'
    '<Override PartName="/docProps/app.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
)

RELS_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    'officeDocument" Target="word/document.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/'
    'metadata/core-properties" Target="docProps/core.xml"/>'
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    'extended-properties" Target="docProps/app.xml"/></Relationships>'
)

DOC_RELS_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    'styles" Target="styles.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    'settings" Target="settings.xml"/>'
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    'fontTable" Target="fontTable.xml"/></Relationships>'
)


def write_docx(path):
    parts = [
        ("[Content_Types].xml", CT_XML),
        ("_rels/.rels", RELS_XML),
        ("word/document.xml", DOC_XML),
        ("word/_rels/document.xml.rels", DOC_RELS_XML),
        ("word/styles.xml", STYLES_XML),
        ("word/settings.xml", SETTINGS_XML),
        ("word/fontTable.xml", FONTTABLE_XML),
        ("docProps/core.xml", CORE_XML),
        ("docProps/app.xml", APP_XML),
    ]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts:
            z.writestr(name, data.encode("utf-8"))


# ================================================================ SVG-превью 1:1 (лист 297x210 мм)
def pt2mm(pt):
    return pt * 0.3527777778


DASHMAP = {"dash": "1.2,1.2", "sysDash": "3,2"}


def build_svg():
    el = []
    order = [s for s in shapes if s["layer"] == "REF"] + [s for s in shapes if s["layer"] == "GEO"] + \
            [s for s in shapes if s["layer"] == "DIM"] + [s for s in shapes if s["layer"] == "LAB"]
    for s in order:
        sw = pt2mm(s["pt"])
        da = DASHMAP.get(s.get("dash"), "")
        dash = f' stroke-dasharray="{da}"' if da else ""
        if s["kind"] == "line":
            el.append(f'<line x1="{s["x1"]}" y1="{s["y1"]}" x2="{s["x2"]}" y2="{s["y2"]}" '
                      f'stroke="#{s["color"]}" stroke-width="{sw:.3f}"{dash}/>')
        elif s["kind"] == "rect":
            f = f'fill="#{s["fill"]}"' if s.get("fill") else 'fill="none"'
            el.append(f'<rect x="{s["x"]}" y="{s["y"]}" width="{s["w"]}" height="{s["h"]}" {f} '
                      f'stroke="#{s["color"]}" stroke-width="{sw:.3f}"{dash}/>')
        elif s["kind"] == "ellipse":
            f = f'fill="#{s["fill"]}"' if s.get("fill") else 'fill="none"'
            el.append(f'<ellipse cx="{s["cx"]}" cy="{s["cy"]}" rx="{s["rx"]}" ry="{s["ry"]}" {f} '
                      f'stroke="#{s["color"]}" stroke-width="{sw:.3f}"{dash}/>')
        elif s["kind"] == "text":
            t = []
            n = len(s["lines"])
            lh = s["pt"] * 0.3527777778 * 1.15
            for i, ln in enumerate(s["lines"]):
                dy = (i - (n - 1) / 2.0) * lh
                wgt = ' font-weight="700"' if s.get("bold") else ""
                anchor = "middle"
                t.append(f'<text x="{s["cx"]}" y="{s["cy"] + dy}" font-size="{s["pt"] * 0.3527777778:.3f}" '
                         f'fill="#{s["color"]}" text-anchor="{anchor}" dominant-baseline="central"{wgt}>'
                         f'{escape(ln)}</text>')
            tr = f' transform="rotate({s["rot"]} {s["cx"]} {s["cy"]})"' if s.get("rot") else ""
            box = (f'<rect x="{s["cx"]-s["w"]/2:.2f}" y="{s["cy"]-s["h"]/2:.2f}" width="{s["w"]}" '
                   f'height="{s["h"]}" fill="none" stroke="#CCCCCC" stroke-width="0.15"/>')
            el.append(f'<g{tr}>{box}{"".join(t)}</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" '
            f'viewBox="0 0 297 210" shape-rendering="geometricPrecision">'
            f'<rect x="0" y="0" width="297" height="210" fill="#FFFFFF"/>'
            f'<rect x="15" y="15" width="267" height="180" fill="none" stroke="#EEEEEE" stroke-width="0.3"/>'
            + "".join(el) + '</svg>')


def write_preview(path, scale=1.0, viewbox="0 0 297 210", title="Будка 1 — превью листа A4 (1:1)"):
    body = build_svg()
    body = body.replace('width="297mm" height="210mm" viewBox="0 0 297 210"',
                        f'width="{297*scale:.1f}mm" height="{210*scale:.1f}mm" viewBox="{viewbox}"')
    open(path, "w", encoding="utf-8").write(
        f'<!doctype html><meta charset="utf-8"><title>{title}</title>'
        '<style>body{margin:0;background:#555}svg{display:block;margin:8px auto;background:#fff;'
        'box-shadow:0 4px 18px rgba(0,0,0,.5);font-family:Arial,sans-serif}</style>' + body)


# ---------------------------------------------------------------- самопроверка макета
def footprint(s):
    """прямоугольник-футпринт надписи на листе, мм (с учётом поворота)"""
    w, h = s["w"], s["h"]
    if s.get("rot"):
        w, h = h, w
    return (s["cx"] - w / 2, s["cy"] - h / 2, s["cx"] + w / 2, s["cy"] + h / 2)


def seg_box(x1, y1, x2, y2, box):
    """пересекает ли отрезок прямоугольник (Liang–Barsky)"""
    bx0, by0, bx1, by1 = box
    dx, dy = x2 - x1, y2 - y1
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x1 - bx0), (dx, bx1 - x1), (-dy, y1 - by0), (dy, by1 - y1)):
        if p == 0:
            if q < 0:
                return False
        else:
            r = q / p
            if p < 0:
                if r > t1:
                    return False
                t0 = max(t0, r)
            else:
                if r < t0:
                    return False
                t1 = min(t1, r)
    return t0 < t1


def check(verbose=True):
    report = []
    geo = [s for s in shapes if s["layer"] in ("GEO", "REF")]
    texts = [s for s in shapes if s["kind"] == "text"]
    # 1. выход за пределы листа / запаса под печать
    for s in texts:
        x0, y0, x1, y1 = footprint(s)
        if x0 < 5 or y0 < 5 or x1 > 292 or y1 > 205:
            report.append(f"ВНЕ ПОЛЯ ПЕЧАТИ: {s['name']} box=({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f})")
    # 2. наложения текст-текст
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            a, b = footprint(texts[i]), footprint(texts[j])
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                report.append(f"ТЕКСТ-НА-ТЕКСТ: {texts[i]['name']} <-> {texts[j]['name']}")
    # 3. текст поверх геометрии (пересечениеLines)
    for s in texts:
        box = footprint(s)
        for g in geo:
            if g["kind"] == "line":
                if seg_box(g["x1"], g["y1"], g["x2"], g["y2"], box):
                    report.append(f"ТЕКСТ-НА-ГЕОМЕТРИЮ: {s['name']} <-> {g['name']}")
            elif g["kind"] == "rect":
                for (xx1, yy1, xx2, yy2) in ((g["x"], g["y"], g["x"] + g["w"], g["y"]),
                                             (g["x"] + g["w"], g["y"], g["x"] + g["w"], g["y"] + g["h"]),
                                             (g["x"], g["y"] + g["h"], g["x"] + g["w"], g["y"] + g["h"]),
                                             (g["x"], g["y"], g["x"], g["y"] + g["h"])):
                    if seg_box(xx1, yy1, xx2, yy2, box):
                        report.append(f"ТЕКСТ-НА-ГЕОМЕТРИЮ: {s['name']} <-> контур {g['name']}")
                        break
    if verbose:
        print(f"--- ПРОВЕРКА МАКЕТА: фигур {len(shapes)}, надписей {len(texts)}, замечаний {len(report)}")
        for r in report:
            print("  *", r)
    return report


if __name__ == "__main__":
    out_docx = "E:/Hermes/GuiRoof/docs/Будка1_план_размеры.docx"
    out_prev = "E:/Hermes/GuiRoof/docs/_budka1_preview.html"
    out_zoom = "E:/Hermes/GuiRoof/docs/_budka1_preview_zoom.html"
    out_json = "E:/Hermes/GuiRoof/docs/_budka1_shapes.json"
    write_docx(out_docx)
    write_preview(out_prev)
    write_preview(out_zoom, scale=1.5, viewbox="8 6 284 170",
                  title="Будка 1 — увеличенное превью (1.5x)")
    json.dump(shapes, open(out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    check()
    print("docx:", out_docx, os.path.getsize(out_docx), "bytes")
    print("preview:", out_prev)
    print("shapes:", len(shapes), "lines:", sum(1 for s in shapes if s["kind"] == "line"),
          "rects:", sum(1 for s in shapes if s["kind"] == "rect"),
          "texts:", sum(1 for s in shapes if s["kind"] == "text"))
