# Saltbox Dashboard data schema

Generated snapshot of the Saltbox Fund workbook. **The Google Sheet is the system of record.** These JSON files are never hand-edited. To refresh: re-export the workbook to `data/raw/Saltbox Fund Rural Retrofit Ecosystem Map.xlsx` and run:

```
node scripts/build-data.mjs
```

Source export: `Saltbox Fund Rural Retrofit Ecosystem Map.xlsx`, downloaded 2026-08-27. Underlying census data is the 2021 census (stated by KJ on the 2026-08-27 call). Four sheets are in scope for phase 1; the other ten are phase 4.

## Conventions that apply everywhere

- **Null means unknown, zero means zero.** The workbook uses dash characters (U+2014, U+2013) as "no data" markers. They become `null`. A real `0` in the workbook stays `0`. The difference matters to a funder: `A0L` has zero retrofits (a fact), while its MURB count is unknown.
- **Percentages are percentage points, 0 to 100.** The workbook mixes `"37.7%"` strings and bare decimals like `0.13`; both normalise to numbers (`37.7`, `13`). Any field ending `_pct`, and any homeowner record with `"unit": "percent"`, is on this scale.
- **Counts** arrive with thousands separators (`"3,605"`) and become plain numbers.
- **FSA** is the forward sortation area, the first three characters of a postal code, uppercased and stripped of the stray trailing spaces present in the workbook (`"C0B "` becomes `"C0B"`).
- **Province banner rows** inside sheets (rows styled like a Nova Scotia divider) are not data. They are dropped, and used to assign each record's `province`.
- Text fields keep the workbook's spelling as-is, including inconsistencies. Joins between sheets use a normalised key (lowercase, punctuation and hyphens to spaces, `&` to `and`) but the stored values are untouched.

## data/homeowner-profile-province.json

Source sheet: `Homeowner Profiles`. Grain: **one record per indicator row**, values held per province. 33 records. Real header is row 5 of the sheet; the merged title, subtitle and section banner above it are skipped.

| Field | Source column | Type | Notes |
|---|---|---|---|
| `category` | Data Category | string | Merged cells in the sheet; carried forward to every row in the block (Population, Age, Household size, Income, Tenure, Dwelling condition, Dwelling age, Housing suitability) |
| `indicator` | Indicator | string | |
| `sub_indicator` | Sub-indicator | string | Age bands, income bands, construction periods, etc. |
| `unit` | derived | `"percent"` or `"count"` | Detected per row: a `%` string anywhere, or every value at or below 1, means percent. The Nova Scotia column is mostly formatted strings while the other three provinces are bare decimals; both forms normalise identically |
| `values` | the four province columns | object | Keys: `Nova Scotia`, `New Brunswick`, `Prince Edward Island`, `Newfoundland & Labrador`. Null where the sheet has no value (NL is missing dwelling condition and housing suitability) |

Period of construction exists **only at this provincial level**. No sheet carries it per FSA; KJ accepted the provincial ceiling in writing 2026-08-30. The sheet's "Period of construction (national rural)" label is overridden in the build to "Rural dwellings by period of construction" at his instruction: the counts are provincial rural figures and the old label was confusing. The sheet itself should be relabelled so the override can go.

## data/energy-poverty-fsa.json

