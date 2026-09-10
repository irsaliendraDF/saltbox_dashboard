"""
build-geo.py  --  re-runnable, raw in / JSON out, same contract as build-data.mjs.

In:  data/geo-src/lfsa000b21a_e.zip   StatCan 2021 Census forward sortation area (postal area)
                                      CARTOGRAPHIC boundary file
     data/geo-src/lcd_000b21a_e.zip   StatCan 2021 Census census division (county)
                                      CARTOGRAPHIC boundary file
     data/ns-community-points.json    NRCan official points for the dashboard's NS communities
Out: data/ns-fsa-geo.json

Nova Scotia only (PRUID 12), per Irene's scope decision 2026-09-04.

Why the CARTOGRAPHIC files. The first version of this map (2026-09-04) used the
DIGITAL boundary file, lfsa000a21a_e, whose coastal boundaries run out into the
water instead of following the shoreline. Its Nova Scotia polygons covered
76,209 km2 against 52,825 km2 of actual land, 44% too much, so bays and basins
were filled in and the province did not look like the real map. Feedback said as
much on 2026-09-10. The cartographic files are clipped to the shoreline; the
remaining excess (about 8%) sits in lake-dense Halifax postal areas, where lakes
legitimately stay inside the boundary.

Projection. Both files use NAD83 / Statistics Canada Lambert, centred on 91.87W
for the whole country, which rotates Nova Scotia about 25 degrees off the
orientation anyone recognises. Coordinates are inverted to latitude/longitude in
closed form, then re-projected with a local Mercator. Output is plain SVG path
data already in viewBox space: no projection library, no runtime dependency.

County borders are drawn only where two counties meet, found as edges the two
county polygons share exactly, so the coastline is drawn once (by the postal
areas) rather than twice slightly out of register.

Each postal area's county make-up is measured from the boundaries themselves by
sampling a grid of points inside it, so region names come from official
geography rather than from the workbook's hand-written labels, several of which
name the wrong counties.

Nothing here is hand-edited. Re-run after replacing any input.
"""
import zipfile, struct, json, math, os, collections

FSA_SRC = "data/geo-src/lfsa000b21a_e.zip"
CD_SRC = "data/geo-src/lcd_000b21a_e.zip"
POINTS_SRC = "data/ns-community-points.json"
OUT = "data/ns-fsa-geo.json"
NS_PRUID = "12"

SIMPLIFY_TOLERANCE_M = 200     # postal area outlines; sub-pixel at rendered sizes
COUNTY_LINE_TOLERANCE_M = 150  # internal county borders
MIN_RING_AREA_KM2 = 1.0        # drops specks; Cape Sable Island (Clark's Harbour) stays
SNAP_MAX_M = 3000              # an official point just offshore snaps to its nearest area
VIEWBOX_W = 1000.0
MIN_COUNTY_SHARE = 0.05        # smaller slivers are boundary noise, not a region

# ---------- projection ----------

LCC = dict(sp1=49.0, sp2=77.0, lat0=63.390675, lon0=-91.86666666666666,
           fe=6200000.0, fn=3000000.0, a=6378137.0, invf=298.257222101)


def _lcc(p):
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
    n = (math.log(m_of(p1)) - math.log(m_of(p2))) / (math.log(t_of(p1)) - math.log(t_of(p2)))
    F = m_of(p1) / (n * t_of(p1) ** n)
    rho0 = a * F * t_of(lat0) ** n

    def inverse(x, y):
        xp = x - p["fe"]
        yp = rho0 - (y - p["fn"])
        rho = math.copysign(math.hypot(xp, yp), n)
        t = (rho / (a * F)) ** (1.0 / n)
        lon = math.atan2(xp, yp) / n + lon0
        lat = math.pi / 2 - 2 * math.atan(t)
        for _ in range(12):
            s = math.sin(lat)
            nxt = math.pi / 2 - 2 * math.atan(t * ((1 - e * s) / (1 + e * s)) ** (e / 2))
            if abs(nxt - lat) < 1e-12:
                lat = nxt
                break
            lat = nxt
        return math.degrees(lon), math.degrees(lat)

    def forward(lon, lat):
        rho = a * F * t_of(math.radians(lat)) ** n
        th = n * (math.radians(lon) - lon0)
        return p["fe"] + rho * math.sin(th), p["fn"] + rho0 - rho * math.cos(th)

    return inverse, forward


to_lonlat, to_lambert = _lcc(LCC)


def mercator(lon, lat):
    return math.radians(lon), math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


# ---------- shapefile reading ----------

