import { continuousScale, equalIntervalScale, COLORS } from "./constants";
import { MetricDef, VariationGroup } from "./types";

/**
 * Helper to get the list of option string identifiers for a VariationGroup.
 */
export const getVariationOptions = (groupDef: VariationGroup | undefined): string[] => {
    if (!groupDef) return [];
    if (Array.isArray(groupDef)) return groupDef;
    if (groupDef.options_icons && groupDef.options_icons.length > 0) {
        return groupDef.options_icons.map(o => o.id);
    }
    if (groupDef.options_tags && groupDef.options_tags.length > 0) {
        return groupDef.options_tags;
    }
    return [];
};

/**
 * Helper to get the display label for an option in a VariationGroup.
 */
export const getVariationOptionLabel = (groupDef: VariationGroup | undefined, optId: string, t: (k: string, opts?: any) => any): string => {
    if (groupDef && !Array.isArray(groupDef) && groupDef.options_icons) {
        const found = groupDef.options_icons.find(o => o.id === optId);
        if (found) return t(found.label);
    }
    const variationsObj = t('variations', { returnObjects: true });
    if (variationsObj && typeof variationsObj === 'object' && optId in variationsObj) {
        return variationsObj[optId];
    }
    return t(`variations.${optId}`);
};


/**
 * Checks if a value should be ignored based on metric settings and common data issues (null, undefined, NaN),
 * or custom row/feature filtering condition.
 */
export const isMetricValueIgnored = (val: any, metric: MetricDef, properties?: any, filter?: any, variations?: Record<string, string>): boolean => {
    if (val === null || val === undefined || isNaN(Number(val))) return true;
    if (metric.filterValues && properties !== undefined) {
        const filterId = typeof filter === 'object' && filter !== null ? filter.id : filter;
        const effectiveVariations: Record<string, string> = { ...variations };
        if (metric.id_variations) {
            Object.entries(metric.id_variations).forEach(([group, groupDef]) => {
                if (!effectiveVariations[group]) {
                    effectiveVariations[group] = Array.isArray(groupDef)
                        ? groupDef[0]
                        : (groupDef.options_icons ? groupDef.options_icons[0].id : '');
                }
            });
        }
        if (!metric.filterValues(properties, val, filterId, effectiveVariations)) {
            return true;
        }
    }
    return false;
};

/**
 * Checks if a value should be excluded from the color ramp / scale domain calculation,
 * while still remaining visible on the map, tooltips, and details.
 */
export const isMetricValueExcludedFromColorRamp = (val: any, metric: MetricDef, properties?: any, filter?: any, variations?: Record<string, string>): boolean => {
    if (isMetricValueIgnored(val, metric, properties, filter, variations)) return true;
    if (metric.filterColorRamp && properties !== undefined) {
        const filterId = typeof filter === 'object' && filter !== null ? filter.id : filter;
        const effectiveVariations: Record<string, string> = { ...variations };
        if (metric.id_variations) {
            Object.entries(metric.id_variations).forEach(([group, groupDef]) => {
                if (!effectiveVariations[group]) {
                    effectiveVariations[group] = Array.isArray(groupDef)
                        ? groupDef[0]
                        : (groupDef.options_icons ? groupDef.options_icons[0].id : '');
                }
            });
        }
        if (!metric.filterColorRamp(properties, val, filterId, effectiveVariations)) {
            return true;
        }
    }
    return false;
};
/**
 * Generates a scale (domain or breaks) based on the metric's scaling method.
 */

export const getMetricDomain = (values: number[], metric: MetricDef): number[] => {
    // Filter out ignored values, nulls, and NaNs
    const sorted = [...values]
        .filter(v => !isMetricValueIgnored(v, metric))
        .sort((a, b) => a - b);

    if (sorted.length === 0) return [0, 1];

    const method = metric.scaleMethod || continuousScale;

    let scale = method(sorted, metric.steps);

    if (metric.scaleMinEqualsMax) {
        const maxAbs = Math.max(Math.abs(scale[0]), Math.abs(scale[scale.length - 1]));
        if (method === equalIntervalScale) {
            scale = equalIntervalScale([-maxAbs, maxAbs], metric.steps);
        } else if (method === continuousScale || scale.length === 2) {
            scale = [-maxAbs, maxAbs];
        } else {
            scale[0] = -maxAbs;
            scale[scale.length - 1] = maxAbs;
        }
    }

    if (metric.scaleMin !== undefined) scale[0] = metric.scaleMin;
    if (metric.scaleMax !== undefined) scale[scale.length - 1] = metric.scaleMax;

    return scale;
};
/**
 * Maps a value to a palette index based on the domain type (discrete vs continuous).
 */
