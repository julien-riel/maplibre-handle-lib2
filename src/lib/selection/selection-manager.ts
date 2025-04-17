import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import {
    Bbox,
    SelectedFeature,
    SelectionBounds,
    SelectionEvent,
    SelectionEventListener,
    SelectionEventType,
    SelectionManagerOptions
} from './types';

/**
 * Manages the selection of geographic features on a MapLibre map
 */
export class SelectionManager {
    private map: maplibregl.Map;
    private selectedFeatures: Map<string, SelectedFeature> = new Map();
    private sourceId: string;
    private layerId: string;
    private currentSelectionColor: string;
    private previousSelectionColor: string;
    private selectionFillOpacity: number;
    private selectionLineWidth: number;
    private eventListeners: Map<SelectionEventType, Set<SelectionEventListener>> = new Map();
    private selectionBounds: SelectionBounds | null = null;

    /**
     * Creates a new SelectionManager instance
     * 
     * @param options Configuration options
     */
    constructor(options: SelectionManagerOptions) {
        this.map = options.map;
        this.sourceId = options.selectionSourceId || 'maplibre-selection-source';
        this.layerId = options.selectionLayerId || 'maplibre-selection-layer';
        this.currentSelectionColor = options.currentSelectionColor || '#ffffff';
        this.previousSelectionColor = options.previousSelectionColor || '#cccccc';
        this.selectionFillOpacity = options.selectionFillOpacity || 0.2;
        this.selectionLineWidth = options.selectionLineWidth || 2;

        this.initialize();
    }

    /**
     * Initialize the selection manager by setting up the map source and layer
     */
    private initialize(): void {
        // Add a source for the selection if it doesn't exist
        if (!this.map.getSource(this.sourceId)) {
            this.map.addSource(this.sourceId, {
                type: 'geojson',
                data: this.getSelectionAsFeatureCollection()
            });
        }

        // Add a layer to render the selection if it doesn't exist
        if (!this.map.getLayer(this.layerId)) {
            this.map.addLayer({
                id: this.layerId,
                type: 'line',
                source: this.sourceId,
                paint: {
                    'line-color': [
                        'case',
                        ['get', 'isCurrentSelection'], this.currentSelectionColor,
                        this.previousSelectionColor
                    ],
                    'line-width': this.selectionLineWidth,
                    'line-dasharray': [3, 3]
                }
            });

            // Add fill layer
            this.map.addLayer({
                id: `${this.layerId}-fill`,
                type: 'fill',
                source: this.sourceId,
                paint: {
                    'fill-color': [
                        'case',
                        ['get', 'isCurrentSelection'], this.currentSelectionColor,
                        this.previousSelectionColor
                    ],
                    'fill-opacity': this.selectionFillOpacity
                }
            });
        }
    }

    /**
     * Convert selection to a GeoJSON FeatureCollection
     */
    private getSelectionAsFeatureCollection(): GeoJSON.FeatureCollection {
        const features: GeoJSON.Feature[] = [];

        this.selectedFeatures.forEach(selected => {
            const feature = { ...selected.feature };
            if (!feature.properties) {
                feature.properties = {};
            }

            feature.properties.selected = selected.selected;
            feature.properties.isCurrentSelection = selected.isCurrentSelection;
            feature.properties.selectionId = selected.id;

            features.push(feature);
        });

        // Also add the selection bounding box if it exists
        if (this.selectionBounds) {
            const bbox = this.selectionBounds.bbox;
            const bboxPolygon = turf.bboxPolygon(bbox);

            if (bboxPolygon.properties) {
                bboxPolygon.properties.isBoundingBox = true;
                bboxPolygon.properties.isCurrentSelection = true;
            }

            features.push(bboxPolygon);
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }

    /**
     * Update the source data with the current selection
     */
    private updateSource(): void {
        const source = this.map.getSource(this.sourceId);
        if (source && 'setData' in source) {
            (source as maplibregl.GeoJSONSource).setData(this.getSelectionAsFeatureCollection());
        }
    }

    /**
     * Calculate the bounding box for the current selection
     */
    private calculateSelectionBounds(): SelectionBounds | null {
        if (this.selectedFeatures.size === 0) {
            return null;
        }

        // Combine all features into a feature collection
        const features = Array.from(this.selectedFeatures.values()).map(s => s.feature);
        const featureCollection = turf.featureCollection(features);

        // Calculate bbox
        const bbox = turf.bbox(featureCollection) as Bbox;
        const center = turf.center(featureCollection).geometry.coordinates as [number, number];

        // Calculate area and perimeter
        let area = 0;
        let perimeter = 0;

        // Calculate area and perimeter based on feature types
        features.forEach(feature => {
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                // Add to area
                area += turf.area(feature);

                // Add to perimeter
                const lines = turf.polygonToLine(feature.geometry);
                if (Array.isArray(lines)) {
                    lines.forEach(line => {
                        perimeter += turf.length(line, { units: 'meters' });
                    });
                } else {
                    perimeter += turf.length(lines, { units: 'meters' });
                }
            } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                // Add to perimeter only
                perimeter += turf.length(feature, { units: 'meters' });
            }
        });