def read_layer(zip_path):
    """Return [(attributes, rings)] for Nova Scotia polygons, in Lambert metres."""
    z = zipfile.ZipFile(zip_path)
    base = next(n[:-4] for n in z.namelist() if n.lower().endswith(".shp"))
    prj = z.read(base + ".prj").decode("latin-1")
    for token in ("63.390675", "-91.86666", "6200000", "3000000"):
        if token not in prj:
            raise SystemExit(f"{zip_path}: projection changed ({token} missing); revisit LCC above")
    dbf = z.read(base + ".dbf")
    numrec, hdrlen, reclen = struct.unpack("<IHH", dbf[4:12])
    fields, off = [], 32
    while dbf[off] != 0x0D:
        fields.append((dbf[off:off + 11].split(b"\x00")[0].decode("latin-1"), dbf[off + 16]))
        off += 32
    attrs = []
    for i in range(numrec):
        rec = dbf[hdrlen + i * reclen: hdrlen + (i + 1) * reclen]
        pos, row = 1, {}
        for name, flen in fields:
            row[name] = rec[pos:pos + flen].decode("latin-1").strip()
            pos += flen
        attrs.append(row)
    shp = z.read(base + ".shp")
    out, pos, idx = [], 100, 0
    while pos < len(shp):
        _rn, clen = struct.unpack(">II", shp[pos:pos + 8])
        start = pos + 8
        pos = start + clen * 2
        a = attrs[idx]
        idx += 1
        if a.get("PRUID") != NS_PRUID or struct.unpack("<i", shp[start:start + 4])[0] != 5:
            continue
        nparts, npts = struct.unpack("<ii", shp[start + 36:start + 44])
        parts = struct.unpack(f"<{nparts}i", shp[start + 44:start + 44 + 4 * nparts])
        pb = start + 44 + 4 * nparts
        co = struct.unpack(f"<{npts * 2}d", shp[pb:pb + 16 * npts])
        rings = []
        for p in range(nparts):
            s = parts[p]
            e = parts[p + 1] if p + 1 < nparts else npts
            rings.append([(co[2 * k], co[2 * k + 1]) for k in range(s, e)])
        out.append((a, rings))
    return out


# ---------- geometry helpers ----------

def ring_area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return s / 2.0


