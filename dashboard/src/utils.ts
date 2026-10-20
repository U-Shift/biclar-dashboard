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
export const getVariationOptionLabel = (groupDef: VariationGroup | undefined, optId: string, t: (k: string) => string): string => {
    if (!groupDef) return t(`variations.${optId}`);
    if (!Array.isArray(groupDef) && groupDef.options_icons) {
        const found = groupDef.options_icons.find(o => o.id === optId);
        if (found) return t(found.label);
    }
    return t(`variations.${optId}`);
};


/**
 * Checks if a value should be ignored based on metric settings and common data issues (null, undefined, NaN).
 */

export const isMetricValueIgnored = (val: any, metric: MetricDef): boolean => {
    return val === null || val === undefined || isNaN(Number(val)) || (metric.ignoreValues?.includes(val) ?? false);
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
        let sliceIdx = 0;
        for (let i = 0; i < domain.length - 1; i++) {
            if (val >= domain[i] && val <= domain[i + 1]) {
                sliceIdx = i;
                break;
            }
        }
        const nSlices = domain.length - 1;
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
    if (metric.url) {
        return properties[metric.id];
    }

    const resolveId = (id: string, useSuffixIfAvailable: boolean = true) => {
        let resolved = id;
        if (variations) {
            Object.entries(variations).forEach(([group, value]) => {
                const groupDef = metric.id_variations?.[group];
                let shouldApply = true;
                if (groupDef && !Array.isArray(groupDef)) {
                    const allowedFilters = groupDef.globalFilters || groupDef.modes;
                    if (allowedFilters && filter.id && !allowedFilters.includes(filter.id as any)) shouldApply = false;
                    if (groupDef.viewLevels && viewLevel && !groupDef.viewLevels.includes(viewLevel as any)) shouldApply = false;
                }
                
                if (shouldApply) {
                    if (useSuffixIfAvailable && groupDef && !Array.isArray(groupDef) && groupDef.options_icons) {
                        const iconOpt = groupDef.options_icons.find(o => o.id === value);
                        if (iconOpt && iconOpt.suffix !== undefined) {
                            if (resolved.includes(`_{${group}}`)) {
                                resolved = resolved.replace(`_{${group}}`, iconOpt.suffix);
                            } else {
                                resolved = resolved.replace(`{${group}}`, iconOpt.suffix);
                            }
                            return;
                        }
                    }
                    resolved = resolved.replace(`{${group}}`, value);
                } else {
                    resolved = resolved.replace(`_{${group}}`, '').replace(`{${group}}`, '');
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
            return properties[id];
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
            if (isIconGroup) {
                const suffixes = groupDef.options_icons!
                    .map(o => o.suffix ?? `_${o.id}`)
                    .map(s => s.replace(/^_/, ''))
                    .filter(Boolean)
                    .concat(optionsGroup)
                    .map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                const options = Array.from(new Set(suffixes)).sort((a, b) => b.length - a.length).join('|');
                if (regexSource.includes(`_\\{${group}\\}`)) {
                    regexSource = regexSource.replace(`_\\{${group}\\}`, `(?:_(?<${group}>${options}))?`);
                } else {
                    regexSource = regexSource.replace(`\\{${group}\\}`, `(?<${group}>${options})?`);
                }
            } else {
                const options = optionsGroup
                    .slice()
                    .sort((a: string, b: string) => b.length - a.length)
                    .map((o: string) => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|');
                regexSource = regexSource.replace(`\\{${group}\\}`, `(?<${group}>${options})`);
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
                        if (match.groups![g]) {
                            const matchedVal = match.groups![g];
                            if (isIconGroup) {
                                const found = groupDef.options_icons!.find(o => o.id === matchedVal || o.suffix === `_${matchedVal}` || o.suffix === matchedVal);
                                combo[g] = found ? found.id : matchedVal;
                            } else {
                                combo[g] = matchedVal;
                            }
                        } else {
                            if (isIconGroup) {
                                const emptySuffixOpt = groupDef.options_icons!.find(o => !o.suffix || o.suffix === '');
                                if (emptySuffixOpt) combo[g] = emptySuffixOpt.id;
                                else allMatched = false;
                            } else {
                                allMatched = false;
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
    isColorBlindMode: boolean = false
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

    if (isMetricValueIgnored(val, metric)) {
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

