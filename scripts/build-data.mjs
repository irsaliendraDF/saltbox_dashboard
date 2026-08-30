// build-data.mjs
// Re-runnable snapshot generator for the Saltbox dashboard.
// Raw in: data/raw/Saltbox Fund Rural Retrofit Ecosystem Map.xlsx
// JSON out: data/*.json
// The Google Sheet is the system of record. Never hand-edit the JSON;
// re-export the workbook and re-run this script.

import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const RAW = "data/raw/Saltbox Fund Rural Retrofit Ecosystem Map.xlsx";
const wb = XLSX.read(readFileSync(RAW));

const sheet = (name) => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
};

// ---------- parsing helpers ----------

const DASH_NULLS = new Set(["—", "–", "-", "——", ""]);

// Numbers arrive as real numbers, "3,605", "37.7%", "+3.7%", "0", or a dash for unknown.
// A dash is null (unknown), never zero. Zero and unknown differ and the difference matters.
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (DASH_NULLS.has(s)) return null;
  s = s.replace(/,/g, "").replace(/^\+/, "");
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Shares arrive as "37.7%", "14%", or bare decimals like 0.13.
// Normalise everything to percentage points (0 to 100).
function pct(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v <= 1 ? round1(v * 100) : v;
  const s = String(v).trim();
  if (DASH_NULLS.has(s)) return null;
  const n = num(s);
  if (n === null) return null;
  return String(v).includes("%") ? n : n <= 1 ? round1(n * 100) : n;
}

const round1 = (n) => Math.round(n * 10) / 10;

const str = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || DASH_NULLS.has(s) ? null : s;
};

// FSA cells carry trailing spaces ("C0B ").
const fsa = (v) => {
  const s = str(v);
  return s ? s.toUpperCase().replace(/\s+/g, "") : null;
};

// Province banner rows look like "—NOVA SCOTIA—" or "── NOVA SCOTIA ──".
function bannerProvince(cell) {
  const s = str(cell);
  if (!s) return null;
  const m = s.match(/^[—–─\s]*([A-Z&.\s]+?)[—–─\s]*$/);
  if (!m) return null;
  const name = m[1].trim();
  const known = {
    "NOVA SCOTIA": "Nova Scotia",
    "PRINCE EDWARD ISLAND": "Prince Edward Island",
    "NEWFOUNDLAND & LABRADOR": "Newfoundland & Labrador",
    "NEW BRUNSWICK": "New Brunswick",
  };
  return known[name] ?? null;
}