def simplify(points, tol):
    """Douglas-Peucker, iterative so long rings cannot blow the stack."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        x1, y1 = points[first]
        x2, y2 = points[last]
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
            stack.append((first, maxi))
            stack.append((maxi, last))
    return [p for p, k in zip(points, keep) if k]


class Poly:
    """Point-in-polygon with edges bucketed into horizontal bands, even-odd rule."""

    def __init__(self, rings, bands=128):
        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        self.x0, self.x1, self.y0, self.y1 = min(xs), max(xs), min(ys), max(ys)
        self.nb = bands
        self.h = (self.y1 - self.y0) / bands or 1.0
        self.buckets = [[] for _ in range(bands)]
        for ring in rings:
            for i in range(len(ring) - 1):
                (ax, ay), (bx, by) = ring[i], ring[i + 1]
                if ay == by:
                    continue
                lo = self._band(min(ay, by))
                hi = self._band(max(ay, by))
                for b in range(lo, hi + 1):
                    self.buckets[b].append((ax, ay, bx, by))
        self.rings = rings

    def _band(self, y):
        return min(self.nb - 1, max(0, int((y - self.y0) / self.h)))

    def contains(self, x, y):
        if x < self.x0 or x > self.x1 or y < self.y0 or y > self.y1:
            return False
        c = False
        for ax, ay, bx, by in self.buckets[self._band(y)]:
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                c = not c
        return c

    def distance(self, x, y):
        best = float("inf")
        for ring in self.rings:
            for i in range(len(ring) - 1):
                (ax, ay), (bx, by) = ring[i], ring[i + 1]
                dx, dy = bx - ax, by - ay
                L = dx * dx + dy * dy
                u = 0.0 if L == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L))
                best = min(best, math.hypot(x - (ax + u * dx), y - (ay + u * dy)))
        return best


def grid_inside(poly, target=600):
    """A regular grid of points inside a polygon, densified for small polygons."""
    w, h = poly.x1 - poly.x0, poly.y1 - poly.y0
    step = math.sqrt(max(w * h, 1.0) / target)
    pts = []
    for _ in range(4):
        pts = []
        y = poly.y0 + step / 2
        while y < poly.y1:
            x = poly.x0 + step / 2
            while x < poly.x1:
                if poly.contains(x, y):
                    pts.append((x, y))
                x += step
            y += step
        if len(pts) >= 60:
            return pts
        step /= 2
    return pts


# ---------- postal areas ----------

raw_fsa, land = {}, {}
for a, rings in read_layer(FSA_SRC):
    raw_fsa.setdefault(a["CFSAUID"], []).extend(rings)
    land[a["CFSAUID"]] = land.get(a["CFSAUID"], 0.0) + float(a["LANDAREA"])

simp_fsa, kept_by_rule = {}, []
for fsa, rings in raw_fsa.items():
    kept = []
    for ring in rings:
        if len(ring) < 4 or abs(ring_area(ring)) / 1e6 < MIN_RING_AREA_KM2:
            continue
        s = simplify(ring, SIMPLIFY_TOLERANCE_M)
        if len(s) >= 4:
            kept.append(s)
    if not kept:
        # Every piece is under the island threshold: a small urban postal area.
        # Keep its largest piece at a finer tolerance rather than leave a hole.
        big = max(rings, key=lambda r: abs(ring_area(r)))
        s = simplify(big, 20)
        kept = [s if len(s) >= 4 else big]
        kept_by_rule.append(fsa)
    simp_fsa[fsa] = kept

# ---------- counties ----------

raw_cd = {}
for a, rings in read_layer(CD_SRC):
    raw_cd.setdefault(a["CDNAME"], []).extend(rings)

simp_cd = {}
for name, rings in raw_cd.items():
    kept = [simplify(r, SIMPLIFY_TOLERANCE_M) for r in rings
            if len(r) >= 4 and abs(ring_area(r)) / 1e6 >= MIN_RING_AREA_KM2]
    simp_cd[name] = [r for r in kept if len(r) >= 4]
cd_poly = {n: Poly(r) for n, r in simp_cd.items() if r}

# Internal county borders: edges that two counties share exactly.
edge_owner = collections.defaultdict(set)


def ekey(p):
    return (round(p[0], 2), round(p[1], 2))


for name, rings in raw_cd.items():
    for ring in rings:
        for i in range(len(ring) - 1):
            a, b = ekey(ring[i]), ekey(ring[i + 1])
            if a != b:
                edge_owner[(a, b) if a < b else (b, a)].add(name)
internal = [e for e, owners in edge_owner.items() if len(owners) >= 2]
adj = collections.defaultdict(set)
for a, b in internal:
    adj[a].add(b)
    adj[b].add(a)

seen, chains = set(), []


def norm(u, v):
    return (u, v) if u < v else (v, u)


def walk(start, nxt):
    chain, prev, cur = [start, nxt], start, nxt
    seen.add(norm(start, nxt))
    while len(adj[cur]) == 2:
        n2 = next(v for v in adj[cur] if v != prev)
        if norm(cur, n2) in seen:
            break
        seen.add(norm(cur, n2))
        chain.append(n2)
        prev, cur = cur, n2
    return chain


for node in list(adj):
    if len(adj[node]) != 2:
        for nb in adj[node]:
            if norm(node, nb) not in seen:
                chains.append(walk(node, nb))
for node in list(adj):
    for nb in adj[node]:
        if norm(node, nb) not in seen:
            chains.append(walk(node, nb))

# County make-up of each postal area, measured from the boundaries.
fsa_poly = {f: Poly(r) for f, r in simp_fsa.items()}
composition = {}
for fsa, poly in fsa_poly.items():
    counts, total = collections.Counter(), 0
    for x, y in grid_inside(poly):
        total += 1
        for name, cp in cd_poly.items():
            if cp.contains(x, y):
                counts[name] += 1
                break
    composition[fsa] = [{"name": n, "share": round(c / total, 2)} for n, c in counts.most_common()
                        if total and c / total >= MIN_COUNTY_SHARE]

# County label anchor: the inside point nearest the centroid of its largest ring.
labels = []
for name, rings in simp_cd.items():
    if not rings:
        continue
    big = max(rings, key=lambda r: abs(ring_area(r)))
    A = ring_area(big)
    cx = cy = 0.0
    for i in range(len(big) - 1):
        (x1, y1), (x2, y2) = big[i], big[i + 1]
        cr = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cr
        cy += (y1 + y2) * cr
    cx /= (6 * A)
    cy /= (6 * A)
    if not cd_poly[name].contains(cx, cy):
        inside = grid_inside(cd_poly[name], 400)
        cx, cy = min(inside, key=lambda q: (q[0] - cx) ** 2 + (q[1] - cy) ** 2)
    labels.append((name, cx, cy))

# ---------- community points ----------

pts_in = json.load(open(POINTS_SRC, encoding="utf-8"))
raw_poly = {f: Poly(r) for f, r in raw_fsa.items()}
placed = []
for c in pts_in["communities"]:
    x, y = to_lambert(c["lon"], c["lat"])
    hit = [f for f, p in raw_poly.items() if p.contains(x, y)]
    fsa, snapped = (hit[0] if hit else None), False
    if fsa is None:
        near = sorted((p.distance(x, y), f) for f, p in raw_poly.items()
                      if p.x0 - SNAP_MAX_M <= x <= p.x1 + SNAP_MAX_M
                      and p.y0 - SNAP_MAX_M <= y <= p.y1 + SNAP_MAX_M)
        if near and near[0][0] <= SNAP_MAX_M:
            fsa, snapped = near[0][1], True
    placed.append((c, x, y, fsa, snapped))

# ---------- into SVG space ----------

merc_fsa = {f: [[mercator(*to_lonlat(x, y)) for x, y in r] for r in rings]
            for f, rings in simp_fsa.items()}
xs = [p[0] for rings in merc_fsa.values() for r in rings for p in r]
ys = [p[1] for rings in merc_fsa.values() for r in rings for p in r]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
scale = VIEWBOX_W / (maxx - minx)
height = round((maxy - miny) * scale, 2)


def svg_xy(mx, my):
    return (mx - minx) * scale, (maxy - my) * scale


def lam_to_svg(x, y):
    return svg_xy(*mercator(*to_lonlat(x, y)))


def ring_path(ring):
    return "M" + "L".join(f"{sx:.1f},{sy:.1f}" for sx, sy in (svg_xy(mx, my) for mx, my in ring)) + "Z"


features = [{
    "fsa": f,
    "in_frame": len(f) > 1 and f[1] == "0",
    "counties": composition.get(f, []),
    "d": "".join(ring_path(r) for r in merc_fsa[f]),
} for f in sorted(merc_fsa)]

county_lines = []
for ch in chains:
    s = simplify(list(ch), COUNTY_LINE_TOLERANCE_M)
    if len(s) >= 2:
        county_lines.append("M" + "L".join(f"{sx:.1f},{sy:.1f}" for sx, sy in (lam_to_svg(x, y) for x, y in s)))

# Keep county names clear of the community dots so no name hides behind them.
dots_svg = [lam_to_svg(x, y) for _c, x, y, _f, _s in placed]


def label_clear(name, sx, sy):
    hw, hh = 4.3 * len(name) + 4, 11
    return all(abs(sx - dx) >= hw + 10 or abs(sy - dy) >= hh + 10 for dx, dy in dots_svg)


settled, moved = [], []
for n, x, y in labels:
    if not label_clear(n, *lam_to_svg(x, y)):
        cands = [q for q in grid_inside(cd_poly[n], 900) if label_clear(n, *lam_to_svg(*q))]
        if cands:
            x, y = min(cands, key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)
            moved.append(n)
    settled.append((n, x, y))
labels = settled

county_labels = []
for n, x, y in labels:
    sx, sy = lam_to_svg(x, y)
    county_labels.append({"name": n, "x": round(sx, 1), "y": round(sy, 1)})

points = []
for c, x, y, fsa, snapped in placed:
    sx, sy = lam_to_svg(x, y)
    points.append({"community": c["community"], "county": c["county"], "fsa": fsa,
                   "snapped": snapped, "x": round(sx, 1), "y": round(sy, 1)})

payload = {
    "source": "Statistics Canada, 2021 Census cartographic boundary files: forward sortation areas "
              "(lfsa000b21a_e) and census divisions (lcd_000b21a_e). Community points: NRCan "
              "Canadian Geographical Names Database.",
    "projection": "NAD83 / Statistics Canada Lambert, inverted and re-projected to local Mercator, "
                  "scaled to the viewBox",
    "province": "Nova Scotia",
    "viewBox": f"0 0 {VIEWBOX_W:.0f} {height}",
    "simplify_tolerance_m": SIMPLIFY_TOLERANCE_M,
    "min_ring_area_km2": MIN_RING_AREA_KM2,
    "features": features,
    "county_lines": county_lines,
    "county_labels": county_labels,
    "points": points,
}
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
    fh.write("\n")

# ---------- report ----------

drawn = sum(abs(ring_area(r)) for rings in simp_fsa.values() for r in rings) / 1e6
total_land = sum(land.values())
print(f"Nova Scotia postal areas: {len(features)}  (in rural study frame: {sum(f['in_frame'] for f in features)})")
print(f"drawn area {drawn:,.0f} km2 vs StatCan land area {total_land:,.0f} km2 -> ratio {drawn / total_land:.3f}")
print(f"county labels moved clear of community dots: {moved or 'none'}")
print(f"small postal areas kept by largest-piece rule: {kept_by_rule or 'none'}")
print(f"counties: {len(simp_cd)} | shared border edges: {len(internal):,} -> {len(county_lines)} border lines")
print("community placement (official point -> postal area):")
for c, x, y, fsa, sn in placed:
    print(f"   {c['community']:17} {c['county']:11} -> {fsa}{'  (snapped from just offshore)' if sn else ''}")
print("rural postal areas, county make-up measured from the boundaries:")
for f in features:
    if f["in_frame"]:
        print(f"   {f['fsa']}: " + ", ".join(f"{c['name']} {round(c['share'] * 100)}%" for c in f["counties"]))
print(f"{OUT}: {os.path.getsize(OUT):,} bytes")
