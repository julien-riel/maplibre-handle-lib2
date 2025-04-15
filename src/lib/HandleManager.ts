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
        // Add handle shape images to the map
        this.addHandleShapeImages();

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
     * Create and add handle shape images to the map
     */
    private addHandleShapeImages(): void {
        // Create images for each handle shape type
        this.addShapeImage('square', this.createSquareImage());
        this.addShapeImage('circle', this.createCircleImage());
        this.addShapeImage('diamond', this.createDiamondImage());
        this.addShapeImage('triangle', this.createTriangleImage());

        // Set up handler for missing images
        this.map.on('styleimagemissing', (e) => {
            // If a shape image is requested but missing, create a default circle
            if (e.id.includes('square') || e.id.includes('circle') ||
                e.id.includes('diamond') || e.id.includes('triangle')) {
                this.addShapeImage(e.id, this.createCircleImage());
            }
        });
    }

    /**
     * Add a shape image to the map
     */
    private addShapeImage(id: string, imageData: ImageData | HTMLImageElement): void {
        // Check if image already exists to avoid duplicates
        if (!this.map.hasImage(id)) {
            this.map.addImage(id, imageData, { sdf: true });
        }
    }

    /**
     * Create a square handle image
     */
    private createSquareImage(): ImageData {
        const size = 32;
        const centerPoint = size / 2;
        const squareSize = size * 0.7; // 70% of the canvas size
        const offset = (size - squareSize) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw square
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.rect(offset, offset, squareSize, squareSize);
        ctx.fill();
        ctx.stroke();

        return ctx.getImageData(0, 0, size, size);
    }

    /**
     * Create a circle handle image
     */
    private createCircleImage(): ImageData {
        const size = 32;
        const centerPoint = size / 2;
        const radius = size * 0.35; // 35% of the canvas size

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw circle
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(centerPoint, centerPoint, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        return ctx.getImageData(0, 0, size, size);
    }

    /**
     * Create a diamond handle image
     */
    private createDiamondImage(): ImageData {
        const size = 32;
        const centerPoint = size / 2;
        const diamondSize = size * 0.35; // 35% of the canvas size

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw diamond
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(centerPoint, centerPoint - diamondSize); // Top
        ctx.lineTo(centerPoint + diamondSize, centerPoint); // Right
        ctx.lineTo(centerPoint, centerPoint + diamondSize); // Bottom
        ctx.lineTo(centerPoint - diamondSize, centerPoint); // Left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        return ctx.getImageData(0, 0, size, size);
    }

    /**
     * Create a triangle handle image
     */
    private createTriangleImage(): ImageData {
        const size = 32;
        const centerPoint = size / 2;
        const triangleSize = size * 0.35; // 35% of the canvas size

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw triangle
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(centerPoint, centerPoint - triangleSize); // Top
        ctx.lineTo(centerPoint + triangleSize, centerPoint + triangleSize); // Bottom right
        ctx.lineTo(centerPoint - triangleSize, centerPoint + triangleSize); // Bottom left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        return ctx.getImageData(0, 0, size, size);
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

    /**
     * Generate a unique ID for handles
     * 
     * @returns A unique string ID
     */
    public generateId(): string {
        return 'handle-' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Get a color based on handle type
     * 
     * @param type Handle type
     * @returns Color code suitable for the handle type
     */
    public getColorForType(type: Handle['type']): string {
        const colorMap: Record<Handle['type'], string> = {
            'resize': '#ff5733',
            'rotate': '#33bbff',
            'move': '#33ff57',
            'curve': '#b533ff',
            'label': '#ffbb33',
            'snap': '#ff33bb'
        };
        return colorMap[type];
    }

    /**
     * Get a cursor type based on handle type
     * 
     * @param type Handle type
     * @returns Cursor style suitable for the handle type
     */
    public getCursorForType(type: Handle['type']): string {
        const cursorMap: Record<Handle['type'], string> = {
            'resize': 'nwse-resize',
            'rotate': 'crosshair',
            'move': 'move',
            'curve': 'pointer',
            'label': 'text',
            'snap': 'cell'
        };
        return cursorMap[type];
    }

    /**
     * Get constraints based on handle type
     * 
     * @param type Handle type
     * @returns Constraints configuration suitable for the handle type
     */
    public getConstraintsForType(type: Handle['type']): Handle['constraints'] {
        switch (type) {
            case 'resize':
                return { proportional: true };
            case 'move':
                return {};
            case 'rotate':
                return {};
            case 'curve':
                return {};
            case 'label':
                return {};
            case 'snap':
                return { snapToGrid: true };
            default:
                return {};
        }
    }

    /**
     * Create a handle with the specified type and shape
     * 
     * @param type Handle type
     * @param shape Handle shape
     * @param position Optional position. If not provided, the current map center will be used
     * @returns A new Handle object
     */
    public createHandle(type: Handle['type'], shape: Handle['shape'], position?: { lon: number; lat: number }): Handle {
        // If position is not provided, use map center
        const handlePosition = position || (() => {
            const center = this.map.getCenter();
            return { lon: center.lng, lat: center.lat };
        })();

        return {
            id: this.generateId(),
            type,
            shape,
            position: handlePosition,
            color: this.getColorForType(type),
            size: 1,
            cursor: this.getCursorForType(type),
            visible: true,
            draggable: true,
            constraints: this.getConstraintsForType(type)
        };
    }

    /**
     * Create and add a handle to the map
     * 
     * @param type Handle type
     * @param shape Handle shape
     * @param position Optional position
     * @returns The added handle
     */
    public createAndAddHandle(type: Handle['type'], shape: Handle['shape'], position?: { lon: number; lat: number }): Handle {
        const handle = this.createHandle(type, shape, position);
        return this.addHandle(handle);
    }
}