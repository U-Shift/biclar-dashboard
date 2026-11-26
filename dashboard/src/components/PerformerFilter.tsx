import React from 'react';
import { useTranslation } from 'react-i18next';

export type PerformerFilterMode = 'all' | 'lowest' | 'highest';

interface PerformerFilterProps {
    mode: PerformerFilterMode;
    onModeChange: (mode: PerformerFilterMode) => void;
    topN: number;
    onTopNChange: (n: number) => void;
    maxCount: number;
    isDark: boolean;
}

export const PerformerFilter: React.FC<PerformerFilterProps> = ({
    mode,
    onModeChange,
    topN,
    onTopNChange,
    maxCount,
    isDark,
}) => {
    const { t } = useTranslation();
    const safeMax = Math.max(1, maxCount);

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value, 10);
        if (isNaN(parsed)) {
            onTopNChange(1);
            return;
        }
        onTopNChange(Math.max(1, Math.min(safeMax, parsed)));
    };

    return (
        <div
            className={`rounded-[24px] p-4 border shadow-inner transition-colors ${
                isDark
                    ? 'bg-neutral-800/20 border-neutral-800'
                    : 'bg-neutral-50 border-neutral-200/80'
            }`}
        >
            <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`text-[12px] font-bold tracking-tight ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    {t('sidebar.filter_performers')}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-semibold ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {t('sidebar.filter_top')}
                    </span>
                    <input
                        type="number"
                        min={1}
                        max={safeMax}
                        value={topN}
                        onChange={handleNumberChange}
                        aria-label={t('sidebar.filter_top')}
                        className={`w-16 px-2 py-1 text-xs font-bold text-center tabular-nums rounded-lg border outline-none transition-colors ${
                            isDark
                                ? 'bg-neutral-900 border-neutral-700 text-neutral-100 focus:border-secondary-yellow/60'
                                : 'bg-white border-neutral-200 text-neutral-800 focus:border-primary/50'
                        }`}
                    />
                </div>
            </div>

            <div
                className={`grid grid-cols-3 p-1 rounded-xl border ${
                    isDark
                        ? 'bg-neutral-900/70 border-neutral-800'
                        : 'bg-neutral-100/80 border-neutral-200/70'
                }`}
            >
                {([
                    { id: 'all' as const, label: t('sidebar.filter_all') },
                    { id: 'lowest' as const, label: t('sidebar.filter_lowest', { n: topN }) },
                    { id: 'highest' as const, label: t('sidebar.filter_highest', { n: topN }) },
                ]).map((opt) => {
                    const isActive = mode === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onModeChange(opt.id)}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all truncate ${
                                isActive
                                    ? (isDark
                                        ? 'bg-primary text-secondary-yellow shadow-sm ring-1 ring-secondary-yellow/30'
                                        : 'bg-white text-primary shadow-sm ring-1 ring-black/5')
                                    : (isDark
                                        ? 'text-neutral-400 hover:text-neutral-200'
                                        : 'text-neutral-500 hover:text-neutral-800')
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
