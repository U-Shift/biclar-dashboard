# biclaR Dashboard

Interactive web GIS dashboard for the **biclaR** strategic cycle infrastructure and parking planning tool. Built with React, TypeScript, Vite, MapLibre GL, and Tailwind CSS.

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Compile & Run Locally

```sh
cd dashboard/
npm install
npm run dev
```

The application will be available at `http://localhost:5173/biclar-dashboard/` by default.

### Production Build

```sh
npm run build
npm run preview
```

---

## Configuration & Maintenance (`src/constants.tsx`)

The file [`src/constants.tsx`](src/constants.tsx) serves as the central configuration registry for the dashboard. It defines:
- **`LEVEL_CONFIG`**: Hierarchy levels (e.g. hex grid, parishes/freguesias, municipalities), data endpoints, and download links.
- **`MUNICIPALITIES_LIMITS_FILE`**: Path or URL to the GeoJSON boundary limits for municipalities (`municipios_limits.json`). This layer is overlaid as a visual boundary outline on finer zoom levels (`hex` and `freguesia`), and filtered dynamically by region.
- **`REGIONS`**: Regional bounding boxes, map centers, default zoom levels, and filtering keys.
- **`GLOBAL_FILTERS`** (formerly `MODES`): Context-agnostic global filter definitions and column suffixes (e.g. travel modes like `_pt`, `_bike`, `_car`, or bounds/scenarios like `_min`, `_max`).
- **`THEME_COLORS`** & **`COLORS`**: UI theme tokens and color scale ramps.
- **`METRIC_DATA`** / **`METRICS`**: All indicator and model metric definitions displayed in the dashboard.
- **`MAP_LAYERS`**: Base map tile providers (Carto/OpenFreeMap, Satellite, OSM).

---

## Adding New Variables (Metrics) & Variations

Metrics are registered under `METRIC_DATA` inside [`src/constants.tsx`](src/constants.tsx). They are grouped by category key:

```tsx
const METRIC_DATA: Record<string, Omit<MetricDef, 'category'>[]> = {
    'metrics.categories.models': [
        // Metric definitions...
    ],
    'metrics.categories.census_landuse': [
        // Metric definitions...
    ],
};
```

### Anatomy of a `MetricDef`

Each metric object adheres to the `MetricDef` type (defined in [`src/types.ts`](src/types.ts)):

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Base identifier, e.g `'model_intermodal_parking_palces'`. Can contain variation placeholders, e.g. `'model_mr{type}'` or `'access{poi_type}{time}'`. |
| `id_variations` | `Record<string, VariationGroup>` | Optional. Defines available values for each `{placeholder}` in `id`. |
| `valid_id_variations`| `Record<string, string>[]` | Optional. Explicit whitelist of valid variation combinations (if absent, auto-discovered from data). When defined, filters selection might hide other filters that are not compatible. |
| `label` | `string` | Translation key for the metric name (e.g. `'metrics.models.mr.label'`). |
| `description` | `string` | Translation key for the tooltip/description (e.g. `'metrics.models.mr.description'`). |
| `format` | `(v, min, max, filter, variations?) => string` | Formatting function for display values (e.g. `(v) => (v \|\| 0).toFixed(1)` or switching based on `variations?.type`). |
| `unit` | `(filter, v?, variations?) => string` | Optional. Display unit function (e.g. `() => 'min'`, `() => '%'`, `() => 'km'`). |
| `scaleMethod` | `ScaleMethod` | Scaling algorithm: `continuousScale`, `equalCountScale`, `equalIntervalScale`, or `logarithmicScale`. |
| `pallete` | `string[]` | Color ramp array (from `COLORS`, e.g. `COLORS.WhiteToBlue` or `COLORS.Viridis`). |
| `sources` | `string[]` | Optional. Source keys matched against `sources` in translation files (e.g. `['census', 'osm']`). |
| `default` | `boolean` | Set to `true` to make this the initial selected metric on dashboard load. |
| `showAlwaysOnDetails`| `boolean` | If `true`, this metric appears in the right "Area Details" sidebar even when not currently selected on the map. |
| `ignoreValues` | `any[]` | Array of specific values to exclude from scale calculation (e.g. `[null, 0, -999]`). |
| `scaleMin` / `scaleMax` | `number` | Optional hard bounds for the legend scale domain. |
| `scaleMinEqualsMax` | `boolean` | For diverging metrics centered at 0: ensures `[-max, +max]` domain. |
| `legendCategories` | `{ color, label }[]` | Explicit discrete legend categories for categorical layers (e.g. Land Use classes). |