Source sheet: `Rural Community Energy Poverty ` (trailing space is in the workbook). Grain: **one record per rural municipality**. 106 records. Real header is row 5; energy poverty defined as spending more than 6% of after-tax income on home energy (sheet's own note). All count fields are household counts.

| Field | Source column | Type |
|---|---|---|
| `municipality` | Rural Municipality | string |
| `fsa` | Postal Code | string or null (11 municipalities have none) |
| `province` | assigned from banner rows | string |
| `households_energy_poverty` | Households in Energy Poverty | number |
| `other_households` | All other Households | number |
| `below_poverty_line` | Below Poverty Line | number or null |
| `core_housing_need` | In Core Housing Need | number or null |
| `major_repair` | In Major Repair | number or null |
| `older_housing` | In Older Housing | number or null (pre-1991 dwellings, sheet's own note) |
| `renters` | With renters | number or null |
| `seniors` | With seniors | number or null |

## data/der-concentration.json

Source sheet: `DER Activity by Postal Code`, which holds **two stacked tables**. Grain: **one record per FSA**, 41 records, with table 2 (performance bands) merged in by FSA where present (25 of 41). DER = deep energy retrofit. Coverage window 2020 to 2023, source Green Communities Canada / NRCan EnerGuide (sheet's own note).

| Field | Source | Type | Notes |
|---|---|---|---|
| `fsa` | T1: FSA | string | |
| `province`, `region_county` | T1 | string | |
| `total_ders` | T1: Total DERs (2020–2023) | number | `0` is a real zero. The sheet's Saltbox Priority column is not exported: empty in all 41 rows, dropped at KJ's written instruction 2026-08-30 until it has values |
| `murbs` | T1: of which MURBs | number or null | Dash means unknown, not zero. MURB = multi-unit residential building |
| `volume_tier` | T1: DER Volume Tier | object | `{label, ordinal}`. Labels and ordinals: `0`=0, `1–4`=1, `5–9`=2, `10–24`=3, `25–49`=4, `50–99`=5, `100+`=6. The sheet legend assigns emoji to these tiers; the emoji are dropped, the ordinal replaces them |
| `gap_flag` | T1: Gap Flag | object or null | Cell holds an emoji plus a label; the label is kept, the emoji dropped. `{label, ordinal}`: `Zero activity`=0, `Very low`=1, `Low`=2, `Moderate`=3, `Active`=4, `High`=5. Higher ordinal means more retrofit activity. Reading confirmed in writing by KJ 2026-08-30: it grades documented deep retrofit activity, not need, and the UI shows it as "Activity signal" with red for zero or very low, yellow low, green moderate or active, blue high |
| `performance` | table 2 | object or null | Null for the 16 FSAs with no performance-map presence (all of New Brunswick plus low-activity FSAs) |
| `performance.bands` | T2 band columns | object | Keys `50–59%` through `90–100%` (percent energy savings per retrofit). Each `{count, communities}`; `communities` is the sheet's raw comma-separated list split to an array, spelling and case variants left as found |
| `performance.total_sample` | T2: Total (sample) | number | |
| `performance.best_band` | T2: Best Performance | string | |
| `performance.active_years` | T2: Active Years | string array | |

## data/community-need-index.json

Source sheet: `Community Need Index`. Grain: **one record per community**, 105 records. Two stacked header rows (group above field) flattened; the summary table at the bottom of the sheet is used as a checksum, not exported. The build verifies the sheet's own per-province tier counts against the parsed rows and reports any mismatch (currently: all four provinces match).

Need Score formula, from the sheet's own note: EP rate (0 to 4 pts) + DER gap (0 to 3 pts) + major repair rate (0 to 2 pts) + older housing rate (0 to 1 pt), giving 0 to 10. Methodology detail lives in the workbook's `Need Index — Methodology` sheet (phase 4, but flagged on the call as the "check the methodology" reference for the dashboard).

| Field | Source column | Type | Notes |
|---|---|---|---|
| `community` | COMMUNITY / Community | string | |
| `fsa` | FSA | string or null | Disagrees with the energy poverty sheet for 6 communities (open question 9) |
| `province` | assigned from banner rows | string | |
| `households_energy_poverty` .. `seniors` | ENERGY POVERTY PROFILE group | numbers | Same measures as `energy-poverty-fsa.json`, plus `total_households`, `ep_rate_pct`, `major_repair_pct`, `older_housing_pct` |
| `in_der_perf_map` | In DER Perf. Map? | boolean | Sheet uses a star for yes, a cross for no |
| `der_activity` | DER Activity (# records) | number | `0` is a real zero |
| `best_performance_band` | Best Performance Band | string or null | |
| `need_score` | Need Score (0–10) | number | |
| `need_tier` | Need Tier | object | `{label, ordinal}`: `Lower`=0, `Moderate`=1, `High`=2, `Critical`=3. Sheet tier thresholds: Critical 7 to 10, High 5 to 6.9, Moderate 3 to 4.9, Lower below 3 |

## data/regions.json, the joined spine

**This is the only file the dashboard reads.** Grain: **one record per community**, 105 records.

**Grain decision, and why it differs from the build plan.** The plan assumed one record per FSA. The workbook's finest common grain is the community: rural PEI has 50 communities inside just two FSAs (`C0A`, `C0B`), so an FSA-grain spine would collapse most of PEI into two rows and lose the Need Index entirely. The spine is therefore the 105 Need Index communities, each joined to its energy poverty row by normalised name and province (105 of 105 matched), with FSA-level DER activity attached as clearly-labelled shared context.

**Two-level geography, per KJ's written answers 2026-08-30.** A community carries its own postal code (`fsa`) and, where genuinely connected, a surrounding rural code (`fsa_catchment`). Six postal codes are corrected in the build script relative to the Need Index sheet (`FSA_CORRECTIONS` in `build-data.mjs`): Antigonish B2G with catchment B0H, Wolfville B4P with catchment B0P, New Glasgow B2H, Sherbrooke PEI C1N, Miltonvale Park C1E, Victoria PEI C0A. The last four had cross-province codes in the sheet, so their community-level DER records are cleared to null: they were matched against the wrong region, which makes them unknown rather than the sheet's value.

| Field | From | Notes |
|---|---|---|
| `community`, `province` | need index | |
| `fsa` | need index, corrected | The community's own postal code |
| `fsa_catchment` | KJ 2026-08-30 | Surrounding rural code where genuinely connected, else null |
| `fsa_in_energy_poverty_sheet` | energy poverty sheet | Kept for transparency against the corrections |
| `municipality` | energy poverty sheet | |
| `region_county` | DER sheet, via context FSA | |
| `saltbox_pilot` | KJ 2026-08-30 | True for the Saltbox/HCi3 pilot geography (`PILOT_FLAG` in the script). The public flag prompts a funder to speak with Saltbox; no score is shown |
| `energy_poverty.*` | need index | The 12 household measures |
| `retrofit_activity.in_der_perf_map` | need index | **Tri-state, community level.** `true` retrofits are documented as reaching this community, `false` none are, `null` unknown (the four cross-province corrections). False and null are different and the UI renders them differently: "None" is a finding, a dash is an absence of data |
| `retrofit_activity.best_performance_band` | need index | Community-level; null for the four cross-province corrections |
| `retrofit_activity.context_fsa`, `.context_is_catchment` | derived | Where the signal comes from: the community's own code when the DER sheet covers it, else its catchment. `context_is_catchment: true` means it describes the surrounding rural area, and the UI labels it that way |
| `retrofit_activity.fsa_gap_flag` | DER sheet, via context FSA | The Activity signal, shared by every community with the same context code. Null when neither the community's code nor a catchment is in the DER sheet |

**Community level and area level are different measures, and the difference is the product.** `in_der_perf_map` says whether retrofits reached the community itself; `fsa_gap_flag` describes the whole surrounding postal area. Rural PEI is two postal areas, so 70 of 105 communities inherit a "High" area signal while 28 have had no retrofit documented in them at all, 15 of those in the Critical need tier. Reading the area signal alone inverts the investment argument, so the table, the tiles and the scatter all carry the community-level measure alongside it.

**Actual retrofit counts are internal**, Irene's ruling on KJ's Q4 and Q10 answers, 2026-08-30: the general retrofit picture (the signal and performance bands) is funder-facing, the DER counts are not. `regions.json` ships in the public bundle and therefore carries no count fields, and the two snapshot files that do carry counts, `der-concentration.json` and `community-need-index.json`, are generated locally but gitignored out of the public repo. Note: counts were present in the repo's git history from 2026-08-28 to 2026-08-30; they came from the DER sheet KJ presented as public on the call, so this is tightening, not a leak of something marked internal at the time.
| `need_score`, `need_tier` | need index | Scores are the workbook's own and are not recomputed, including for the four communities whose DER inputs were contaminated |

### Join coverage, reported honestly

- Need index to energy poverty sheet, by name and province: **105 of 105 matched**.
- Energy poverty sheet community missing from the need index: **1**, York (Prince Edward Island, C0A). KJ confirmed dropping it, 2026-08-30; it stays in `energy-poverty-fsa.json` only.
- FSA disagreements between the two sheets: **0 remaining** after the six corrections above (question 9's history records the originals).
- Communities whose own code and catchment are both absent from the DER sheet: **11** (their `fsa_total_ders` is null, which is unknown, not zero; KJ confirmed 2026-08-30 that no data exists for them).

The build prints all of this on every run and writes it to `data/build-report.txt`.

## data/ns-fsa-geo.json

Source: **Statistics Canada, 2021 Census forward sortation area boundary file** (`lfsa000a21a_e`), downloaded 2026-09-04. Generated by `scripts/build-geo.py`, stdlib only, re-runnable. The 21.7 MB source zip lives at `data/geo-src/` and is gitignored; only this 55 KB output ships.

**Nova Scotia only** (PRUID 12), per Irene's scope decision 2026-09-04. 77 postal areas, 86 rings.

The source is projected in NAD83 / Statistics Canada Lambert, which is centred on 91.87W for the whole country and therefore rotates Nova Scotia roughly 25 degrees off its familiar orientation. The script inverts that projection back to latitude and longitude in closed form, then re-projects with a local Mercator, so the province renders the way it looks on any ordinary map. Verified two ways: the inverse reproduces known Halifax, Dartmouth and Sydney coordinates to within 5 km, and the emitted paths satisfy seven spatial checks (Yarmouth southwest, Cape Breton northeast, Pictou north of Halifax, and so on).

| Field | Type | Notes |
|---|---|---|
| `viewBox` | string | SVG viewBox for the whole province, width normalised to 1000 |
| `features[].fsa` | string | Postal area code, joins to `regions.json` on `fsa` |
| `features[].d` | string | SVG path data, already in viewBox space. Multiple rings per area are concatenated, so islands render |
| `simplify_tolerance_m`, `min_ring_area_km2` | number | Douglas-Peucker tolerance and the island threshold, both recorded so the output is reproducible |

**Only 12 of the 77 areas carry community data.** The map draws the other 65 as no data rather than as zero, the same convention the rest of the dashboard uses.

## Need, and the gap between need and market activity

Added 2026-09-08 from KJ's feedback: the dashboard showed need better than it showed the gap between need and activity, and he asked for the two to be kept apart.

**The workbook's Need Score is not pure need.** Its own methodology sheet (`Need Index — Methodology`, Section 3) defines it as four sub-scores: energy poverty rate 0 to 4, **DER activity gap 0 to 3**, major repair 0 to 2, older housing 0 to 1. So 3 of its 10 points are already a retrofit-gap measure, which is why a community can rank highest on "need" precisely because nothing has reached it.

**Recomputing those four sub-scores reproduces all 105 published Need Scores exactly**, zero mismatches. That check is what licences the split below; without it the decomposition would be a guess.

| Field | Type | Notes |
|---|---|---|
| `need_score`, `need_tier` | number, object | The workbook composite, unchanged, so nothing his stakeholders have already seen is invalidated |
| `underlying_need` | number 0 to 10 | Energy poverty + major repair + older housing only, rescaled from 0 to 7. Need with activity removed |
| `activity` | object or null | `{label, gap_points}` using the workbook's own bands: 0 retrofits = "None documented" (3 gap points), 1 to 3 = "Very low" (2), 4 to 9 = "Low" (1), 10+ = "Active" (0). **Bands, never the raw count**, per Irene's ruling 2026-08-30 that the actual numbers stay internal while retrofits in general are funder-facing. Null where activity is genuinely unknown |
| `service_gap` | number 0 to 10 | `underlying_need × (gap_points / 3)`. High need with nothing reaching it scores highest; high need already being served scores low; low need scores low either way |
| `gap_band` | object or null | `{label, ordinal}`: Severe 7+, High 5 to 6.9, Moderate 3 to 4.9, Low above 0, Served 0 |
| `components` | object or null | The three need sub-scores and their maxima, so the detail panel can show what drives the gap |

**Worked contrast, and the one to show KJ.** Bedeque and Area and Mount Stewart have identical underlying need, 8.6. Bedeque has nothing documented reaching it, so its service gap is 8.6, the highest in the dataset. Mount Stewart has had retrofits reach it, so its gap falls to 2.9. The workbook score alone does not separate them clearly; the service gap does.

## The map, and what it does and does not cover

**The study area is rural only.** The methodology sheet states the retrofit data was "filtered to rural Atlantic Canada FSAs (A0, B0, C0, E0)", which is postal codes whose second character is `0`. **Nova Scotia has 77 postal areas and only 14 sit inside that frame.** The map therefore draws three distinct states rather than two, because KJ asked 2026-09-08 that it never imply "not recorded" means no activity:

- **Shaded by service gap** where communities are present
- **Hatched** where communities are present but retrofit activity is not recorded, so the gap is unknown rather than zero
- **Plain grey** for rural study-area codes with no community in the current filter
- **Faintest** for the 60 or so urban codes that were never part of the analysis at all

**A postal area is not a community.** `B0K` alone holds Pictou, Trenton, Stellarton and Westville. Areas are shaded by the largest service gap they contain, the community count is always shown, and the panel lists every community with its own gap. This is the grain mismatch KJ raised and it is disclosed rather than hidden.
