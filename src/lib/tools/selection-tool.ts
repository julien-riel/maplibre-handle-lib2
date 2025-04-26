import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { BaseTool } from './base-tool';
import { ToolOptions } from './types';
import { Handle, HandleEvent } from '../types';

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

    // New properties to track handles and interactions
    private activeHandle: Handle | null = null;
    private handleListeners: { type: string, listener: (event: HandleEvent) => void }[] = [];
    private cornerHandles: Handle[] = [];
    private edgeHandles: Handle[] = [];
    private centerHandle: Handle | null = null;
    private initialSelectionBounds: any = null;

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

        // Subscribe to handle events
        this.subscribeToHandleEvents();
    }

    /**
     * Deactivate the selection tool
     */
    public override deactivate(): void {
        // Clean up drag box
        this.resetDragBox();

        // Remove handle event listeners
        this.unsubscribeFromHandleEvents();

        // Clear handles references
        this.cornerHandles = [];
        this.edgeHandles = [];
        this.centerHandle = null;
        this.activeHandle = null;

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
     * Subscribe to handle events
     */
    private subscribeToHandleEvents(): void {
        // Handle drag start event
        const dragStartListener = (event: HandleEvent) => {
            this.activeHandle = event.handle;
            this.initialSelectionBounds = this.selectionManager.getSelectionBounds();

            // Set appropriate cursor based on handle type
            if (event.handle.type === 'move') {
                this.map.getCanvas().style.cursor = 'move';
            } else if (event.handle.type === 'resize') {
                // Set resize cursor based on handle position
                const handleShape = event.handle.shape;
                if (handleShape === 'square') {
                    // Corner handles
                    const position = event.handle.position;
                    const bounds = this.initialSelectionBounds?.bbox;
                    if (bounds) {
                        const isTop = Math.abs(position.lat - bounds[3]) < 0.0001;
                        const isBottom = Math.abs(position.lat - bounds[1]) < 0.0001;
                        const isLeft = Math.abs(position.lon - bounds[0]) < 0.0001;
                        const isRight = Math.abs(position.lon - bounds[2]) < 0.0001;

                        if ((isTop && isLeft) || (isBottom && isRight)) {
                            this.map.getCanvas().style.cursor = 'nwse-resize';
                        } else {
                            this.map.getCanvas().style.cursor = 'nesw-resize';
                        }
                    }
                } else {
                    // Edge handles
                    const position = event.handle.position;
                    const bounds = this.initialSelectionBounds?.bbox;
                    if (bounds) {
                        const isTop = Math.abs(position.lat - bounds[3]) < 0.0001;
                        const isBottom = Math.abs(position.lat - bounds[1]) < 0.0001;
                        const isLeft = Math.abs(position.lon - bounds[0]) < 0.0001;
                        const isRight = Math.abs(position.lon - bounds[2]) < 0.0001;

                        if (isTop || isBottom) {
                            this.map.getCanvas().style.cursor = 'ns-resize';
                        } else {
                            this.map.getCanvas().style.cursor = 'ew-resize';
                        }
                    }
                }
            }
        };

        // Handle drag event
        const dragListener = (event: HandleEvent) => {
            if (!this.activeHandle || !this.initialSelectionBounds) return;

            const handle = event.handle;
            const position = event.position;

            if (handle.type === 'move') {
                // Move all selected features
                this.moveSelection(position);
            } else if (handle.type === 'resize') {
                // Resize the selection based on which handle is being dragged
                this.resizeSelection(handle, position);
            }
        };

        // Handle drag end event
        const dragEndListener = (event: HandleEvent) => {
            // Reset cursor
            this.map.getCanvas().style.cursor = this.cursor;

            // Apply final transformation to selected features
            if (this.activeHandle) {
                // Finalize any transformations
                this.finalizeTransformation();

                // Reset active handle and bounds
                this.activeHandle = null;
                this.initialSelectionBounds = null;

                // Recreate handles after transformation
                this.createHandlesForSelection();
            }
        };

        // Register the listeners with the HandleManager
        this.handleManager.on('dragstart', dragStartListener);
        this.handleManager.on('drag', dragListener);
        this.handleManager.on('dragend', dragEndListener);

        // Store listeners for cleanup
        this.handleListeners = [
            { type: 'dragstart', listener: dragStartListener },
            { type: 'drag', listener: dragListener },
            { type: 'dragend', listener: dragEndListener }
        ];
    }

    /**
     * Unsubscribe from handle events
     */
    private unsubscribeFromHandleEvents(): void {
        this.handleListeners.forEach(({ type, listener }) => {
            this.handleManager.off(type as any, listener);
        });
        this.handleListeners = [];
    }

    /**
     * Move the selection based on the handle drag
     */
    private moveSelection(position: { lon: number; lat: number }): void {
        // Implement feature movement logic
        // This method would update the preview of where features will move to
        // but not actually modify the source data yet

        // For preview, you could create temporary layers showing where
        // the features will end up after the move

        // You would track the movement delta from initialSelectionBounds center
        // to current position
    }

    /**
     * Resize the selection based on the handle drag
     */
    private resizeSelection(handle: Handle, position: { lon: number; lat: number }): void {
        // Implement resize logic based on which handle is being dragged
        // You would calculate a scale factor based on the initial bounds and 
        // the current position of the handle

        // Different logic would apply based on:
        // - If it's a corner handle (scale in both directions)
        // - If it's an edge handle (scale in one direction only)
        // - Whether any modifier keys are pressed (preserve aspect ratio, etc.)
    }

    /**
     * Finalize the transformation by applying changes to feature data
     */
    private finalizeTransformation(): void {
        // Apply the actual transformation to the source data
        // This would depend on the specific transformation being performed

        // For move: apply offset to all vertices
        // For resize: apply scale to all vertices
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
    private queryFeaturesAtPoint(point: maplibregl.Point): maplibregl.MapGeoJSONFeature[] {
        // Filter to only include selectable layers
        const layers = this.selectableLayers.length > 0
            ? this.selectableLayers
            : undefined;

        return this.map.queryRenderedFeatures(point, { layers });
    }

    /**
     * Query features within a bounding box
     */
    private queryFeaturesInBox(bounds: maplibregl.LngLatBounds): maplibregl.MapGeoJSONFeature[] {
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

        // Clear handle references
        this.cornerHandles = [];
        this.edgeHandles = [];
        this.centerHandle = null;

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
        const nwHandle = this.addHandle('resize', 'square', nw)
        this.cornerHandles.push(nwHandle);
        const neHandle = this.addHandle('resize', 'square', ne)
        this.cornerHandles.push(neHandle);
        const seHandle = this.addHandle('resize', 'square', se)
        this.cornerHandles.push(seHandle);
        const swHandle = this.addHandle('resize', 'square', sw)
        this.cornerHandles.push(swHandle);

        // Add resize handles at midpoints (circles)
        this.edgeHandles.push(this.addHandle('resize', 'circle', n));
        this.edgeHandles.push(this.addHandle('resize', 'circle', e));
        this.edgeHandles.push(this.addHandle('resize', 'circle', s));
        this.edgeHandles.push(this.addHandle('resize', 'circle', w));

        // Add move handle at center
        // this.centerHandle = this.addHandle('move', 'circle', center);
    }

    /**
     * Add a handle to the map
     */
    private addHandle(type: Handle['type'], shape: Handle['shape'], position: { lon: number; lat: number }): Handle {
        const handle = this.handleManager.createHandle(type, shape, position);
        this.handleManager.addHandle(handle);
        return handle;
    }
}
