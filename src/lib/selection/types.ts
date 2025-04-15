import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';

/**
 * Bounding box array [minX, minY, maxX, maxY]
 */
export type Bbox = [number, number, number, number];

/**
 * Represents a selected geographic object on the map
 */
export interface SelectedFeature {
    id: string;
    feature: GeoJSON.Feature;
    sourceId: string;
    layerId: string;
    selected: boolean;
    isCurrentSelection: boolean;
}

/**
 * Bounding box of a selected feature or collection
 */
export interface SelectionBounds {
    bbox: Bbox;
    center: [number, number];
    // Area in square meters
    area: number;
    // Perimeter in meters
    perimeter: number;
}

/**
 * Event types for selection changes
 */
export type SelectionEventType =
    | 'select'
    | 'deselect'
    | 'clear'
    | 'change';

/**
 * Event payload for selection events
 */
export interface SelectionEvent {
    type: SelectionEventType;
    selected: SelectedFeature[];
    bounds: SelectionBounds | null;
    map: maplibregl.Map;
}

/**
 * Selection event listener function
 */
export type SelectionEventListener = (event: SelectionEvent) => void;

/**
 * Options for creating a selection manager
 */
export interface SelectionManagerOptions {
    map: maplibregl.Map;
    selectionColor?: string;
    currentSelectionColor?: string;
    previousSelectionColor?: string;
    selectionFillOpacity?: number;
    selectionLineWidth?: number;
    selectionLayerId?: string;
    selectionSourceId?: string;
}