const getPaletteIndex = (val: number, domain: number[], paletteLength: number): number => {
    if (domain.length > 2) {
        // Discrete scale breaks (quantiles/slices)
        const nSlices = domain.length - 1;
        let sliceIdx = 0;
        if (val <= domain[0]) {
            sliceIdx = 0;
        } else if (val >= domain[domain.length - 1]) {
            sliceIdx = nSlices - 1;
        } else {
            for (let i = 0; i < nSlices; i++) {
                if (val >= domain[i] && val <= domain[i + 1]) {
                    sliceIdx = i;
                    break;
                }
            }
        }
        return Math.min(Math.floor((sliceIdx / nSlices) * paletteLength), paletteLength - 1);
    } else {
        // Continuous linear interpolation mapping
        const [min, max] = domain;
        const range = max - min;
        if (range === 0) return Math.floor(paletteLength / 2);
        const norm = Math.max(0, Math.min(1, (val - min) / range));
        return Math.min(Math.floor(norm * paletteLength), paletteLength - 1);
    }
};
/**
 * Maps a palette to a color blind friendly alternative if applicable.
 */
export const getAlternatePalette = (palette: string[]): string[] => {
    if (palette === COLORS.RedToGreen) return COLORS.PiYG;
    if (palette === COLORS.GreenToRed) return COLORS.PiYGRev;
    if (palette === COLORS.WhiteToRed) return COLORS.WhiteToBlue;
    if (palette === COLORS.RedToWhite) return COLORS.BlueToWhite;
    return palette;
};

/**
 * Returns the color for a given value based on the metric palette and domain.
 */

export const getColor = (val: number, domain: number[], metric: MetricDef, isColorBlindMode: boolean = false): string => {
    if (isMetricValueIgnored(val, metric)) return 'rgba(0,0,0,0.05)';
    const palette = isColorBlindMode ? getAlternatePalette(metric.pallete) : metric.pallete;
    const idx = getPaletteIndex(val, domain, palette.length);
    return palette[idx];
};
/**
 * Generates a CSS linear-gradient for the legend representation of a metric.
 */

export const getLegendGradient = (metric: MetricDef, domain: number[], isColorBlindMode: boolean = false): string => {
    const palette = isColorBlindMode ? getAlternatePalette(metric.pallete) : metric.pallete;
    if (domain.length > 2) {
        const nSlices = domain.length - 1;
        const gradientParts = [];
        for (let i = 0; i < nSlices; i++) {
            const paletteIdx = Math.min(Math.floor((i / nSlices) * palette.length), palette.length - 1);
            const color = palette[paletteIdx];
            const start = (i / nSlices) * 100;
            const end = ((i + 1) / nSlices) * 100;
            gradientParts.push(`${color} ${start}% ${end}%`);
        }
        return `linear-gradient(to right, ${gradientParts.join(', ')})`;
    }
    // Continuous colormaps: pick 5 equidistant stops for CSS representation
    const stops = [0, 0.25, 0.5, 0.75, 1];
    const colors = stops.map(s => {
        const idx = Math.min(Math.floor(s * palette.length), palette.length - 1);
        return palette[idx];
    });
    return `linear-gradient(to right, ${colors.join(', ')})`;
};

/**
 * Resolves the value of a metric from a feature's properties, considering 
 * global filter suffixes (e.g. modes, bounds), fallbacks, and optional alternative IDs.
 */
