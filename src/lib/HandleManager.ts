import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { Handle, HandleEvent, HandleEventListener, HandleEventType, HandleManagerOptions, HandleStyle } from './types';

/**
 * HandleManager class for managing interactive handles on a MapLibre GL map
 */
export class HandleManager {
    private map: maplibregl.Map;
    private handles: Map<string, Handle> = new Map();
    private sourceId: string;
    private layerId: string;
    private defaultStyle: HandleStyle;
    private eventListeners: Map<HandleEventType, Set<HandleEventListener>> = new Map();
    private activeHandle: string | null = null;
    private dragState: {
        handle: Handle;
        initialPosition: { lon: number; lat: number };
        currentPosition: { lon: number; lat: number };
    } | null = null;

    // Store event handlers so they can be removed later
    private boundEventHandlers: {
        mousemove?: (e: maplibregl.MapMouseEvent) => void;
        mouseup?: (e: maplibregl.MapMouseEvent) => void;
        [key: string]: ((e: maplibregl.MapMouseEvent) => void) | undefined;
    } = {};

    /**
     * Creates a new HandleManager instance
     * 
     * @param options Configuration options for the handle manager
     */
    constructor(options: HandleManagerOptions) {
        this.map = options.map;
        this.sourceId = options.handleSourceId || 'maplibre-handles-source';
        this.layerId = options.handleLayerId || 'maplibre-handles-layer';
        this.defaultStyle = options.defaultStyle || {
            fillColor: '#3bb2d0',
            strokeColor: '#ffffff',
            strokeWidth: 2,
            opacity: 0.8
        };

        this.initialize();
    }

    /**
     * Initialize the handle manager by setting up the map source and layer
     */
    private initialize(): void {
        // Add a source for the handles if it doesn't exist
        if (!this.map.getSource(this.sourceId)) {
            this.map.addSource(this.sourceId, {
                type: 'geojson',
                data: this.getHandlesAsFeatureCollection()
            });
        }

        // Add a symbol layer to render the handles if it doesn't exist
        if (!this.map.getLayer(this.layerId)) {
            this.map.addLayer({
                id: this.layerId,
                type: 'symbol',
                source: this.sourceId,
                layout: {
                    'icon-image': ['get', 'shape'],
                    'icon-size': ['get', 'size'],
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    // Custom cursor handled through event listeners instead
                },
                paint: {
                    'icon-color': ['get', 'color'],
                    'icon-opacity': this.defaultStyle.opacity || 0.8
                }
            });
        }

        // Set up mouse event handlers
        this.setupEventHandlers();
    }

