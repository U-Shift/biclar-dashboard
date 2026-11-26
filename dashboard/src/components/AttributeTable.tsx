import React, { useState, useMemo, useEffect } from 'react';
import { Table2, X, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MetricDef, ViewLevel, GlobalFilterId } from '../types';
import { METRICS, LEVEL_CONFIG, RegionKey, REGIONS } from '../constants';
import {
    discoverMetricVariations,
    getMetricCandidateIds,
    getVariationOptions,
    getVariationOptionLabel
} from '../utils';

interface AttributeTableProps {
    isOpen: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    isMobile: boolean;
    viewLevel: ViewLevel;
    nutFilter: RegionKey;
    selectedMetric: MetricDef;
    selectedGlobalFilter: { id: GlobalFilterId; suffix?: string; label?: string };
    selectedVariations: Record<string, string>;
    computedGeoData: any;
    filteredRawData: any;
    parentLookup: Record<string, string>;
    selectedFeature: any;
    onSelectFeature: (props: any) => void;
}

interface TableColumn {
    key: string;
    label: string;
    sublabel?: string;
    unit?: string;
    isNumeric: boolean;
    isIdentity?: boolean;
    isActive?: boolean;
    getRawValue: (props: any) => any;
    formatValue: (raw: any, props: any) => string;
}