export const getMetricValue = (properties: any, metric: MetricDef, filter: { id?: string, suffix?: string }, viewLevel?: string, variations?: Record<string, string>): any => {
    if (!properties) return undefined;

    const filterId = filter?.id;
    const effectiveVariations: Record<string, string> = { ...variations };
    if (metric.id_variations) {
        Object.entries(metric.id_variations).forEach(([group, groupDef]) => {
            if (!effectiveVariations[group]) {
                effectiveVariations[group] = Array.isArray(groupDef)
                    ? groupDef[0]
                    : (groupDef.options_icons ? groupDef.options_icons[0].id : '');
            }
        });
    }

    if (metric.url) {
        const val = properties[metric.id];
        if (metric.filterValues && !metric.filterValues(properties, val, filterId, effectiveVariations)) {
            return undefined;
        }
        return val;
    }

    const resolveId = (id: string, useSuffixIfAvailable: boolean = true) => {
        let resolved = id;
        if (metric.id_variations) {
            Object.entries(metric.id_variations).forEach(([group, groupDef]) => {
                const value = variations?.[group] ?? (Array.isArray(groupDef) ? groupDef[0] : (groupDef.options_icons ? groupDef.options_icons[0].id : undefined));
                if (value === undefined) return;

                let shouldApply = true;
                if (groupDef && !Array.isArray(groupDef)) {
                    const allowedFilters = groupDef.globalFilters || groupDef.modes;
                    if (allowedFilters && filter.id && !allowedFilters.includes(filter.id as any)) shouldApply = false;
                    if (groupDef.viewLevels && viewLevel && !groupDef.viewLevels.includes(viewLevel as any)) shouldApply = false;
                }

                let token = group;
                if (!resolved.includes(`{${group}}`) && !resolved.includes(`_{${group}}`)) {
                    const match = resolved.match(/\{([a-zA-Z0-9_]+)\}/);
                    if (match && Object.keys(metric.id_variations || {}).length === 1) {
                        token = match[1];
                    }
                }
                
                if (shouldApply) {
                    if (useSuffixIfAvailable && groupDef && !Array.isArray(groupDef) && groupDef.options_icons) {
                        const iconOpt = groupDef.options_icons.find(o => o.id === value);
                        if (iconOpt && iconOpt.suffix !== undefined) {
                            if (resolved.includes(`_{${token}}`)) {
                                resolved = resolved.replace(`_{${token}}`, iconOpt.suffix);
                            } else {
                                resolved = resolved.replace(`{${token}}`, iconOpt.suffix);
                            }
                            return;
                        }
                    }
                    if (resolved.includes(`_{${token}}`)) {
                        resolved = resolved.replace(`_{${token}}`, `_${value}`);
                    } else {
                        resolved = resolved.replace(`{${token}}`, value);
                    }
                } else {
                    resolved = resolved.replace(`_{${token}}`, '').replace(`{${token}}`, '');
                }
            });
        }
        return resolved;
    };

    const candidate1 = resolveId(metric.id, true) + (filter.suffix || '');
    const candidate2 = resolveId(metric.id, false) + (filter.suffix || '');
    const idsToTry = Array.from(new Set([candidate1, candidate2])).filter(Boolean);

    for (const id of idsToTry) {
        if (properties[id] !== undefined) {
            const val = properties[id];
            if (metric.filterValues && !metric.filterValues(properties, val, filterId, effectiveVariations)) {
                return undefined;
            }
            return val;
        }
    }
    return undefined;
};

/**
 * Dynamically discovers valid variation combinations for a metric by scanning feature properties.
 */
