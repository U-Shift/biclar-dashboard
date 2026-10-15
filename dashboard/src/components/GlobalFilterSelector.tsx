import React from 'react';
import { Tooltip } from './Tooltip';

export interface GlobalFilterOption {
    id: string;
    label: string;
    icon: string | React.ReactNode;
}

export interface GlobalFilterSelectorProps {
    value: string;
    options: GlobalFilterOption[];
    onChange: (id: string) => void;
    isDark: boolean;
}

const renderIcon = (icon: string | React.ReactNode, isActive: boolean) => {
    if (typeof icon === 'string' && (icon.includes('/') || icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.svg') || icon.endsWith('.webp'))) {
        return (
            <img
                src={icon}
                alt=""
                className={`w-5 h-5 object-contain pointer-events-none select-none transition-all duration-300 ${
                    isActive
                        ? 'brightness-0 invert opacity-75'
                        : ''
                }`}
            />
        );
    }
    return icon;
};

export const GlobalFilterSelector: React.FC<GlobalFilterSelectorProps> = ({ value, options, onChange, isDark }) => {
    if (!options || options.length < 2) return null;

    return (
        <div className={`flex flex-col gap-2 p-1.5 rounded-[24px] border backdrop-blur-md shadow-2xl pointer-events-auto transition-all duration-300
            ${isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white/90 border-neutral-200'}
        `}>
            {options.map((option) => {
                const isActive = value === option.id;
                return (
                    <Tooltip key={option.id} content={option.label} isDarkMode={isDark}>
                        <button
                            onClick={() => onChange(option.id)}
                            className={`
                                w-11 h-11 rounded-[18px] flex items-center justify-center transition-all duration-300 relative group
                                ${isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30 ring-1 ring-secondary-yellow/30 scale-105'
                                    : `${isDark ? 'text-neutral-500 hover:bg-white/5 hover:text-neutral-200' : 'text-neutral-400 hover:bg-neutral-50 hover:text-neutral-800'}`
                                }
                            `}
                        >
                            <span className="text-xl leading-none transition-transform duration-300 group-hover:scale-110 group-active:scale-90 flex items-center justify-center">
                                {renderIcon(option.icon, isActive)}
                            </span>
                        </button>
                    </Tooltip>
                );
            })}
        </div>
    );
};

// Backward-compatible alias
export const ModeSelector = GlobalFilterSelector;
export type ModeSelectorProps = GlobalFilterSelectorProps;