    /**
     * Set up mouse event handlers for handle interactions
     */
    private setupEventHandlers(): void {
        // Mouse move handler for dragging
        this.boundEventHandlers.mousemove = (e: maplibregl.MapMouseEvent) => {
            if (this.dragState) {
                const { handle } = this.dragState;
                const position = { lon: e.lngLat.lng, lat: e.lngLat.lat };

                // Apply any constraints
                const constrainedPosition = this.applyConstraints(handle, position);

                // Update handle position
                handle.position = constrainedPosition;
                this.dragState.currentPosition = constrainedPosition;

                // Update the handle on the map
                this.updateHandle(handle.id, handle);

                // Emit the drag event
                this.emitEvent('drag', {
                    type: 'drag',
                    handle,
                    originalEvent: e.originalEvent,
                    position: constrainedPosition
                });
            }
        };
        this.map.on('mousemove', this.boundEventHandlers.mousemove);

        // Mouse down handler for starting drag
        this.map.on('mousedown', this.layerId, (e: maplibregl.MapMouseEvent) => {
            // Prevent the map from panning
            e.preventDefault();

            const { features } = e as any;
            if (features && features.length > 0) {
                const feature = features[0];
                const handleId = feature.properties?.id;
                const handle = this.handles.get(handleId);

                if (handle && handle.draggable) {
                    this.activeHandle = handleId;
                    this.dragState = {
                        handle,
                        initialPosition: { ...handle.position },
                        currentPosition: { ...handle.position }
                    };

                    // Emit the dragstart event
                    this.emitEvent('dragstart', {
                        type: 'dragstart',
                        handle,
                        originalEvent: e.originalEvent,
                        position: handle.position
                    });
                }
            }
        });

        // Mouse up handler for ending drag
        this.boundEventHandlers.mouseup = (e: maplibregl.MapMouseEvent) => {
            if (this.dragState) {
                const { handle } = this.dragState;

                // Emit the dragend event
                this.emitEvent('dragend', {
                    type: 'dragend',
                    handle,
                    originalEvent: e.originalEvent,
                    position: handle.position
                });

                this.dragState = null;
                this.activeHandle = null;
            }
        };
        this.map.on('mouseup', this.boundEventHandlers.mouseup);

        // Click handler for handles
        this.map.on('click', this.layerId, (e: maplibregl.MapMouseEvent) => {
            const { features } = e as any;
            if (features && features.length > 0) {
                const feature = features[0];
                const handleId = feature.properties?.id;
                const handle = this.handles.get(handleId);

                if (handle) {
                    // Emit the click event
                    this.emitEvent('click', {
                        type: 'click',
                        handle,
                        originalEvent: e.originalEvent,
                        position: handle.position
                    });
                }
            }
        });

        // Mouse enter handler for hover effects
        this.map.on('mouseenter', this.layerId, (e: maplibregl.MapMouseEvent) => {
            this.map.getCanvas().style.cursor = 'pointer';

            const { features } = e as any;
            if (features && features.length > 0) {
                const feature = features[0];
                const handleId = feature.properties?.id;
                const handle = this.handles.get(handleId);

                if (handle) {
                    // Set cursor style based on handle type
                    this.map.getCanvas().style.cursor = handle.cursor;

                    // Emit the mouseover event
                    this.emitEvent('mouseover', {
                        type: 'mouseover',
                        handle,
                        originalEvent: e.originalEvent,
                        position: handle.position
                    });
                }
            }
        });

        // Mouse leave handler to reset cursor
        this.map.on('mouseleave', this.layerId, (e: maplibregl.MapMouseEvent) => {
            this.map.getCanvas().style.cursor = '';

            const { features } = e as any;
            if (features && features.length > 0) {
                const feature = features[0];
                const handleId = feature.properties?.id;
                const handle = this.handles.get(handleId);

                if (handle) {
                    // Emit the mouseout event
                    this.emitEvent('mouseout', {
                        type: 'mouseout',
                        handle,
                        originalEvent: e.originalEvent,
                        position: handle.position
                    });
                }
            }
        });
    }

    /**
     * Apply constraints to a handle's position during dragging
     */
    private applyConstraints(
        handle: Handle,
        newPosition: { lon: number; lat: number }
    ): { lon: number; lat: number } {
        const constraints = handle.constraints;
        if (!constraints) {
            return newPosition;
        }

        const result = { ...newPosition };

        // Apply lock axis constraint
        if (constraints.lockAxis) {
            if (this.dragState) {
                const initialPos = this.dragState.initialPosition;

                if (constraints.lockAxis === 'x') {
                    result.lon = initialPos.lon;
                } else if (constraints.lockAxis === 'y') {
                    result.lat = initialPos.lat;
                }
            }
        }

        // Apply snap to grid constraint
        if (constraints.snapToGrid) {
            const gridSize = 0.001; // Approximately 100m grid at the equator
            result.lon = Math.round(result.lon / gridSize) * gridSize;
            result.lat = Math.round(result.lat / gridSize) * gridSize;
        }

        return result;
    }

    /**
     * Convert handles to a GeoJSON FeatureCollection
     */
    private getHandlesAsFeatureCollection(): GeoJSON.FeatureCollection {
        const features: GeoJSON.Feature[] = [];

        this.handles.forEach(handle => {
            if (!handle.visible) return;

            const point = turf.point([handle.position.lon, handle.position.lat], {
                id: handle.id,
                type: handle.type,
                shape: handle.shape,
                color: handle.color,
                size: handle.size,
                cursor: handle.cursor,
                draggable: handle.draggable
            });

            features.push(point);
        });

        return {
            type: 'FeatureCollection',
            features
        };
    }