### How Metric IDs & Variations Work

When resolving a metric value for a map feature, the dashboard constructs the target column name dynamically:

$$\text{Final Property ID} = \text{metric.id (with placeholders replaced)} + \text{effectiveGlobalFilter.suffix}$$

1. **Placeholders**: Any `{group}` (or `_{group}`) token in `metric.id` is replaced by the user's selected variation option.
   - For `options_tags`: `{group}` is replaced by the selected tag string.
   - For `options_icons`: if the option defines a `suffix`, `_{group}` is replaced by `suffix` (e.g. `thefts_n_{police_force}` with `suffix: ''` resolves to `thefts_n`, or with `suffix: '_psp'` resolves to `thefts_n_psp`).
2. **Global filter suffix**: When a metric supports global filters, the active filter's `suffix` from `GLOBAL_FILTERS` (e.g. bounds `_min`, `_max`, or infrastructure types `_protected`) is appended. If no global filter applies to the metric, no global suffix is added.

#### Defining Variations (`id_variations`)

A variation group is configured under `id_variations[groupName]` using either `options_tags` or `options_icons`:

```tsx
id_variations: {
    // 1. Tag-based variations (rendered as clickable chips in Left Sidebar):
    population_type: {
        options_tags: ['_population', '_adults', '_youth', '_elderly', '_women']
    },
    // 2. Continuous / ordinal variations (rendered as slider in Left Sidebar):
    walking_time: {
        options_tags: ['_15w', '_20w', '_30w'],
        globalFilters: ['pt'],       // Only visible when PT filter is active
        viewLevels: ['hex'],         // Only visible at hex grid level
        formSlider: true,            // Render as a range slider instead of tag chips
        visible: true                // Set false to hide selector in UI
    },
    // 3. Icon-based variations (rendered floating on the map canvas via GlobalFilterSelector):
    police_force: {
        options_icons: [
            { id: 'all', label: 'filters_global.all', suffix: '', icon: '🌐' },
            { id: 'psp', label: 'filters_global.psp', suffix: '_psp', icon: 'icons/psp.png' },
            { id: 'gnr', label: 'filters_global.gnr', suffix: '_gnr', icon: 'icons/gnr.png' },
        ]
    }
}
```

- **`options_tags`**: Array of string identifiers. Rendered in the Left Sidebar as button chips (or as a slider when `formSlider: true`).
- **`options_icons`**: Array of `VariationIconOption` objects (`{ id, label, suffix?, icon }`). Rendered directly in the floating map filter bar using `GlobalFilterSelector` (with tooltips, active rings, and image/emoji icon support), keeping the sidebar uncluttered.

### Step-by-Step: Adding a New Metric

1. **Define the metric in [`src/constants.tsx`](src/constants.tsx)** under `METRIC_DATA`:
   ```tsx
   'metrics.categories.models': [
       {
           id: 'parking_demand{scenario}',
           id_variations: {
               scenario: {
                   options_tags: ['_baseline', '_high_growth', '_low_growth']
               }
           },
           label: 'metrics.models.parking_demand.label',
           description: 'metrics.models.parking_demand.description',
           format: (v) => Math.round(v || 0).toLocaleString(),
           unit: () => 'bicycles',
           scaleMethod: continuousScale,
           pallete: COLORS.WhiteToGreen,
           sources: ['imob', 'census']
       }
   ]
   ```
