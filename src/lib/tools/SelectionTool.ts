import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { Handle } from '../';
import { BaseTool } from './BaseTool';
import { ToolOptions } from './types';

/**
 * Options for creating a selection tool
 */
export interface SelectionToolOptions extends ToolOptions {
    selectableLayers?: string[];
    multiSelect?: boolean;
}

/**
 * Tool for selecting geographic features on the map
 */
export class SelectionTool extends BaseTool {
    private selectableLayers: string[];
    private multiSelect: boolean;
    private dragStart: maplibregl.LngLat | null = null;
    private dragCurrent: maplibregl.LngLat | null = null;
    private dragBoxLayer: string = 'maplibre-drag-box-layer';
    private dragBoxSource: string = 'maplibre-drag-box-source';

    /**
     * Creates a new SelectionTool instance
     * 
     * @param options Configuration options
     */
    constructor(options: SelectionToolOptions) {
        super(options);

        this.selectableLayers = options.selectableLayers || [];
        this.multiSelect = options.multiSelect || false;

        // Set tool properties
        this.id = 'selection-tool';
        this.name = 'Selection Tool';
        this.type = 'selection';
        this.cursor = 'pointer';
    }

    /**
     * Activate the selection tool
     */
    public override activate(): void {
        super.activate();

        // Initialize drag box source and layer if they don't exist
        if (!this.map.getSource(this.dragBoxSource)) {
            this.map.addSource(this.dragBoxSource, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[]]
                    }
                }
            });
        }

        if (!this.map.getLayer(this.dragBoxLayer)) {
            this.map.addLayer({
                id: this.dragBoxLayer,
                type: 'fill',
                source: this.dragBoxSource,
                paint: {
                    'fill-color': '#0080ff',
                    'fill-opacity': 0.1,
                    'fill-outline-color': '#0080ff'
                },
                layout: {
                    visibility: 'none'
                }
            });
        }
    }

    /**
     * Deactivate the selection tool
     */
    public override deactivate(): void {
        // Clean up drag box
        this.resetDragBox();

        // Optionally remove the drag box layer and source
        if (this.map.getLayer(this.dragBoxLayer)) {
            this.map.removeLayer(this.dragBoxLayer);
        }

        if (this.map.getSource(this.dragBoxSource)) {
            this.map.removeSource(this.dragBoxSource);
        }

        super.deactivate();
    }

    /**
     * Handle map click for feature selection
     */
    public override handleClick(e: maplibregl.MapMouseEvent): void {
        // If we're in the middle of a drag, ignore clicks
        if (this.dragStart !== null) {
            return;
        }

        // Query features at the clicked point
        const features = this.queryFeaturesAtPoint(e.point);

        // If no features found and not in multi-select mode, clear selection
        if (features.length === 0 && !this.multiSelect) {
            this.selectionManager.clearSelection();
            return;
        }

        // If not in multi-select mode, clear previous selection
        if (!this.multiSelect) {
            this.selectionManager.clearSelection();
        }

        // Select the features
        features.forEach(feature => {
            const layerId = feature.layer.id;
            const sourceId = feature.source;

            this.selectionManager.select(
                feature,
                sourceId,
                layerId,
                !this.multiSelect // Set as current if not in multi-select mode
            );
        });

        // After selection, create handles for the selection
        this.createHandlesForSelection();
    }

    /**
     * Handle mouse down for drag selection box
     */
    public override handleMouseDown(e: maplibregl.MapMouseEvent): void {
        // Start drag box
        this.dragStart = e.lngLat;
        this.dragCurrent = e.lngLat;

        // Show the drag box layer
        this.map.setLayoutProperty(this.dragBoxLayer, 'visibility', 'visible');

        // Update the drag box
        this.updateDragBox();
    }

    /**
     * Handle mouse move for updating drag selection box
     */
    public override handleMouseMove(e: maplibregl.MapMouseEvent): void {
        if (this.dragStart !== null) {
            // Update current drag position
            this.dragCurrent = e.lngLat;

            // Update the drag box
            this.updateDragBox();
        }
    }

    /**
     * Handle mouse up to complete drag selection box
     */
    public override handleMouseUp(e: maplibregl.MapMouseEvent): void {
        if (this.dragStart !== null && this.dragCurrent !== null) {
            // Get bounds of the drag box
            const bounds = new maplibregl.LngLatBounds(
                this.dragStart,
                this.dragCurrent
            );

            // If the box is too small, treat it as a click
            const sw = this.map.project(bounds.getSouthWest());
            const ne = this.map.project(bounds.getNorthEast());
            const boxSize = Math.abs((ne.x - sw.x) * (ne.y - sw.y));

            if (boxSize > 100) { // Threshold for minimum box size
                // Query features within the drag box
                const features = this.queryFeaturesInBox(bounds);

                // If not in multi-select mode, clear previous selection
                if (!this.multiSelect) {
                    this.selectionManager.clearSelection();
                }

                // Select the features
                features.forEach(feature => {
                    const layerId = feature.layer.id;
                    const sourceId = feature.source;

                    this.selectionManager.select(
                        feature,
                        sourceId,
                        layerId,
                        !this.multiSelect // Set as current if not in multi-select mode
                    );
                });

                // After selection, create handles for the selection
                this.createHandlesForSelection();
            }

            // Reset the drag box
            this.resetDragBox();
        }
    }

    /**
     * Update the drag box on the map
     */
    private updateDragBox(): void {
        if (this.dragStart === null || this.dragCurrent === null) {
            return;
        }

        // Create a box between start and current points
        const bounds = new maplibregl.LngLatBounds(
            this.dragStart,
            this.dragCurrent
        );

        // Create a polygon from the bounds
        const polygon = turf.bboxPolygon([
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ]);

        // Update the source data
        const source = this.map.getSource(this.dragBoxSource);
        if (source && 'setData' in source) {
            (source as maplibregl.GeoJSONSource).setData(polygon);
        }
    }

    /**
     * Reset the drag box
     */
    private resetDragBox(): void {
        this.dragStart = null;
        this.dragCurrent = null;

        // Hide the drag box layer
        if (this.map.getLayer(this.dragBoxLayer)) {
            this.map.setLayoutProperty(this.dragBoxLayer, 'visibility', 'none');
        }
    }

    /**
     * Query features at a specific point
     */
    private queryFeaturesAtPoint(point: maplibregl.Point): maplibregl.MapboxGeoJSONFeature[] {
        // Filter to only include selectable layers
        const layers = this.selectableLayers.length > 0
            ? this.selectableLayers
            : undefined;

        return this.map.queryRenderedFeatures(point, { layers });
    }

    /**
     * Query features within a bounding box
     */
    private queryFeaturesInBox(bounds: maplibregl.LngLatBounds): maplibregl.MapboxGeoJSONFeature[] {
        // Convert bounds to points on the screen
        const sw = this.map.project(bounds.getSouthWest());
        const ne = this.map.project(bounds.getNorthEast());

        // Create a box from the points
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [sw, ne];

        // Filter to only include selectable layers
        const layers = this.selectableLayers.length > 0
            ? this.selectableLayers
            : undefined;

        return this.map.queryRenderedFeatures(box, { layers });
    }

    /**
     * Create handles for the current selection
     */
    private createHandlesForSelection(): void {
        // Clear any existing handles
        this.clearHandles();

        // Get the selection bounds
        const bounds = this.selectionManager.getSelectionBounds();
        if (!bounds) {
            return;
        }

        // Create resize handles at the corners and midpoints of the bounding box
        const bbox = bounds.bbox;

        // Create corner handles
        const nw = { lon: bbox[0], lat: bbox[3] }; // Northwest
        const ne = { lon: bbox[2], lat: bbox[3] }; // Northeast
        const se = { lon: bbox[2], lat: bbox[1] }; // Southeast
        const sw = { lon: bbox[0], lat: bbox[1] }; // Southwest

        // Create midpoint handles
        const n = { lon: (bbox[0] + bbox[2]) / 2, lat: bbox[3] }; // North
        const e = { lon: bbox[2], lat: (bbox[1] + bbox[3]) / 2 }; // East
        const s = { lon: (bbox[0] + bbox[2]) / 2, lat: bbox[1] }; // South
        const w = { lon: bbox[0], lat: (bbox[1] + bbox[3]) / 2 }; // West

        // Create center handle for moving
        const center = { lon: bounds.center[0], lat: bounds.center[1] };

        // Add resize handles at corners (squares)
        this.addHandle('resize', 'square', nw);
        this.addHandle('resize', 'square', ne);
        this.addHandle('resize', 'square', se);
        this.addHandle('resize', 'square', sw);

        // Add resize handles at midpoints (circles)
        this.addHandle('resize', 'circle', n);
        this.addHandle('resize', 'circle', e);
        this.addHandle('resize', 'circle', s);
        this.addHandle('resize', 'circle', w);

        // Add move handle at center
        this.addHandle('move', 'circle', center);
    }

    /**
     * Add a handle to the map
     */
    private addHandle(type: Handle['type'], shape: Handle['shape'], position: { lon: number; lat: number }): Handle {
        const handle = this.handleManager.createHandle(type, shape, position);
        this.handleManager.addHandle(handle);
        this.handles.push(handle);

        return handle;
    }
}
