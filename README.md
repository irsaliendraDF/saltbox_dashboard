# Saltbox Fund Rural Retrofit Dashboard

Interactive dashboard over the Saltbox Fund's community data for Atlantic Canada: energy poverty, housing condition, and deep energy retrofit activity, one record per rural community. Built so a funder can compare regions and see where need is high and retrofit activity is not.

Built by [DigitalFlow Consulting](https://digitalflowconsulting.ca) for Future Civics.

## Stack

- [Vite](https://vitejs.dev) + React, no backend, no database
- Tailwind CSS for styling
- Recharts for the two charts
- The whole dataset (105 communities) ships in the bundle as JSON; there is no fetching

## Run it

```
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

Deploys as a static Vite site. On Vercel: import the repo, accept the auto-detected Vite preset (build `npm run build`, output `dist`), deploy.

## Data

The Google Sheets workbook is the **system of record**. Everything under `data/` is a generated snapshot, never hand-edited. `SCHEMA.md` documents every file, field, unit, and mapping.

To regenerate: place the workbook export at `data/raw/Saltbox Fund Rural Retrofit Ecosystem Map.xlsx` (the raw export is deliberately not committed) and run:

```
npm run build-data
```

The script prints an honest join report on every run: rows in and out per sheet, join coverage between sheets, and every mismatch it found. It also verifies the workbook's own summary table against the parsed rows.

Two conventions worth knowing before reading any number:

- **Null means not recorded, zero means zero.** The UI renders unknowns as a dash, never as 0.
- **Retrofit activity exists at two levels.** Per community, and per FSA (postal area). Several communities share one FSA, so FSA totals are shown as shared context and are never summed across communities.

## Sources

Efficiency Canada Community-Level Energy Poverty Map · NRCan EnerGuide / Green Communities Canada 2020–2023 retrofit records · Statistics Canada 2021 census.