2. **Add translation strings** in both [`src/locales/en.json`](src/locales/en.json) and [`src/locales/pt.json`](src/locales/pt.json) (see [Translations](#how-translations-work) below).
3. **Verify dataset columns**: Ensure the GeoJSON/CSV datasets contain matching properties: `parking_demand_baseline`, `parking_demand_high_growth`, and `parking_demand_low_growth`.

---

### Raw Data Layers (Custom GeoJSON)

The dashboard allows adding raw geographic feature layers (e.g. cycleway polylines, parking point locations, or custom zones) with their own dedicated GeoJSON files in `METRIC_DATA`:

- **On-Demand Loading**: Files for these layers are **only fetched when the user selects the layer**, ensuring fast initial load times.
- **Coordinate Reference System**: All GeoJSON files must be provided in **`EPSG:4326` (WGS84, `[longitude, latitude]`)**.
- **Flexible Data Types**: The layer `id` specifies the feature property in the GeoJSON to display:
  - **Categorical (strings)**: Uses `legendCategories` with `{ value, color, label }` to map string property values (e.g. `cycle_segregation`) to colors and legend entries.
  - **Numerical (numbers)**: Uses `scaleMethod`, `pallete`, and `format` to scale colors and calculate domains dynamically from the GeoJSON features. Points render as clean circle markers with proportional sizing.
- **Region Filtering (`region_id`)**: If the GeoJSON features contain a `region_id` property (e.g. `PT1A`, `PT1B`), the map's Region filter automatically filters the layer to only display features belonging to the selected region, and dynamically updates any numerical scale domains.
- **Custom Display Name (`get_name`)**: A function `(properties: any) => string` that extracts or formats the feature's title in the tooltip (e.g. `p.name || 'Ciclovia'`). If omitted, falls back to `properties.name`.
- **Feature Details Table (`get_details`)**: A function `(properties: any) => [string, string | number][]` returning an array of `[label, value]` tuples rendered as a clean, styled metadata table at the bottom of the hover tooltip.

#### Example 1: Categorical Raw Layer (Cycleways by Segregation)

```tsx
{
    id: 'cycle_segregation',
    url: `${DATA_BASE_URL}layer_cycleways.geojson`,
    icon: '🛣️',
    label: 'metrics.existing_infrastructure.cycle_segregation.label',
    description: 'metrics.existing_infrastructure.cycle_segregation.description',
    format: (v) => String(v || ''),
    pallete: ['#006837', '#31a354', '#78c679'],
    legendCategories: [
        { value: 'Protected Active', color: '#006837', label: 'metrics.cycle_segregation.protected_active' },
        { value: 'Cycle track or lane', color: '#31a354', label: 'metrics.cycle_segregation.cycle_track_lane' },
        { value: 'Advisory lane', color: '#78c679', label: 'metrics.cycle_segregation.advisory_lane' }
    ],
    get_name: (p) => p.name || 'Ciclovia',
    get_details: (p) => [
        ['OSM ID', p.osm_id || '-'],
        ['Tipologia', p.cycle_segregation || '-']
    ]
}
```

#### Example 2: Numerical Raw Layer (Bicycle Parking Capacity)

```tsx
{
    id: 'capacity',
    url: `${DATA_BASE_URL}layer_parking.geojson`,
    icon: '🚲',
    label: 'metrics.existing_infrastructure.parking_capacity.label',
    description: 'metrics.existing_infrastructure.parking_capacity.description',
    scaleMethod: continuousScale,
    pallete: COLORS.WhiteToGreen,
    format: (v) => Math.round(v || 0).toString(),
    get_name: (p) => p.ID ? `Ponto #${p.ID}` : 'Estacionamento',
    get_details: (p) => [
        ['ID', p.ID ?? '-'],
        ['Capacidade', p.capacity ? `${p.capacity} lugares` : '-']
    ]
}
```

---

## Global Filters (`GLOBAL_FILTERS`)

The dashboard features a context-agnostic global filter system registered in `GLOBAL_FILTERS` inside [`src/constants.tsx`](src/constants.tsx).

Rather than being tied strictly to travel modes, global filters allow any metric to be sliced by a global suffix.

### Structure of a Global Filter

```tsx
export const GLOBAL_FILTERS = [
    { id: 'all', label: 'modes.all', suffix: '', icon: '🌐' },
    { id: 'pt', label: 'modes.pt', suffix: '_pt', icon: '🚍' },
    { id: 'bike', label: 'modes.bike', suffix: '_bike', icon: '🚲' },
    { id: 'car', label: 'modes.car', suffix: '_car', icon: '🚗' },
    { id: 'min', label: 'filters_global.min', suffix: '_min', icon: '⬇️' },
    { id: 'max', label: 'filters_global.max', suffix: '_max', icon: '⬆️' }
] as const;
```

### Key Capabilities

1. **Context Agnostic**:
   - **Travel Modes**: `pt`, `bike`, `walk`, `car`, etc., appending suffixes like `_pt` or `_bike`.
   - **Bounds & Scenarios**: `min`, `max`, appending `_min` and `_max` (e.g. `model_mr_parking_residential_min` and `model_mr_parking_residential_max`).
2. **Dynamic UI Discovery & Metric Icon Variations**:
   - The floating selector (`GlobalFilterSelector`) on the map renders available `GLOBAL_FILTERS` as well as any metric-specific `options_icons` variation groups defined on the active metric.
   - For example, if a metric defines a `police_force` variation with `options_icons` for `🌐`, `psp`, and `gnr`, these appear as interactive icon buttons directly on the map canvas.
   - If a filter or variation group has fewer than 2 valid options, its selector automatically hides itself.
3. **Fallback Support (`suffixFallback`)**:
   - For calculated composite metrics (e.g. IMPT dynamic computation), `suffixFallback` specifies which suffix to fall back on if a mode or filter does not have a dedicated indicator column.
4. **Backward Compatibility**:
   - `MODES` and `ModeId` remain exported as aliases of `GLOBAL_FILTERS` and `GlobalFilterId`.
   - Metric variations support both `globalFilters` and legacy `modes` constraints in `id_variations`.

---

## Adapting Color Palettes

All color ramps are stored in the `COLORS` object in [`src/constants.tsx`](src/constants.tsx).

### Pre-defined Palettes
- **Sequential single/multi-hue**: `WhiteToRed`, `RedToWhite`, `WhiteToBlue`, `BlueToWhite`, `WhiteToGreen`.
- **Diverging & Scientific**: `RedToGreen`, `GreenToRed`, `Viridis`, `Inferno`, `Magma`.
- **Colorblind-safe alternatives**: `PiYG` (Pink to Yellow-Green), `PiYGRev`.

### Adding or Customizing a Palette
You can generate continuous 256-step color ramps using D3 / Observable schemes (e.g. from [Observable Color Schemes](https://observablehq.com/@d3/color-schemes)) or tools like ColorBrewer:

```tsx
export const COLORS = {
    // Add your new array of hex strings:
    PurpleToYellow: ["#440154", "#482878", "#3e4a89", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
    // ...
};
```

To reverse any palette, chain `.reverse()` (or create a slice first if not mutating):
```tsx
pallete: COLORS.Viridis.slice().reverse(),
```

### Colorblind Mode Integration
When the user toggles **Colorblind Mode** in the UI, [`src/utils.ts`](src/utils.ts) automatically substitutes problematic color ramps using `getAlternatePalette`:
- `RedToGreen` $\rightarrow$ `PiYG`
- `GreenToRed` $\rightarrow$ `PiYGRev`
- `WhiteToRed` $\rightarrow$ `WhiteToBlue`
- `RedToWhite` $\rightarrow$ `BlueToWhite`

If you introduce new palettes with red/green contrast, register their colorblind-safe counterparts in `getAlternatePalette` in [`src/utils.ts`](src/utils.ts).

### Brand & Theme Colors
Global brand colors (navbar, background shades, buttons) are configured in `THEME_COLORS` in [`src/constants.tsx`](src/constants.tsx):
```tsx
export const THEME_COLORS = {
    primary: '#001d06',
    primaryLight: '#00330b',
    primaryDark: '#001204',
    secondary: '#ffdd00',
    secondaryYellow: '#ffdd00',
};
```

---

## Dataset Assumptions & Data Contract

For the dashboard to correctly visualize features, drill down through subareas, filter by region, and render charts, the ingested GeoJSON and CSV datasets must satisfy specific schema requirements.

### Supported Geographic Levels (`LEVEL_CONFIG`)

Configured in `LEVEL_CONFIG` in [`src/constants.tsx`](src/constants.tsx):
- `freguesia` (parishes): parent level is `municipality`.
- `hex` (H3 hex grid cells): parent level is `freguesia`.

### Required Feature Properties (`properties`)

Each feature in the GeoJSON / CSV files **must** contain:

| Property | Type | Requirement | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `string \| number` | **Mandatory** | Unique identifier for each spatial unit (e.g. parish DICO code, hex H3 index). Required for hover states, selections, tooltips, and parent-child lookups. |
| `name` | `string` | Optional | Human-friendly name (e.g. `"Alvalade"`, `"Cascais"`). Used in tooltips and performer charts. Falls back to `id` if absent. |
| `group_id` | `string \| number` | **Mandatory for child levels** | Identifier of the parent feature in the level above. For example: hex features must have a `group_id` matching their containing `freguesia.id`. This powers:<br>1. **Subareas drilldown**: Clicking a parish displays its constituent hexes.<br>2. **Performer charts**: Child rows display their parent group name via `dataState.parentLookup`. |
| `region_id` / `nuts2` | `string` | **Mandatory** | Regional code matching keys in `REGIONS` in `constants.tsx` (e.g. `'PT1A'` for Grande Lisboa, `'PT1B'` for Península de Setúbal, or `'metropolis'`). When the user selects a region filter, features are filtered by `f.properties?.region_id === nutFilter \|\| f.properties?.nuts2 === REGIONS[nutFilter].name`. |
| Metric columns | `number \| string` | As configured | Attribute keys must exactly match the resolved metric IDs (e.g. `model_mr_parking_residential_min`, `dasymetric_population`, `mobility_infrastructure_length`). |

### Required Municipalities Limits Properties (`MUNICIPALITIES_LIMITS_FILE`)

The municipality boundary GeoJSON file referenced by `MUNICIPALITIES_LIMITS_FILE` (e.g. `data/municipios_limits.json`) must contain:

| Property / Field | Type | Requirement | Purpose |
| :--- | :--- | :--- | :--- |
| `region_id` | `string` | **Mandatory** | Regional identifier matching keys in `REGIONS` (e.g. `'PT1A'`, `'PT1B'`). Required for dynamically filtering the overlaid municipality boundaries when a specific sub-region is selected. |
| `municipio` / `name` | `string` | Optional | Name of the municipality (e.g. `"Alcochete"`, `"Lisboa"`). |
| `geometry` | `Polygon \| MultiPolygon` | **Mandatory** | Boundary geometries in EPSG:4326 for rendering the overlay outlines on `hex` and `freguesia` levels. |

### Geographic Format & CRS
- **File format**: GeoJSON (FeatureCollection) and CSV.
- **CRS**: EPSG:4326 (WGS84) latitude and longitude coordinates.

---

## How Translations Work

Internationalization is powered by **`i18next`** and **`react-i18next`** with automatic browser language detection, configured in [`src/i18n.ts`](src/i18n.ts).

### Locale Files
Translations are stored in two JSON files:
- **English (fallback)**: [`src/locales/en.json`](src/locales/en.json)
- **Portuguese**: [`src/locales/pt.json`](src/locales/pt.json)

### Translation Namespaces to Edit

When modifying or adding items, update both `en.json` and `pt.json`:

#### 1. Metric Names and Descriptions
Under `"metrics"`:
```json
"metrics": {
  "models": {
    "parking_demand": {
      "label": "Parking Demand",
      "description": "Estimated demand for bicycle parking facilities based on commuting models"
    }
  }
}
```

#### 2. Metric Variations & Filters
Under `"variations"`:
- The variation group name (key of `id_variations`):
  ```json
  "variations": {
    "scenario": "Planning Scenario",
    "_baseline": "Baseline (Current)",
    "_high_growth": "High Growth (+30%)",
    "_low_growth": "Conservative Growth"
  }
  ```

#### 3. Metric Categories
Under `"metrics"."categories"`:
```json
"metrics": {
  "categories": {
    "models": "Predictive Models",
    "census_landuse": "Census & Land Use"
  }
}
```

#### 4. Regions, Global Filters, Modes, and Sources
- **Regions**: under `"regions"` (e.g. `"regions": { "grand_lisbon": "Grande Lisboa" }`).
- **Global Filters**: under `"filters_global"` (e.g. `"filters_global": { "min": "Minimum", "max": "Maximum" }`).
- **Modes**: under `"modes"` (e.g. `"modes": { "bike": "Bicycle", "pt": "Public Transit" }`).
- **Data Sources**: under `"sources"` (e.g. `"sources": { "census": "Census 2021", "osm": "OpenStreetMap" }`).

### Best Practice Checklist for Adding a New Metric
- [ ] Add the metric object to `METRIC_DATA` in [`src/constants.tsx`](src/constants.tsx).
- [ ] Add the `label` and `description` keys to [`src/locales/en.json`](src/locales/en.json).
- [ ] Add the matching `label` and `description` keys to [`src/locales/pt.json`](src/locales/pt.json).
- [ ] If using new variations, add the group title and option labels under `"variations"` in both locale files.
- [ ] If using new global filters, add entries to `GLOBAL_FILTERS` in [`src/constants.tsx`](src/constants.tsx) and labels under `"filters_global"` in translation files.
- [ ] Confirm dataset columns in the GeoJSON/CSV files match the computed IDs.
