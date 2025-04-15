import maplibregl from 'maplibre-gl';
import { Handle, HandleEvent, HandleManager } from '../';
import { SelectionManager } from '../selection/SelectionManager';
import { Tool, ToolEvent, ToolEventListener, ToolEventType, ToolOptions, ToolState } from './types';

/**
 * Abstract base class for map editing tools
 */
export abstract class BaseTool implements Tool {
    public id: string;
    public name: string;
    public type: string;
    public cursor: string;
    public state: ToolState = 'inactive';

    protected map: maplibregl.Map;
    protected handleManager: HandleManager;
    protected selectionManager: SelectionManager;
    protected handles: Handle[] = [];
    protected options: ToolOptions;
    protected eventListeners: Map<ToolEventType, Set<ToolEventListener>> = new Map();

    /**
     * Creates a new tool instance
     * 
     * @param options Tool configuration options
     */
    constructor(options: ToolOptions) {
        this.map = options.map;
        this.handleManager = options.handleManager;
        this.selectionManager = options.selectionManager;
        this.options = options;

        // Default values that should be overridden by subclasses
        this.id = this.generateId();
        this.name = 'Base Tool';
        this.type = 'base';
        this.cursor = 'default';
    }

    /**
     * Generate a unique ID for the tool
     */
    protected generateId(): string {
        return 'tool-' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Activate the tool - set up handles and event listeners
     */
    public activate(): void {
        if (this.state !== 'inactive') {
            // Already active, nothing to do
            return;
        }

        this.state = 'active';

        // Set cursor
        this.map.getCanvas().style.cursor = this.cursor;

        // Emit activation event
        this.emitEvent('activate', {
            type: 'activate',
            tool: this,
            state: this.state
        });
    }

    /**
     * Deactivate the tool - remove handles and event listeners
     */
    public deactivate(): void {
        if (this.state === 'inactive') {
            // Already inactive, nothing to do
            return;
        }

        // Clear any handles created by this tool
        this.clearHandles();

        // Reset cursor
        this.map.getCanvas().style.cursor = '';

        this.state = 'inactive';

        // Emit deactivation event
        this.emitEvent('deactivate', {
            type: 'deactivate',
            tool: this,
            state: this.state
        });
    }

    /**
     * Remove all handles created by this tool
     */
    protected clearHandles(): void {
        this.handles.forEach(handle => {
            this.handleManager.removeHandle(handle.id);
        });
        this.handles = [];
    }

    /**
     * Default click handler - should be overridden by tool implementations
     */
    public handleClick(e: maplibregl.MapMouseEvent): void {
        // To be implemented by subclasses
    }

    /**
     * Default mousemove handler - should be overridden by tool implementations
     */
    public handleMouseMove(e: maplibregl.MapMouseEvent): void {
        // To be implemented by subclasses
    }

    /**
     * Default mousedown handler - should be overridden by tool implementations
     */
    public handleMouseDown(e: maplibregl.MapMouseEvent): void {
        // To be implemented by subclasses
    }

    /**
     * Default mouseup handler - should be overridden by tool implementations
     */
    public handleMouseUp(e: maplibregl.MapMouseEvent): void {
        // To be implemented by subclasses
    }

    /**
     * Default handle event handler - should be overridden by tool implementations
     */
    public handleHandleEvent(e: HandleEvent): void {
        // To be implemented by subclasses
    }

    /**
     * Default key event handler - should be overridden by tool implementations
     */
    public handleKeyEvent(e: KeyboardEvent): void {
        // Handle Escape key to cancel the current operation
        if (e.key === 'Escape') {
            this.cancel();
        }
    }

    /**
     * Cancel the current operation
     */
    protected cancel(): void {
        // Clear any handles
        this.clearHandles();

        // Emit cancel event
        this.emitEvent('cancel', {
            type: 'cancel',
            tool: this,
            state: this.state
        });
    }

    /**
     * Clean up the tool when it's no longer needed
     */
    public destroy(): void {
        this.clearHandles();
        this.eventListeners.clear();
    }

    /**
     * Add an event listener for tool events
     * 
     * @param type Event type
     * @param listener Listener function
     */
    public on(type: ToolEventType, listener: ToolEventListener): void {
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
    public off(type: ToolEventType, listener: ToolEventListener): void {
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
    protected emitEvent(type: ToolEventType, event: ToolEvent): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }
    }
}