export const discoverMetricVariations = (metric: MetricDef, features: any[]): Record<string, string>[] => {
    if (!metric.id_variations || !features || features.length === 0) return [];

    const groups = Object.keys(metric.id_variations);
    const validCombinations: Record<string, string>[] = [];
    const seenCombos = new Set<string>();
    const seenKeys = new Set<string>();

    const patterns = [metric.id].filter(Boolean) as string[];

    // Build regexes for each pattern
    const regexes = patterns.map(pattern => {
        let regexSource = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        groups.forEach(group => {
            const groupDef = metric.id_variations![group];
            const optionsGroup = getVariationOptions(groupDef);
            const isIconGroup = groupDef && !Array.isArray(groupDef) && groupDef.options_icons;

            let token = group;
            if (!regexSource.includes(`\\{${group}\\}`) && !regexSource.includes(`_\\{${group}\\}`)) {
                const matchToken = regexSource.match(/\\{([a-zA-Z0-9_]+)\\}/);
                if (matchToken && groups.length === 1) {
                    token = matchToken[1];
                }
            }

            if (isIconGroup) {
                const suffixes = groupDef.options_icons!
                    .map(o => o.suffix ?? `_${o.id}`)
                    .map(s => s.replace(/^_/, ''))
                    .filter(Boolean)
                    .concat(optionsGroup.map(o => o.replace(/^_/, '')))
                    .map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                const options = Array.from(new Set(suffixes)).sort((a, b) => b.length - a.length).join('|');
                if (regexSource.includes(`_\\{${token}\\}`)) {
                    regexSource = regexSource.replace(`_\\{${token}\\}`, `(?:_(?<${group}>${options}))?`);
                } else {
                    regexSource = regexSource.replace(`\\{${token}\\}`, `(?:_?(?<${group}>${options}))?`);
                }
            } else {
                const cleanOptions = optionsGroup
                    .map(o => o.replace(/^_/, ''))
                    .sort((a: string, b: string) => b.length - a.length)
                    .map((o: string) => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|');
                if (regexSource.includes(`_\\{${token}\\}`)) {
                    regexSource = regexSource.replace(`_\\{${token}\\}`, `(?:_(?<${group}>${cleanOptions}))`);
                } else {
                    regexSource = regexSource.replace(`\\{${token}\\}`, `(?:_?(?<${group}>${cleanOptions}))`);
                }
            }
        });
        return new RegExp(`^${regexSource}(?:_.*)?$`);
    });

    // Sample features to find valid keys (scanning all for robustness, but only unique keys)
    features.forEach(f => {
        if (!f.properties) return;
        Object.keys(f.properties).forEach(key => {
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            for (const regex of regexes) {
                const match = key.match(regex);
                if (match && match.groups) {
                    const combo: Record<string, string> = {};
                    let allMatched = true;
                    groups.forEach(g => {
                        const groupDef = metric.id_variations![g];
                        const isIconGroup = groupDef && !Array.isArray(groupDef) && groupDef.options_icons;
                        const optionsGroup = getVariationOptions(groupDef);
                        if (match.groups![g]) {
                            const matchedVal = match.groups![g];
                            if (isIconGroup) {
                                const found = groupDef.options_icons!.find(o => 
                                    o.id === matchedVal || 
                                    o.id.replace(/^_/, '') === matchedVal ||
                                    o.suffix === `_${matchedVal}` || 
                                    o.suffix === matchedVal ||
                                    (o.suffix && o.suffix.replace(/^_/, '') === matchedVal)
                                );
                                combo[g] = found ? found.id : matchedVal;
                            } else {
                                const found = optionsGroup.find(o => 
                                    o === matchedVal || 
                                    o === `_${matchedVal}` ||
                                    o.replace(/^_/, '') === matchedVal
                                );
                                combo[g] = found || matchedVal;
                            }
                        } else {
                            if (isIconGroup) {
                                const emptySuffixOpt = groupDef.options_icons!.find(o => !o.suffix || o.suffix === '');
                                if (emptySuffixOpt) combo[g] = emptySuffixOpt.id;
                                else allMatched = false;
                            } else {
                                const emptyOpt = optionsGroup.find(o => o === '' || o === 'all');
                                if (emptyOpt) combo[g] = emptyOpt;
                                else allMatched = false;
                            }
                        }
                    });

                    if (allMatched) {
                        const comboKey = Object.entries(combo).sort().map(e => e.join(':')).join('|');
                        if (!seenCombos.has(comboKey)) {
                            seenCombos.add(comboKey);
                            validCombinations.push(combo);
                        }
                    }
                }
            }
        });
    });

    // Sort valid combinations based on the metric's predefined options order so the default option comes first
    validCombinations.sort((a, b) => {
        for (const g of groups) {
            const groupDef = metric.id_variations![g];
            const opts = getVariationOptions(groupDef);
            const indexA = opts.indexOf(a[g]);
            const indexB = opts.indexOf(b[g]);
            if (indexA !== indexB) {
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            }
        }
        return 0;
    });

    console.log("Valid combinations for ", metric.id, validCombinations);

    return validCombinations;
};

/**
 * Resolves color for a raw data layer feature, supporting both categorical and numerical values.
 */
export const getRawFeatureColor = (
    val: any,
    metric: MetricDef,
    domain: number[],
    isColorBlindMode: boolean = false,
    properties?: any
): string => {
    if (val === undefined || val === null) {
        return 'rgba(0,0,0,0.05)';
    }

    // Categorical matching first so string values are not flagged as NaN by isMetricValueIgnored
    if (metric.legendCategories && metric.legendCategories.length > 0) {
        const strVal = String(val).trim().toLowerCase();
        const matched = metric.legendCategories.find(
            cat => (cat.value && cat.value.toLowerCase() === strVal) ||
                   (cat.label && cat.label.toLowerCase() === strVal)
        );
        if (matched) return matched.color;
    }

    if (isMetricValueIgnored(val, metric, properties)) {
        return 'rgba(0,0,0,0.05)';
    }

    // Numerical matching
    if (typeof val === 'number' || (!isNaN(Number(val)) && typeof val !== 'boolean')) {
        const numVal = typeof val === 'number' ? val : Number(val);
        return getColor(numVal, domain, metric, isColorBlindMode);
    }

    return metric.pallete?.[0] || '#3b82f6';
};

/**
 * Calculates a high-contrast foreground color (#111 or #fff) for a given hex or rgba color.
 */
export const getContrastColor = (color: string): string => {
    if (!color) return '#111';
    let r = 255, g = 255, b = 255;
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length >= 6) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) {
            r = parseInt(match[0], 10);
            g = parseInt(match[1], 10);
            b = parseInt(match[2], 10);
        }
    }
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 135) ? '#111' : '#fff';
};