type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const getPaginationItems = (currentPage: number, totalPages: number): (number | '...')[] => {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | '...')[] = [1];
    if (currentPage <= 4) {
        items.push(2, 3, 4, 5, '...', totalPages);
    } else if (currentPage >= totalPages - 3) {
        items.push('...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
        items.push('...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return items;
};

export const AttributeTable: React.FC<AttributeTableProps> = ({
    isOpen,
    onClose,
    isDarkMode,
    isMobile,
    viewLevel,
    nutFilter,
    selectedMetric,
    selectedGlobalFilter,
    selectedVariations,
    computedGeoData,
    filteredRawData,
    parentLookup,
    selectedFeature,
    onSelectFeature,
}) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; dir: SortDir } | null>(null);

    const activeCategory = selectedMetric.category;
    const isRawLayer = Boolean(selectedMetric.url);

    // Features for the current scale (or raw layer)
    const features: any[] = useMemo(() => {
        if (!isOpen) return [];
        if (isRawLayer) {
            return filteredRawData?.features || [];
        }
        return computedGeoData?.features || [];
    }, [isOpen, isRawLayer, filteredRawData, computedGeoData]);

    // Resolve property keys set for fast column existence checks
    const propertyKeys: Set<string> = useMemo(() => {
        if (!isOpen) return new Set<string>();
        if (!isRawLayer && computedGeoData?._propertyKeys instanceof Set) {
            return computedGeoData._propertyKeys as Set<string>;
        }
        const keys = new Set<string>();
        const sampleLimit = Math.min(features.length, 200);
        for (let i = 0; i < sampleLimit; i++) {
            const p = features[i]?.properties;
            if (p) {
                Object.keys(p).forEach(k => keys.add(k));
            }
        }
        return keys;
    }, [isOpen, isRawLayer, computedGeoData, features]);

    // Active map column property key (to highlight the currently mapped column)
    const activeMapPropKey = useMemo(() => {
        if (!isOpen) return '';
        if (isRawLayer) return selectedMetric.id;
        const candidates = getMetricCandidateIds(selectedMetric, selectedGlobalFilter, viewLevel, selectedVariations);
        return candidates.find(c => propertyKeys.has(c)) || candidates[0] || '';
    }, [isOpen, isRawLayer, selectedMetric, selectedGlobalFilter, viewLevel, selectedVariations, propertyKeys]);

    // Build table columns for the selected scale & metric group
    const columns: TableColumn[] = useMemo(() => {
        if (!isOpen) return [];

        if (isRawLayer) {
            const cols: TableColumn[] = [];
            cols.push({
                key: '__name',
                label: t('attribute_table.name'),
                isNumeric: false,
                isIdentity: true,
                getRawValue: (p) => selectedMetric.get_name ? selectedMetric.get_name(p) : (p?.name || p?.id || p?.osm_id || '-'),
                formatValue: (v) => (v === null || v === undefined || v === '') ? '-' : String(v),
            });

            // Include get_details fields if defined on the raw metric
            const sampleProps = features[0]?.properties;
            if (selectedMetric.get_details && sampleProps) {
                const detailPairs = selectedMetric.get_details(sampleProps);
                detailPairs.forEach(([detailLabel], idx) => {
                    cols.push({
                        key: `__detail_${idx}`,
                        label: detailLabel,
                        isNumeric: false,
                        getRawValue: (p) => selectedMetric.get_details?.(p)?.[idx]?.[1],
                        formatValue: (v) => (v === null || v === undefined || v === '') ? '-' : String(v),
                    });
                });
            }

            const unitStr = selectedMetric.unit?.(selectedGlobalFilter.id, undefined, selectedVariations);
            cols.push({
                key: selectedMetric.id,
                label: t(selectedMetric.label),
                unit: unitStr,
                isNumeric: !selectedMetric.legendCategories,
                isActive: true,
                getRawValue: (p) => p?.[selectedMetric.id],
                formatValue: (v) => {
                    if (v === null || v === undefined || v === '') return '-';
                    if (typeof v === 'number' && isNaN(v)) return '-';
                    return selectedMetric.format
                        ? selectedMetric.format(v, 0, 1, selectedGlobalFilter.id, selectedVariations)
                        : String(v);
                },
            });

            return cols;
        }

        const cols: TableColumn[] = [];
        const hasDistinctName = features.some(f => f?.properties?.name && String(f.properties.name) !== String(f.properties.id));
        const parentLevel = LEVEL_CONFIG[viewLevel]?.parent;

        cols.push({
            key: '__id',
            label: viewLevel === 'hex' ? t('attribute_table.cell_id') : t('attribute_table.id'),
            isNumeric: false,
            isIdentity: true,
            getRawValue: (p) => p?.id ?? p?.h3_address ?? '',
            formatValue: (v) => (v === null || v === undefined || v === '') ? '-' : String(v),
        });

        if (hasDistinctName) {
            cols.push({
                key: '__name',
                label: t('attribute_table.name'),
                isNumeric: false,
                isIdentity: true,
                getRawValue: (p) => p?.name ?? '',
                formatValue: (v) => (v === null || v === undefined || v === '') ? '-' : String(v),
            });
        }

        if (parentLevel && propertyKeys.has('group_id')) {
            const parentLabel = parentLevel === 'hex' ? t('map.grid') : t(`map.${parentLevel}`);
            cols.push({
                key: '__parent',
                label: parentLabel,
                isNumeric: false,
                isIdentity: true,
                getRawValue: (p) => (p?.group_id !== undefined && p?.group_id !== null)
                    ? (parentLookup[`${parentLevel}-${p.group_id}`] || String(p.group_id))
                    : '',
                formatValue: (v) => (v === null || v === undefined || v === '') ? '-' : String(v),
            });
        }

        const groupMetrics = METRICS[activeCategory] || [selectedMetric];
        const addedPropKeys = new Set<string>();

        groupMetrics.forEach((metric) => {
            if (metric.url) return;

            if (!metric.id_variations) {
                const candidates = getMetricCandidateIds(metric, selectedGlobalFilter, viewLevel, selectedVariations);
                const resolvedKey = candidates.find(k => propertyKeys.has(k));
                if (!resolvedKey || addedPropKeys.has(resolvedKey)) return;
                addedPropKeys.add(resolvedKey);

                const unitStr = metric.unit?.(selectedGlobalFilter.id, undefined, selectedVariations);
                cols.push({
                    key: resolvedKey,
                    label: t(metric.label),
                    unit: unitStr,
                    isNumeric: true,
                    isActive: resolvedKey === activeMapPropKey,
                    getRawValue: (p) => p?.[resolvedKey],
                    formatValue: (v) => {
                        if (v === null || v === undefined || isNaN(Number(v))) return '-';
                        return metric.format(Number(v), 0, 1, selectedGlobalFilter.id, selectedVariations);
                    },
                });
                return;
            }

            // Metric with id_variations: discover combinations present in the dataset
            let combos = metric.valid_id_variations && metric.valid_id_variations.length > 0
                ? metric.valid_id_variations
                : discoverMetricVariations(metric, features, propertyKeys);

            // Pin any formSlider variation (e.g. 24-hour GBFS slider) to the currently selected value
            // so the table stays readable instead of expanding 24x columns
            const sliderGroups = Object.entries(metric.id_variations)
                .filter(([, def]) => !Array.isArray(def) && def.formSlider)
                .map(([g]) => g);

            if (sliderGroups.length > 0) {
                combos = combos.filter(combo =>
                    sliderGroups.every(g => {
                        const opts = getVariationOptions(metric.id_variations![g]);
                        const activeVal = selectedVariations[g] || opts[0];
                        return combo[g] === activeVal;
                    })
                );
            }

            combos.forEach((combo) => {
                const candidates = getMetricCandidateIds(metric, selectedGlobalFilter, viewLevel, combo);
                const resolvedKey = candidates.find(k => propertyKeys.has(k));
                if (!resolvedKey || addedPropKeys.has(resolvedKey)) return;
                addedPropKeys.add(resolvedKey);

                // Build readable sublabel from non-slider variation options
                const variationLabels: string[] = [];
                Object.entries(metric.id_variations!).forEach(([group, groupDef]) => {
                    if (!Array.isArray(groupDef) && groupDef.visible === false) return;
                    const optId = combo[group];
                    if (optId !== undefined) {
                        variationLabels.push(getVariationOptionLabel(groupDef, optId, t));
                    }
                });

                const unitStr = metric.unit?.(selectedGlobalFilter.id, undefined, combo);

                cols.push({
                    key: resolvedKey,
                    label: t(metric.label),
                    sublabel: variationLabels.length > 0 ? variationLabels.join(' · ') : undefined,
                    unit: unitStr,
                    isNumeric: true,
                    isActive: resolvedKey === activeMapPropKey,
                    getRawValue: (p) => p?.[resolvedKey],
                    formatValue: (v) => {
                        if (v === null || v === undefined || isNaN(Number(v))) return '-';
                        return metric.format(Number(v), 0, 1, selectedGlobalFilter.id, combo);
                    },
                });
            });
        });

        return cols;
    }, [
        isOpen,
        isRawLayer,
        features,
        viewLevel,
        propertyKeys,
        parentLookup,
        activeCategory,
        selectedMetric,
        selectedGlobalFilter,
        selectedVariations,
        activeMapPropKey,
        t
    ]);

    // Reset page when filters/context change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, pageSize, viewLevel, nutFilter, activeCategory, isRawLayer, selectedMetric.id]);

    // Clear sort if the sorted column no longer exists
    useEffect(() => {
        if (sortConfig && !columns.some(c => c.key === sortConfig.key)) {
            setSortConfig(null);
        }
    }, [columns, sortConfig]);

    // Filter rows by search query
    const filteredFeatures = useMemo(() => {
        if (!isOpen) return [];
        const q = searchQuery.trim().toLowerCase();
        if (!q) return features;

        return features.filter((f) => {
            const props = f?.properties || {};
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const raw = col.getRawValue(props);
                if (raw !== undefined && raw !== null) {
                    if (String(raw).toLowerCase().includes(q)) return true;
                    const formatted = col.formatValue(raw, props);
                    if (formatted !== '-' && formatted.toLowerCase().includes(q)) return true;
                }
            }
            return false;
        });
    }, [isOpen, features, searchQuery, columns]);

    // Sort filtered rows
    const sortedFeatures = useMemo(() => {
        if (!isOpen) return [];
        if (!sortConfig) return filteredFeatures;
        const col = columns.find(c => c.key === sortConfig.key);
        if (!col) return filteredFeatures;

        const dirMult = sortConfig.dir === 'asc' ? 1 : -1;
        return [...filteredFeatures].sort((a, b) => {
            const valA = col.getRawValue(a?.properties);
            const valB = col.getRawValue(b?.properties);

            const missingA = valA === null || valA === undefined || valA === '' || (col.isNumeric && isNaN(Number(valA)));
            const missingB = valB === null || valB === undefined || valB === '' || (col.isNumeric && isNaN(Number(valB)));

            if (missingA && missingB) return 0;
            if (missingA) return 1;
            if (missingB) return -1;

            if (col.isNumeric) {
                return (Number(valA) - Number(valB)) * dirMult;
            }
            return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dirMult;
        });
    }, [isOpen, filteredFeatures, sortConfig, columns]);

    const totalFiltered = sortedFeatures.length;
    const totalAll = features.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);

    const paginatedFeatures = useMemo(() => {
        if (!isOpen) return [];
        return sortedFeatures.slice(startIndex, endIndex);
    }, [isOpen, sortedFeatures, startIndex, endIndex]);

    const handleSort = (colKey: string) => {
        setSortConfig((prev) => {
            if (!prev || prev.key !== colKey) return { key: colKey, dir: 'desc' };
            if (prev.dir === 'desc') return { key: colKey, dir: 'asc' };
            return null;
        });
        setCurrentPage(1);
    };

    if (!isOpen) return null;

    const scaleLabel = isRawLayer
        ? t(selectedMetric.label)
        : (viewLevel === 'hex' ? t('map.grid') : t(`map.${viewLevel}`));
    const regionLabel = t(REGIONS[nutFilter].name);
    const paginationItems = getPaginationItems(safePage, totalPages);

    return (
        <div
            className={`
                ${isMobile
                    ? 'fixed inset-3 z-[1006] max-h-[calc(100dvh-24px)]'
                    : 'absolute top-4 left-[412px] right-4 z-[1004] max-h-[calc(100vh-120px)]'}
                flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-200
                ${isDarkMode
                    ? 'bg-neutral-900/95 border-neutral-800 text-neutral-100'
                    : 'bg-white/95 border-neutral-200 text-neutral-900'}
            `}
        >
            {/* Header */}
            <div className={`px-5 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200/80'}`}>
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <Table2 className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-secondary-yellow' : 'text-primary'}`} />
                    <h2 className="text-sm font-black tracking-tight shrink-0">
                        {t('attribute_table.title')}
                    </h2>
                    <span className={`text-xs font-medium truncate ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {t(activeCategory)} · {scaleLabel} · {regionLabel} ({t('attribute_table.rows_count', { shown: totalFiltered.toLocaleString(), total: totalAll.toLocaleString() })})
                    </span>
                </div>
                <button
                    onClick={onClose}
                    aria-label={t('common.close')}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100' : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'}`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Search & Page Size Controls */}
            <div className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 ${isDarkMode ? 'bg-neutral-900/60' : 'bg-neutral-50/50'}`}>
                <div className="relative w-full sm:w-64">
                    <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('attribute_table.search_placeholder')}
                        className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                            isDarkMode
                                ? 'bg-neutral-950/70 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-secondary-yellow/60'
                                : 'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-primary/50'
                        }`}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-700'}`}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    <span>{t('attribute_table.show')}</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className={`px-2 py-1 text-xs rounded-lg border outline-none cursor-pointer ${
                            isDarkMode
                                ? 'bg-neutral-950 border-neutral-700 text-neutral-100'
                                : 'bg-white border-neutral-200 text-neutral-800'
                        }`}
                    >
                        {PAGE_SIZE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                    <span>{t('attribute_table.entries')}</span>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full border-collapse text-left text-xs">
                    <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-neutral-900 border-b border-neutral-800' : 'bg-white border-b border-neutral-200'}`}>
                        <tr>
                            {columns.map((col, idx) => {
                                const isSorted = sortConfig?.key === col.key;
                                const isStickyFirst = !isMobile && idx === 0;
                                return (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key)}
                                        className={`
                                            px-3.5 py-2.5 font-bold align-bottom select-none cursor-pointer transition-colors whitespace-nowrap
                                            ${isStickyFirst ? (isDarkMode ? 'sticky left-0 z-20 bg-neutral-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)]' : 'sticky left-0 z-20 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]') : ''}
                                            ${col.isActive
                                                ? (isDarkMode ? 'bg-primary/40 text-secondary-yellow' : 'bg-primary/5 text-primary')
                                                : (isDarkMode ? 'hover:bg-neutral-800/70 text-neutral-300' : 'hover:bg-neutral-50 text-neutral-700')}
                                        `}
                                    >
                                        <div className={`flex items-center gap-1.5 ${col.isNumeric ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`flex flex-col ${col.isNumeric ? 'items-end text-right' : 'items-start text-left'}`}>
                                                <span className="leading-tight flex items-center gap-1">
                                                    {col.isActive && (
                                                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isDarkMode ? 'bg-secondary-yellow' : 'bg-primary'}`} />
                                                    )}
                                                    {col.label}
                                                </span>
                                                {(col.sublabel || col.unit) && (
                                                    <span className={`text-[10px] font-medium leading-tight mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                                        {col.sublabel || ''}{col.sublabel && col.unit ? ' ' : ''}{col.unit ? `(${col.unit})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`shrink-0 ${isSorted ? (isDarkMode ? 'text-secondary-yellow' : 'text-primary') : 'opacity-30'}`}>
                                                {isSorted
                                                    ? (sortConfig!.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                                                    : <ArrowUpDown className="w-3 h-3" />}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-neutral-100'}`}>
                        {paginatedFeatures.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={Math.max(1, columns.length)}
                                    className={`px-5 py-10 text-center text-xs font-medium ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
                                >
                                    {t('attribute_table.no_entries')}
                                </td>
                            </tr>
                        ) : (
                            paginatedFeatures.map((feature, rowIdx) => {
                                const props = feature?.properties || {};
                                const rowKey = props.id ?? props.h3_address ?? props.osm_id ?? `${startIndex + rowIdx}`;
                                const isSelectedRow = !isRawLayer && selectedFeature && props.id !== undefined && String(props.id) === String(selectedFeature.id);

                                return (
                                    <tr
                                        key={rowKey}
                                        onClick={() => {
                                            if (!isRawLayer) {
                                                onSelectFeature(props);
                                            }
                                        }}
                                        className={`
                                            transition-colors
                                            ${!isRawLayer ? 'cursor-pointer' : ''}
                                            ${isSelectedRow
                                                ? (isDarkMode ? 'bg-primary/40' : 'bg-primary/10')
                                                : (isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-neutral-50')}
                                        `}
                                    >
                                        {columns.map((col, colIdx) => {
                                            const raw = col.getRawValue(props);
                                            const formatted = col.formatValue(raw, props);
                                            const isStickyFirst = !isMobile && colIdx === 0;
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`
                                                        px-3.5 py-2 whitespace-nowrap
                                                        ${colIdx === 0 ? 'font-bold' : 'font-normal'}
                                                        ${col.isNumeric ? 'text-right tabular-nums' : 'text-left'}
                                                        ${isStickyFirst
                                                            ? (isSelectedRow
                                                                ? (isDarkMode ? 'sticky left-0 z-[1] bg-neutral-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)]' : 'sticky left-0 z-[1] bg-neutral-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]')
                                                                : (isDarkMode ? 'sticky left-0 z-[1] bg-neutral-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)]' : 'sticky left-0 z-[1] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]'))
                                                            : ''}
                                                        ${col.isActive
                                                            ? (isDarkMode ? 'bg-primary/20 font-semibold text-neutral-100' : 'bg-primary/[0.03] font-semibold text-neutral-900')
                                                            : ''}
                                                        ${formatted === '-' ? 'opacity-35' : ''}
                                                    `}
                                                >
                                                    {formatted}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer / Pagination */}
            <div className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs ${isDarkMode ? 'border-neutral-800 text-neutral-400' : 'border-neutral-200/80 text-neutral-500'}`}>
                <div>
                    {totalFiltered > 0
                        ? t('attribute_table.showing_entries', {
                            from: (startIndex + 1).toLocaleString(),
                            to: endIndex.toLocaleString(),
                            total: totalFiltered.toLocaleString(),
                        })
                        : t('attribute_table.showing_zero')}
                    {searchQuery.trim() && totalFiltered !== totalAll && (
                        <span className="ml-1 opacity-75">
                            ({t('attribute_table.filtered_from', { total: totalAll.toLocaleString() })})
                        </span>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                isDarkMode
                                    ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                                    : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                            }`}
                        >
                            {t('common.previous')}
                        </button>

                        {paginationItems.map((item, idx) =>
                            item === '...' ? (
                                <span key={`ellipsis-${idx}`} className="px-1.5 opacity-50 select-none">...</span>
                            ) : (
                                <button
                                    key={item}
                                    onClick={() => setCurrentPage(item)}
                                    className={`min-w-[28px] px-2 py-1 rounded-lg border text-xs font-bold transition-colors ${
                                        item === safePage
                                            ? (isDarkMode
                                                ? 'bg-primary border-secondary-yellow/40 text-secondary-yellow'
                                                : 'bg-primary border-primary text-white')
                                            : (isDarkMode
                                                ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-400'
                                                : 'border-neutral-200 hover:bg-neutral-100 text-neutral-600')
                                    }`}
                                >
                                    {item}
                                </button>
                            )
                        )}

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                isDarkMode
                                    ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                                    : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                            }`}
                        >
                            {t('common.next')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
