"""
build-geo.py  --  re-runnable, raw in / JSON out, same contract as build-data.mjs.

In:  data/geo-src/lfsa000a21a_e.zip
     Statistics Canada 2021 Census forward sortation area boundary file.
Out: data/ns-fsa-geo.json

Nova Scotia only (PRUID 12), per Irene's scope decision 2026-09-04.

Coordinates arrive in NAD83 / Statistics Canada Lambert. That projection is
centred on 91.87W for the whole country, so at Nova Scotia's longitude it rotates
the province about 25 degrees off the orientation everyone recognises. So the
Lambert coordinates are inverted back to latitude and longitude (closed form,
stdlib maths, parameters read from the .prj below), then re-projected with a
local Mercator. Nova Scotia then renders the way it looks on any familiar map.

No projection library and no runtime dependency: the output is plain SVG path
data, already in viewBox space.

Nothing here is hand-edited. Re-run after replacing the source zip.
"""
import zipfile, struct, json, math, os

SRC = "data/geo-src/lfsa000a21a_e.zip"
BASE = "lfsa000a21a_e/lfsa000a21a_e"
OUT = "data/ns-fsa-geo.json"
NS_PRUID = "12"

# Projection parameters, read from lfsa000a21a_e.prj. Hard-coded rather than
# parsed because the inverse below is written for this projection specifically;
# if the source file ever changes projection, this script must be revisited.
LCC = dict(sp1=49.0, sp2=77.0, lat0=63.390675, lon0=-91.86666666666666,
           fe=6200000.0, fn=3000000.0, a=6378137.0, invf=298.257222101)

SIMPLIFY_TOLERANCE_M = 250    # sub-pixel at the sizes this map renders
MIN_RING_AREA_KM2 = 1.5       # drops specks, keeps real islands
VIEWBOX_W = 1000.0

z = zipfile.ZipFile(SRC)

# ---- DBF: attributes, one record per shape, in the same order as the SHP ----
dbf = z.read(BASE + ".dbf")
numrec, hdrlen, reclen = struct.unpack("<IHH", dbf[4:12])
fields, off = [], 32
while dbf[off] != 0x0D:
    name = dbf[off:off + 11].split(b"\x00")[0].decode("latin-1")
    fields.append((name, dbf[off + 16]))
    off += 32

attrs = []
for i in range(numrec):
    rec = dbf[hdrlen + i * reclen: hdrlen + (i + 1) * reclen]
    pos, row = 1, {}          # byte 0 is the deletion flag
    for name, flen in fields:
        row[name] = rec[pos:pos + flen].decode("latin-1").strip()
        pos += flen
    attrs.append(row)

# ---- SHP: polygon rings, only for the records we want ----
shp = z.read(BASE + ".shp")

def read_polygons(buf):
    """Yield (record_index, [ring, ...]) for polygon records. Rings are [(x, y), ...]."""
    pos, idx = 100, 0
    n = len(buf)
    while pos < n:
        _recnum, clen = struct.unpack(">II", buf[pos:pos + 8])
        content = buf[pos + 8: pos + 8 + clen * 2]
        pos += 8 + clen * 2
        shape_type = struct.unpack("<i", content[0:4])[0]
        if shape_type != 5:                      # 0 = null, 5 = polygon
            yield idx, []
            idx += 1
            continue
        nparts, npoints = struct.unpack("<ii", content[36:44])
        parts = struct.unpack("<%di" % nparts, content[44:44 + 4 * nparts])
        pbase = 44 + 4 * nparts
        coords = struct.unpack("<%dd" % (npoints * 2), content[pbase: pbase + 16 * npoints])
        rings = []
        for p in range(nparts):
            start = parts[p]
            end = parts[p + 1] if p + 1 < nparts else npoints
            rings.append([(coords[2 * k], coords[2 * k + 1]) for k in range(start, end)])
        yield idx, rings
        idx += 1