    /**
     * Update the source data with the current handles
     */
    private updateSource(): void {
        const source = this.map.getSource(this.sourceId);
        if (source && typeof source === 'object' && 'setData' in source) {
            (source as any).setData(this.getHandlesAsFeatureCollection());
        }
    }

    /**
     * Add a single handle to the map
     * 
     * @param handle The handle to add
     * @returns The added handle
     */
    public addHandle(handle: Handle): Handle {
        this.handles.set(handle.id, handle);
        this.updateSource();
        return handle;
    }

    /**
     * Add multiple handles to the map
     * 
     * @param handles Array of handles to add
     * @returns Array of added handles
     */
    public addHandles(handles: Handle[]): Handle[] {
        handles.forEach(handle => {
            this.handles.set(handle.id, handle);
        });

        this.updateSource();
        return handles;
    }

    /**
     * Remove a handle from the map by ID
     * 
     * @param handleId ID of the handle to remove
     * @returns True if the handle was removed, false otherwise
     */
    public removeHandle(handleId: string): boolean {
        const removed = this.handles.delete(handleId);
        if (removed) {
            this.updateSource();
        }
        return removed;
    }

    /**
     * Update an existing handle
     * 
     * @param handleId ID of the handle to update
     * @param newProps New properties to apply to the handle
     * @returns The updated handle or null if not found
     */
    public updateHandle(handleId: string, newProps: Partial<Handle>): Handle | null {
        const handle = this.handles.get(handleId);

        if (!handle) {
            return null;
        }

        const updatedHandle = { ...handle, ...newProps };
        this.handles.set(handleId, updatedHandle);
        this.updateSource();

        return updatedHandle;
    }

    /**
     * Get a handle by ID
     * 
     * @param handleId ID of the handle to retrieve
     * @returns The handle or null if not found
     */
    public getHandle(handleId: string): Handle | null {
        return this.handles.get(handleId) || null;
    }

    /**
     * Get all handles
     * 
     * @returns Array of all handles
     */
    public getAllHandles(): Handle[] {
        return Array.from(this.handles.values());
    }

    /**
     * Set the visibility of a handle
     * 
     * @param handleId ID of the handle
     * @param visible Visibility state
     * @returns The updated handle or null if not found
     */
    public setHandleVisibility(handleId: string, visible: boolean): Handle | null {
        return this.updateHandle(handleId, { visible });
    }

    /**
     * Set the position of a handle
     * 
     * @param handleId ID of the handle
     * @param position New position
     * @returns The updated handle or null if not found
     */
    public setHandlePosition(
        handleId: string,
        position: { lon: number; lat: number }
    ): Handle | null {
        return this.updateHandle(handleId, { position });
    }

    /**
     * Clear all handles from the map
     */
    public clearHandles(): void {
        this.handles.clear();
        this.updateSource();
    }

    /**
     * Add an event listener for handle events
     * 
     * @param type Event type to listen for
     * @param listener Function to call when the event occurs
     */
    public on(type: HandleEventType, listener: HandleEventListener): void {
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
    public off(type: HandleEventType, listener: HandleEventListener): void {
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
    private emitEvent(type: HandleEventType, event: HandleEvent): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }
    }

    /**
     * Clean up the handle manager when it's no longer needed
     */
    public destroy(): void {
        if (this.map.getLayer(this.layerId)) {
            this.map.removeLayer(this.layerId);
        }

        if (this.map.getSource(this.sourceId)) {
            this.map.removeSource(this.sourceId);
        }

        // Clear all event listeners
        this.eventListeners.clear();
        this.handles.clear();

        // Remove map event handlers properly
        if (this.boundEventHandlers.mousemove) {
            this.map.off('mousemove', this.boundEventHandlers.mousemove);
        }

        if (this.boundEventHandlers.mouseup) {
            this.map.off('mouseup', this.boundEventHandlers.mouseup);
        }

        // Store layer event handlers at initialization time so we can remove them properly
        // For now we use a workaround by ignoring these in TypeScript
        // @ts-ignore
        this.map.off('mousedown', this.layerId);
        // @ts-ignore
        this.map.off('click', this.layerId);
        // @ts-ignore
        this.map.off('mouseenter', this.layerId);
        // @ts-ignore
        this.map.off('mouseleave', this.layerId);
    }
}