/**
 * Parses a single CSV line into an array of raw token strings, respecting double quotes.
 */
const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    const len = line.length;

    for (let i = 0; i < len; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < len && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
                current += ch;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
};

/**
 * Parses a CSV string into an array of property objects with automatic number conversion.
 */
export const parseCsvToRecords = (csvText: string): Record<string, any>[] => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
    const numCols = headers.length;
    const records: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCsvLine(line);
        const row: Record<string, any> = {};

        for (let j = 0; j < numCols; j++) {
            const raw = values[j];
            if (raw === undefined || raw === '' || raw === 'NA' || raw === 'null' || raw === 'NaN') {
                continue;
            }
            if (raw.startsWith('"') && raw.endsWith('"')) {
                row[headers[j]] = raw.slice(1, -1);
            } else {
                const num = Number(raw);
                row[headers[j]] = !isNaN(num) ? num : raw;
            }
        }
        records.push(row);
    }

    return records;
};

/**
 * Merges GeoJSON geometries with metric attributes parsed from a CSV file.
 * Matches features to CSV rows by `id` (or fallback identifiers `mid`, `pid`, `gid`, `h3_address`, or row index).
 */
export const mergeGeoJsonWithCsv = (geoJson: any, csvText: string): any => {
    if (!geoJson?.features || !csvText) return geoJson;

    const rows = parseCsvToRecords(csvText);
    if (rows.length === 0) return geoJson;

    const byId = new Map<string, Record<string, any>>();
    const byAltKey = new Map<string, Record<string, any>>();

    for (const row of rows) {
        if (row.id !== undefined && row.id !== null) {
            byId.set(String(row.id), row);
        }
        const alt = row.h3_address ?? row.gid ?? row.pid ?? row.mid;
        if (alt !== undefined && alt !== null) {
            byAltKey.set(String(alt), row);
        }
    }

    const sameLength = geoJson.features.length === rows.length;

    const features = geoJson.features.map((f: any, idx: number) => {
        const props = f.properties || {};
        let matchedRow: Record<string, any> | undefined;

        if (props.id !== undefined && props.id !== null) {
            matchedRow = byId.get(String(props.id)) || byAltKey.get(String(props.id));
        }
        if (!matchedRow) {
            const alt = props.h3_address ?? props.gid ?? props.pid ?? props.mid;
            if (alt !== undefined && alt !== null) {
                matchedRow = byAltKey.get(String(alt)) || byId.get(String(alt));
            }
        }
        if (!matchedRow && sameLength) {
            matchedRow = rows[idx];
        }

        return {
            ...f,
            properties: matchedRow ? { ...props, ...matchedRow } : props
        };
    });

    return {
        ...geoJson,
        features
    };
};