// Join key for community names across sheets: case, punctuation, "&" vs "and",
// hyphens and stray spaces all vary between sheets.
const nameKey = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\./g, " ")
    .replace(/[''`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const writeJson = (path, obj) =>
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");

const report = [];
const log = (line) => {
  report.push(line);
  console.log(line);
};

// ---------- corrections and additions from KJ's written answers, 2026-08-30 ----------
//
// Two-level geography (his Q7 and Q13 answers): a community keeps its own postal
// code, and where it is genuinely connected to a surrounding rural code, that code
// is carried separately as a catchment. Cross-province borrowings are removed.
// clearCommunityDer: the community's own DER records in the Need Index were matched
// against a wrong-province code, so they are unknown, not the sheet's value.
const FSA_CORRECTIONS = new Map([
  ["Antigonish|Nova Scotia", { fsa: "B2G", catchment: "B0H" }],
  ["Wolfville|Nova Scotia", { fsa: "B4P", catchment: "B0P" }],
  ["New Glasgow|Nova Scotia", { fsa: "B2H", catchment: null, clearCommunityDer: true }],
  ["Sherbrooke|Prince Edward Island", { fsa: "C1N", catchment: null, clearCommunityDer: true }],
  ["Miltonvale Park|Prince Edward Island", { fsa: "C1E", catchment: null, clearCommunityDer: true }],
  ["Victoria|Prince Edward Island", { fsa: "C0A", catchment: null, clearCommunityDer: true }],
]);

// Saltbox pilot geography flag (his Q2 answer). Of the areas he named, only
// West Hants exists as a community in this dataset; the rest are places inside
// B0J and B0N or in rural HRM, which the four public sheets do not carry as rows.
const PILOT_FLAG = new Set(["West Hants|Nova Scotia"]);

// ---------- 1. Homeowner Profiles (province level) ----------

{
  const rows = sheet("Homeowner Profiles");
  const header = rows[4]; // Data Category | Indicator | Sub-indicator | NS | NB | PEI | NL
  const provinces = ["Nova Scotia", "New Brunswick", "Prince Edward Island", "Newfoundland & Labrador"];
  const out = [];
  let category = null;
  let rowsIn = 0;
  for (let i = 5; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => str(c) === null)) continue;
    if (String(r[0] ?? "").startsWith("SECTION")) continue;
    rowsIn++;
    if (str(r[0])) category = str(r[0]);
    // KJ's Q12 answer, 2026-08-30: these are provincial rural counts and the
    // sheet's "national rural" label is confusing. Renamed here; the sheet
    // itself should be relabelled so a future export drops this override.
    let indicator = str(r[1]);
    if (indicator === "Period of construction (national rural)") {
      indicator = "Rural dwellings by period of construction";
    }
    const rawVals = [r[3], r[4], r[5], r[6]];
    // Unit heuristic: any % string, or every non-null value at or below 1, means a share.
    const isPct =
      rawVals.some((v) => typeof v === "string" && v.includes("%")) ||
      rawVals.every((v) => v === null || (typeof v === "number" && v <= 1));
    const values = {};
    provinces.forEach((p, j) => {
      values[p] = isPct ? pct(rawVals[j]) : num(rawVals[j]);
    });
    out.push({
      category,
      indicator,
      sub_indicator: str(r[2]),
      unit: isPct ? "percent" : "count",
      values,
    });
  }
  writeJson("data/homeowner-profile-province.json", out);
  log(`Homeowner Profiles: ${rowsIn} data rows in, ${out.length} records out`);
}

// ---------- 2. Energy Poverty Profiles by Postal Code (community level) ----------

let epRecords;
{
  const rows = sheet("Rural Community Energy Poverty "); // trailing space is in the workbook
  const out = [];
  let province = null;
  let rowsIn = 0;
  for (let i = 5; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => str(c) === null)) continue;
    const banner = bannerProvince(r[0]);
    if (banner && r.slice(1).every((c) => str(c) === null)) {
      province = banner;
      continue;
    }
    rowsIn++;
    out.push({
      municipality: str(r[0]),
      fsa: fsa(r[1]),
      province,
      households_energy_poverty: num(r[2]),
      other_households: num(r[3]),
      below_poverty_line: num(r[4]),
      core_housing_need: num(r[5]),
      major_repair: num(r[6]),
      older_housing: num(r[7]),
      renters: num(r[8]),
      seniors: num(r[9]),
    });
  }
  writeJson("data/energy-poverty-fsa.json", out);
  epRecords = out;
  log(`Energy Poverty by Postal Code: ${rowsIn} data rows in, ${out.length} records out`);
}

// ---------- 3. DER Activity by Postal Code (FSA level, two stacked tables) ----------

const VOLUME_TIERS = ["0", "1–4", "5–9", "10–24", "25–49", "50–99", "100+"];
const GAP_FLAG_ORDER = ["Zero activity", "Very low", "Low", "Moderate", "Active", "High"];

let derRecords;
{
  const rows = sheet("DER Activity by Postal Code");
  const table1 = new Map(); // fsa -> record
  let province = null;
  let t1Rows = 0;
  for (let i = 3; i <= 47; i++) {
    const r = rows[i];
    if (!r || r.every((c) => str(c) === null)) continue;
    const banner = bannerProvince(r[0]);
    if (banner) {
      province = banner;
      continue;
    }
    t1Rows++;
    const gapRaw = str(r[7]); // e.g. "🔵 High"
    let gap_flag = null;
    if (gapRaw) {
      const label = gapRaw.replace(/^[^A-Za-z]+/, "").trim();
      gap_flag = { label, ordinal: GAP_FLAG_ORDER.indexOf(label) };
    }
    const tierLabel = str(r[6]);
    // Saltbox Priority (column 3) dropped per KJ's Q6 answer, 2026-08-30:
    // empty in all rows, out until it has values.
    table1.set(fsa(r[0]), {
      fsa: fsa(r[0]),
      province: str(r[1]) ?? province,
      region_county: str(r[2]),
      total_ders: num(r[4]),
      murbs: num(r[5]),
      volume_tier: tierLabel === null ? null : { label: tierLabel, ordinal: VOLUME_TIERS.indexOf(tierLabel) },
      gap_flag,
    });
  }

  // Table 2 starts under its own header row; find it by its first cell.
  const t2HeaderIdx = rows.findIndex((r) => r && str(r[0]) === "FSA" && String(r[4] ?? "").includes("50"));
  const bands = ["50–59", "60–69", "70–79", "80–89", "90–100"];
  const communities = (v) =>
    str(v) === null ? [] : String(v).split(",").map((s) => s.trim()).filter((s) => s && !DASH_NULLS.has(s));
  let t2Rows = 0;
  for (let i = t2HeaderIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => str(c) === null)) continue;
    if (bannerProvince(r[0])) continue;
    const key = fsa(r[0]);
    if (!key || !table1.has(key)) continue;
    t2Rows++;
    const perf = { bands: {}, total_sample: num(r[14]), best_band: str(r[15]), active_years: [] };
    bands.forEach((b, j) => {
      perf.bands[b + "%"] = { count: num(r[4 + j * 2]), communities: communities(r[5 + j * 2]) };
    });
    const years = str(r[16]);
    if (years) perf.active_years = years.split(",").map((s) => s.trim()).filter(Boolean);
    table1.get(key).performance = perf;
  }
  derRecords = [...table1.values()];
  derRecords.forEach((d) => { if (!("performance" in d)) d.performance = null; });
  writeJson("data/der-concentration.json", derRecords);
  log(`DER Activity: table 1 ${t1Rows} FSA rows in, table 2 ${t2Rows} FSA rows matched, ${derRecords.length} records out`);
}

// ---------- 4. Community Need Index (community level) ----------

const NEED_TIERS = ["Lower", "Moderate", "High", "Critical"];

let niRecords, niSummary;
{
  const rows = sheet("Community Need Index");
  const out = [];
  let province = null;
  let rowsIn = 0;
  let i = 5;
  for (; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => str(c) === null)) continue;
    if (String(r[0] ?? "").startsWith("SUMMARY")) break;
    const banner = bannerProvince(r[0]);
    if (banner) {
      province = banner;
      continue;
    }
    rowsIn++;
    const tierLabel = str(r[18]);
    out.push({
      community: str(r[0]),
      fsa: fsa(r[1]),
      province,
      households_energy_poverty: num(r[2]),
      other_households: num(r[3]),
      total_households: num(r[4]),
      ep_rate_pct: pct(r[5]),
      below_poverty_line: num(r[6]),
      core_housing_need: num(r[7]),
      major_repair: num(r[8]),
      major_repair_pct: pct(r[9]),
      older_housing: num(r[10]),
      older_housing_pct: pct(r[11]),
      renters: num(r[12]),
      seniors: num(r[13]),
      in_der_perf_map: str(r[14]) === "★", // star = yes, cross = no
      der_activity: num(r[15]),
      best_performance_band: str(r[16]),
      need_score: num(r[17]),
      need_tier: tierLabel === null ? null : { label: tierLabel, ordinal: NEED_TIERS.indexOf(tierLabel) },
    });
  }
  // Summary table under the data: verify it against the parsed rows.
  niSummary = [];
  for (; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => str(c) === null)) continue;
    if (str(r[0]) === "Province" || String(r[0] ?? "").startsWith("SUMMARY")) continue;
    niSummary.push({
      province: str(r[0]),
      critical: num(r[1]), high: num(r[2]), moderate: num(r[3]), lower: num(r[4]),
      in_der_map: num(r[5]), not_in_der_map: num(r[6]),
    });
  }
  writeJson("data/community-need-index.json", out);
  niRecords = out;
  log(`Community Need Index: ${rowsIn} data rows in, ${out.length} records out`);

  for (const s of niSummary) {
    const mine = niRecords.filter((r) => r.province === s.province || (s.province === "Newfoundland & Labrador" && r.province === "Newfoundland & Labrador"));
    const count = (tier) => mine.filter((r) => r.need_tier?.label === tier).length;
    const calc = { critical: count("Critical"), high: count("High"), moderate: count("Moderate"), lower: count("Lower"), in_der_map: mine.filter((r) => r.in_der_perf_map).length };
    const diffs = [];
    for (const k of ["critical", "high", "moderate", "lower", "in_der_map"]) {
      if (calc[k] !== s[k]) diffs.push(`${k}: sheet says ${s[k]}, rows say ${calc[k]}`);
    }
    log(diffs.length
      ? `  summary check, ${s.province}: MISMATCH (${diffs.join("; ")})`
      : `  summary check, ${s.province}: matches the sheet's own summary`);
  }
}