def _lcc_inverse_factory(p):
    """Closed-form inverse Lambert Conformal Conic (2SP) on the GRS80 ellipsoid."""
    a = p["a"]
    f = 1.0 / p["invf"]
    e = math.sqrt(2 * f - f * f)

    def t_of(lat):
        s = math.sin(lat)
        return math.tan(math.pi / 4 - lat / 2) / ((1 - e * s) / (1 + e * s)) ** (e / 2)

    def m_of(lat):
        s = math.sin(lat)
        return math.cos(lat) / math.sqrt(1 - e * e * s * s)

    p1, p2 = math.radians(p["sp1"]), math.radians(p["sp2"])
    lat0, lon0 = math.radians(p["lat0"]), math.radians(p["lon0"])
    m1, m2, t1, t2 = m_of(p1), m_of(p2), t_of(p1), t_of(p2)
    n = (math.log(m1) - math.log(m2)) / (math.log(t1) - math.log(t2))
    F = m1 / (n * t1 ** n)
    rho0 = a * F * t_of(lat0) ** n

    def inverse(x, y):
        xp = x - p["fe"]
        yp = rho0 - (y - p["fn"])
        rho = math.copysign(math.hypot(xp, yp), n)
        t = (rho / (a * F)) ** (1.0 / n)
        theta = math.atan2(xp, yp)
        lon = theta / n + lon0
        lat = math.pi / 2 - 2 * math.atan(t)          # first approximation
        for _ in range(12):                            # converges in a handful
            s = math.sin(lat)
            lat_new = math.pi / 2 - 2 * math.atan(t * ((1 - e * s) / (1 + e * s)) ** (e / 2))
            if abs(lat_new - lat) < 1e-12:
                lat = lat_new
                break
            lat = lat_new
        return math.degrees(lon), math.degrees(lat)

    return inverse


to_lonlat = _lcc_inverse_factory(LCC)


def mercator(lon, lat):
    """Local Mercator. Familiar orientation, and near-conformal at this scale."""
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def ring_area_km2(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0 / 1_000_000.0

def simplify(points, tol):
    """Douglas-Peucker, iterative so deep rings cannot blow the stack."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        x1, y1 = points[first]; x2, y2 = points[last]
        dx, dy = x2 - x1, y2 - y1
        denom = math.hypot(dx, dy)
        maxd, maxi = -1.0, first
        for i in range(first + 1, last):
            px, py = points[i]
            if denom == 0:
                d = math.hypot(px - x1, py - y1)
            else:
                d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / denom
            if d > maxd:
                maxd, maxi = d, i
        if maxd > tol:
            keep[maxi] = True
            stack.append((first, maxi)); stack.append((maxi, last))
    return [p for p, k in zip(points, keep) if k]

# ---- collect Nova Scotia ----
shapes = {}
for idx, rings in read_polygons(shp):
    if idx >= len(attrs):
        break
    a = attrs[idx]
    if a.get("PRUID") != NS_PRUID:
        continue
    fsa = a["CFSAUID"]
    kept = []
    for ring in rings:
        if len(ring) < 4 or ring_area_km2(ring) < MIN_RING_AREA_KM2:
            continue
        s = simplify(ring, SIMPLIFY_TOLERANCE_M)
        if len(s) >= 4:
            kept.append([mercator(*to_lonlat(x, y)) for x, y in s])
    if kept:
        shapes.setdefault(fsa, []).extend(kept)

if not shapes:
    raise SystemExit("No Nova Scotia shapes found; check PRUID filter.")

# ---- normalise into SVG space, preserving aspect ----
xs = [p[0] for rings in shapes.values() for r in rings for p in r]
ys = [p[1] for rings in shapes.values() for r in rings for p in r]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
span_x, span_y = maxx - minx, maxy - miny
scale = VIEWBOX_W / span_x
height = round(span_y * scale, 2)

def to_path(rings):
    out = []
    for ring in rings:
        pts = []
        for x, y in ring:
            sx = (x - minx) * scale
            sy = (maxy - y) * scale        # SVG y grows downward
            pts.append(f"{sx:.1f},{sy:.1f}")
        out.append("M" + "L".join(pts) + "Z")
    return "".join(out)

features = [{"fsa": fsa, "d": to_path(rings)} for fsa, rings in sorted(shapes.items())]
payload = {
    "source": "Statistics Canada, 2021 Census forward sortation area boundary file (lfsa000a21a_e)",
    "projection": "NAD83 / Statistics Canada Lambert, scaled linearly to the viewBox",
    "province": "Nova Scotia",
    "viewBox": f"0 0 {VIEWBOX_W:.0f} {height}",
    "simplify_tolerance_m": SIMPLIFY_TOLERANCE_M,
    "min_ring_area_km2": MIN_RING_AREA_KM2,
    "features": features,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, separators=(",", ":"))
    f.write("\n")

print(f"Nova Scotia FSAs: {len(features)}")
print(f"rings kept: {sum(len(r) for r in shapes.values())}")
print(f"viewBox: {payload['viewBox']}")
print(f"{OUT}: {os.path.getsize(OUT):,} bytes")
