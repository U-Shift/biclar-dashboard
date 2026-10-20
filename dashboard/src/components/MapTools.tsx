import React from 'react';
import { useMap } from 'react-leaflet';
import { Plus, Minus, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MapFilterDropdown } from './MapFilterDropdown';
import { MAP_LAYERS } from '../constants';

interface MapToolsProps {
    isDarkMode: boolean;
    mapStyle: string;
    setMapStyle: (style: string) => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    isMobile?: boolean;
    onChange?: () => void;
}

export const MapToolsUI: React.FC<MapToolsProps> = ({
    isDarkMode, mapStyle, setMapStyle,
    onZoomIn, onZoomOut, isMobile, onChange
}) => {
    const { t } = useTranslation();

    const layerOptions = MAP_LAYERS.map(l => ({
        id: l.id,
        label: t(l.label),
        icon: l.icon
    }));

    if (isMobile) {
        return (
            <div className="flex flex-col gap-4">
                <div className="w-full">
                    <MapFilterDropdown
                        isMobile={true}
                        label={t('map.layers')}
                        value={mapStyle}
                        isDark={isDarkMode}
                        icon={<Layers className="w-3.5 h-3.5" />}
                        options={layerOptions}
                        onChange={(id) => {
                            setMapStyle(id);
                            onChange?.();
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div data-tour="map-tools" className="absolute bottom-8 left-8 z-[1100] flex flex-row items-center gap-2">
            <div className="flex flex-row gap-2">
                <button
                    onClick={onZoomIn}
                    title={t('map.zoom_in')}
                    className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                        backdrop-blur-md shadow-xl hover:scale-110 active:scale-90 pointer-events-auto
                        ${isDarkMode ? 'bg-neutral-900/90 border border-neutral-800 text-white' : 'bg-white/90 border border-neutral-200 text-neutral-800'}
                    `}
                >
                    <Plus className="w-5 h-5" />
                </button>
                <button
                    onClick={onZoomOut}
                    title={t('map.zoom_out')}
                    className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                        backdrop-blur-md shadow-xl hover:scale-110 active:scale-90 pointer-events-auto
                        ${isDarkMode ? 'bg-neutral-900/90 border border-neutral-800 text-white' : 'bg-white/90 border border-neutral-200 text-neutral-800'}
                    `}
                >
                    <Minus className="w-5 h-5" />
                </button>
            </div>

            <MapFilterDropdown
                label={t('map.layers')}
                direction="up"
                value={mapStyle}
                isDark={isDarkMode}
                icon={<Layers className="w-3.5 h-3.5" />}
                options={layerOptions}
                onChange={(id) => {
                    setMapStyle(id);
                    onChange?.();
                }}
            />
        </div>
    );
};

export const MapTools: React.FC<MapToolsProps> = (props) => {
    if (props.onZoomIn && props.onZoomOut) {
        return <MapToolsUI {...props} />;
    }
    return <MapToolsWithInternalMap {...props} />;
};

const MapToolsWithInternalMap: React.FC<MapToolsProps> = (props) => {
    const map = useMap();
    const onZoomIn = () => map.setZoom(map.getZoom() + 1);
    const onZoomOut = () => map.setZoom(map.getZoom() - 1);
    return <MapToolsUI {...props} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />;
};