// ---------- 5. regions.json, the joined spine ----------
//
// Grain decision, made from the data rather than the plan: the workbook's finest
// common grain is the COMMUNITY, not the FSA. Rural PEI has dozens of communities
// inside two FSAs (C0A, C0B), so one-record-per-FSA would collapse most of PEI
// into two rows and lose the Need Index. The spine is therefore one record per
// community (the Need Index rows), carrying its FSA, with the FSA-level DER
// activity attached and clearly labelled as FSA-level context.

{
  const epByKey = new Map(epRecords.map((e) => [nameKey(e.municipality) + "|" + e.province, e]));
  const derByFsa = new Map(derRecords.map((d) => [d.fsa, d]));

  const spine = [];
  const fsaDisagreements = [];
  const niNotInEp = [];
  const niFsaNotInDer = [];

  for (const n of niRecords) {
    const key = `${n.community}|${n.province}`;
    const corr = FSA_CORRECTIONS.get(key) ?? null;
    const ep = epByKey.get(nameKey(n.community) + "|" + n.province) ?? null;
    if (!ep) niNotInEp.push(`${n.community} (${n.province})`);
    if (!corr && ep && ep.fsa && n.fsa && ep.fsa !== n.fsa) {
      fsaDisagreements.push(`${n.community} (${n.province}): need index says ${n.fsa}, energy poverty sheet says ${ep.fsa}`);
    }
    const ownFsa = corr ? corr.fsa : n.fsa;
    const catchment = corr ? corr.catchment : null;
    // Retrofit context comes from the community's own code when the DER sheet
    // covers it, otherwise from its rural catchment, clearly marked as such.
    const contextFsa = ownFsa && derByFsa.has(ownFsa) ? ownFsa
      : catchment && derByFsa.has(catchment) ? catchment
      : null;
    const der = contextFsa ? derByFsa.get(contextFsa) : null;
    if (ownFsa && !contextFsa) niFsaNotInDer.push(`${n.community} (${n.province}): FSA ${ownFsa}`);
    const clearDer = corr?.clearCommunityDer === true;
    spine.push({
      community: n.community,
      fsa: ownFsa,
      fsa_catchment: catchment,
      fsa_in_energy_poverty_sheet: ep?.fsa ?? null,
      municipality: ep?.municipality ?? null,
      province: n.province,
      region_county: der?.region_county ?? null,
      saltbox_pilot: PILOT_FLAG.has(key),
      energy_poverty: {
        households_energy_poverty: n.households_energy_poverty,
        other_households: n.other_households,
        total_households: n.total_households,
        ep_rate_pct: n.ep_rate_pct,
        below_poverty_line: n.below_poverty_line,
        core_housing_need: n.core_housing_need,
        major_repair: n.major_repair,
        major_repair_pct: n.major_repair_pct,
        older_housing: n.older_housing,
        older_housing_pct: n.older_housing_pct,
        renters: n.renters,
        seniors: n.seniors,
      },
      // Irene's ruling on KJ's Q4/Q10 answers, 2026-08-30: actual DER counts
      // remain internal; the public dashboard carries only the general retrofit
      // picture (the Activity signal and performance band). regions.json ships
      // in the public bundle, so no count fields appear here at all.
      retrofit_activity: {
        // clearDer: the sheet's community-level records were matched against a
        // wrong-province code, so the truth is unknown, not the sheet's value.
        in_der_perf_map: clearDer ? false : n.in_der_perf_map,
        best_performance_band: clearDer ? null : n.best_performance_band,
        // Area-level context, shared by every community in the same code.
        // context_fsa names where it came from; context_is_catchment marks it
        // as surrounding-area data rather than the community's own code.
        context_fsa: contextFsa,
        context_is_catchment: contextFsa !== null && contextFsa !== ownFsa,
        fsa_gap_flag: der?.gap_flag ?? null,
      },
      need_score: n.need_score,
      need_tier: n.need_tier,
    });
  }

  // Communities in the energy poverty sheet that never reached the need index.
  const niKeys = new Set(niRecords.map((n) => nameKey(n.community) + "|" + n.province));
  const epNotInNi = epRecords
    .filter((e) => !niKeys.has(nameKey(e.municipality) + "|" + e.province))
    .map((e) => `${e.municipality} (${e.province}${e.fsa ? ", " + e.fsa : ""})`);

  writeJson("data/regions.json", spine);
  log(`regions.json: ${spine.length} community records`);
  log(`Join coverage:`);
  log(`  need index matched to energy poverty sheet by name: ${spine.length - niNotInEp.length} of ${spine.length}`);
  log(`  need index communities with no energy poverty row: ${niNotInEp.length}${niNotInEp.length ? " -> " + niNotInEp.join("; ") : ""}`);
  log(`  energy poverty communities missing from need index: ${epNotInNi.length}${epNotInNi.length ? " -> " + epNotInNi.join("; ") : ""}`);
  log(`  FSA disagreements between the two sheets: ${fsaDisagreements.length}`);
  fsaDisagreements.forEach((d) => log(`    ${d}`));
  log(`  need index FSAs absent from the DER sheet: ${niFsaNotInDer.length}${niFsaNotInDer.length ? " -> " + niFsaNotInDer.join("; ") : ""}`);

  const catchments = spine.filter((s) => s.fsa_catchment !== null).length;
  const contextFromCatchment = spine.filter((s) => s.retrofit_activity.context_is_catchment).length;
  log(`Corrections applied (KJ answers 2026-08-30): ${FSA_CORRECTIONS.size} postal code fixes, ${catchments} rural catchments recorded, ${contextFromCatchment} communities drawing retrofit context from a catchment, ${spine.filter((s) => s.saltbox_pilot).length} pilot-flagged`);
}

writeFileSync("data/build-report.txt", report.join("\n") + "\n");
