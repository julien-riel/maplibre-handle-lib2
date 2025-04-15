import maplibregl from 'maplibre-gl';
import { HandleManager } from '../HandleManager';
import { SelectionManager } from '../selection/SelectionManager';
import { SelectedFeature } from '../selection/types';
import { Handle, HandleEvent } from '../types';

/**
 * States that a tool can be in
 */
export type ToolState = 'inactive' | 'active' | 'pending' | 'completed';

/**
 * Base tool configuration options
 */
export interface ToolOptions {
    map: maplibregl.Map;
    handleManager: HandleManager;
    selectionManager: SelectionManager;
    [key: string]: any;
}

/**
 * Tool event types
 */
export type ToolEventType =
    | 'activate'
    | 'deactivate'
    | 'start'
    | 'update'
    | 'complete'
    | 'cancel';

/**
 * Event payload for tool events
 */
export interface ToolEvent {
    type: ToolEventType;
    tool: Tool;
    state: ToolState;
    selection?: SelectedFeature[];
    originalEvent?: MouseEvent | TouchEvent | KeyboardEvent;
    position?: { lon: number; lat: number };
    handles?: Handle[];
}

/**
 * Tool event listener function
 */
export type ToolEventListener = (event: ToolEvent) => void;

/**
 * Interface for all map editing tools
 */
export interface Tool {
    /**
     * Unique identifier for the tool
     */
    id: string;

    /**
     * Human-readable name of the tool
     */
    name: string;

    /**
     * Type of the tool (selection, drawing, modification, etc.)
     */
    type: string;

    /**
     * Icon or cursor to display when the tool is active
     */
    cursor: string;

    /**
     * Current state of the tool
     */
    state: ToolState;

    /**
     * Activate the tool
     */
    activate(): void;

    /**
     * Deactivate the tool
     */
    deactivate(): void;

    /**
     * Handle a map click event
     */
    handleClick(e: maplibregl.MapMouseEvent): void;

    /**
     * Handle a map mousemove event
     */
    handleMouseMove(e: maplibregl.MapMouseEvent): void;

    /**
     * Handle a map mousedown event
     */
    handleMouseDown(e: maplibregl.MapMouseEvent): void;

    /**
     * Handle a map mouseup event
     */
    handleMouseUp(e: maplibregl.MapMouseEvent): void;

    /**
     * Handle a handle event
     */
    handleHandleEvent(e: HandleEvent): void;

    /**
     * Handle a keyboard event
     */
    handleKeyEvent(e: KeyboardEvent): void;

    /**
     * Clean up the tool when it's no longer needed
     */
    destroy(): void;

    /**
     * Add an event listener for tool events
     */
    on(type: ToolEventType, listener: ToolEventListener): void;

    /**
     * Remove an event listener
     */
    off(type: ToolEventType, listener: ToolEventListener): void;
}