        return {
            bbox,
            center,
            area,
            perimeter
        };
    }

    /**
     * Select a geographic feature
     * 
     * @param feature The feature to select
     * @param sourceId The source ID of the feature
     * @param layerId The layer ID of the feature
     * @param setAsCurrent Whether to set this as the current selection
     * @returns The selected feature object
     */
    public select(
        feature: GeoJSON.Feature,
        sourceId: string,
        layerId: string,
        setAsCurrent: boolean = true
    ): SelectedFeature {
        // Generate a unique ID if the feature doesn't have one
        const featureId = feature.id?.toString() || `feature-${Math.random().toString(36).substring(2, 9)}`;

        // If setting as current, first mark all others as not current
        if (setAsCurrent) {
            this.selectedFeatures.forEach(f => {
                f.isCurrentSelection = false;
            });
        }

        const selectedFeature: SelectedFeature = {
            id: featureId,
            feature,
            sourceId,
            layerId,
            selected: true,
            isCurrentSelection: setAsCurrent
        };

        this.selectedFeatures.set(featureId, selectedFeature);

        // Recalculate the selection bounds
        this.selectionBounds = this.calculateSelectionBounds();

        // Update the map
        this.updateSource();

        // Emit the selection event
        this.emitEvent('select', {
            type: 'select',
            selected: Array.from(this.selectedFeatures.values()),
            bounds: this.selectionBounds,
            map: this.map
        });

        return selectedFeature;
    }

    /**
     * Deselect a feature by ID
     * 
     * @param featureId ID of the feature to deselect
     * @returns True if the feature was deselected, false otherwise
     */
    public deselect(featureId: string): boolean {
        const removed = this.selectedFeatures.delete(featureId);

        if (removed) {
            // Recalculate the selection bounds
            this.selectionBounds = this.calculateSelectionBounds();

            // Update the map
            this.updateSource();

            // Emit the deselection event
            this.emitEvent('deselect', {
                type: 'deselect',
                selected: Array.from(this.selectedFeatures.values()),
                bounds: this.selectionBounds,
                map: this.map
            });
        }

        return removed;
    }

    /**
     * Clear all selections
     */
    public clearSelection(): void {
        this.selectedFeatures.clear();
        this.selectionBounds = null;
        this.updateSource();

        // Emit the clear event
        this.emitEvent('clear', {
            type: 'clear',
            selected: [],
            bounds: null,
            map: this.map
        });
    }

    /**
     * Get the current selection
     * 
     * @returns Array of selected features
     */
    public getSelection(): SelectedFeature[] {
        return Array.from(this.selectedFeatures.values());
    }

    /**
     * Get the current selection's bounding box
     * 
     * @returns Selection bounds object or null if nothing is selected
     */
    public getSelectionBounds(): SelectionBounds | null {
        return this.selectionBounds;
    }

    /**
     * Add an event listener for selection events
     * 
     * @param type Event type
     * @param listener Listener function
     */
    public on(type: SelectionEventType, listener: SelectionEventListener): void {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, new Set());
        }

        this.eventListeners.get(type)?.add(listener);
    }

    /**
     * Remove an event listener
     * 
     * @param type Event type
     * @param listener Listener to remove
     */
    public off(type: SelectionEventType, listener: SelectionEventListener): void {
        if (this.eventListeners.has(type)) {
            this.eventListeners.get(type)?.delete(listener);
        }
    }

    /**
     * Emit an event to all registered listeners
     * 
     * @param type Event type
     * @param event Event data
     */
    private emitEvent(type: SelectionEventType, event: SelectionEvent): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }

        // Also emit the 'change' event for any selection change
        if (type !== 'change') {
            const changeListeners = this.eventListeners.get('change');
            if (changeListeners) {
                changeListeners.forEach(listener => listener({
                    ...event,
                    type: 'change'
                }));
            }
        }
    }

    /**
     * Clean up when the selection manager is no longer needed
     */
    public destroy(): void {
        if (this.map.getLayer(`${this.layerId}-fill`)) {
            this.map.removeLayer(`${this.layerId}-fill`);
        }

        if (this.map.getLayer(this.layerId)) {
            this.map.removeLayer(this.layerId);
        }

        if (this.map.getSource(this.sourceId)) {
            this.map.removeSource(this.sourceId);
        }

        this.eventListeners.clear();
        this.selectedFeatures.clear();
    }
}
