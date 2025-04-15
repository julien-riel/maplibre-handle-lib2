import maplibregl from 'maplibre-gl';
import { HandleManager } from '../HandleManager';
import { SelectionManager } from '../selection/SelectionManager';
import { Tool, ToolEvent, ToolEventListener, ToolEventType } from './types';
import { HandleEvent } from '../types';

/**
 * Options for creating a tool manager
 */
export interface ToolManagerOptions {
    map: maplibregl.Map;
    handleManager: HandleManager;
    selectionManager: SelectionManager;
}

/**
 * Manages map editing tools and their lifecycle
 */
export class ToolManager {
    private map: maplibregl.Map;
    private handleManager: HandleManager;
    private selectionManager: SelectionManager;
    private tools: Map<string, Tool> = new Map();
    private activeTool: Tool | null = null;
    private eventListeners: Map<ToolEventType, Set<ToolEventListener>> = new Map();

    // Store event handlers so they can be removed later
    private boundEventHandlers: {
        click?: (e: maplibregl.MapMouseEvent) => void;
        mousemove?: (e: maplibregl.MapMouseEvent) => void;
        mousedown?: (e: maplibregl.MapMouseEvent) => void;
        mouseup?: (e: maplibregl.MapMouseEvent) => void;
        keydown?: (e: KeyboardEvent) => void;
        handleEvent?: (e: HandleEvent) => void;
    } = {};

    /**
     * Creates a new ToolManager instance
     * 
     * @param options Configuration options
     */
    constructor(options: ToolManagerOptions) {
        this.map = options.map;
        this.handleManager = options.handleManager;
        this.selectionManager = options.selectionManager;

        this.setupEventHandlers();
    }

    /**
     * Set up event handlers for map and handle events
     */
    private setupEventHandlers(): void {
        // Map click handler
        this.boundEventHandlers.click = (e: maplibregl.MapMouseEvent) => {
            if (this.activeTool) {
                this.activeTool.handleClick(e);
            }
        };
        this.map.on('click', this.boundEventHandlers.click);

        // Map mousemove handler
        this.boundEventHandlers.mousemove = (e: maplibregl.MapMouseEvent) => {
            if (this.activeTool) {
                this.activeTool.handleMouseMove(e);
            }
        };
        this.map.on('mousemove', this.boundEventHandlers.mousemove);

        // Map mousedown handler
        this.boundEventHandlers.mousedown = (e: maplibregl.MapMouseEvent) => {
            if (this.activeTool) {
                this.activeTool.handleMouseDown(e);
            }
        };
        this.map.on('mousedown', this.boundEventHandlers.mousedown);

        // Map mouseup handler
        this.boundEventHandlers.mouseup = (e: maplibregl.MapMouseEvent) => {
            if (this.activeTool) {
                this.activeTool.handleMouseUp(e);
            }
        };
        this.map.on('mouseup', this.boundEventHandlers.mouseup);

        // Keyboard handler
        this.boundEventHandlers.keydown = (e: KeyboardEvent) => {
            if (this.activeTool) {
                this.activeTool.handleKeyEvent(e);
            }
        };
        document.addEventListener('keydown', this.boundEventHandlers.keydown);

        // Handle event handler
        this.boundEventHandlers.handleEvent = (e: HandleEvent) => {
            if (this.activeTool) {
                this.activeTool.handleHandleEvent(e);
            }
        };

        // Listen to handle events from HandleManager
        const handleEvents: HandleEvent['type'][] = ['dragstart', 'drag', 'dragend', 'click', 'mouseover', 'mouseout'];
        handleEvents.forEach(eventType => {
            this.handleManager.on(eventType, this.boundEventHandlers.handleEvent!);
        });
    }

    /**
     * Register a tool with the manager
     * 
     * @param tool Tool to register
     * @returns The registered tool
     */
    public registerTool(tool: Tool): Tool {
        this.tools.set(tool.id, tool);

        // Forward tool events to manager listeners
        const toolEvents: ToolEventType[] = ['activate', 'deactivate', 'start', 'update', 'complete', 'cancel'];
        toolEvents.forEach(eventType => {
            tool.on(eventType, (event: ToolEvent) => {
                this.emitEvent(eventType, event);
            });
        });

        return tool;
    }

    /**
     * Unregister a tool from the manager
     * 
     * @param toolId ID of the tool to unregister
     * @returns True if the tool was unregistered, false otherwise
     */
    public unregisterTool(toolId: string): boolean {
        const tool = this.tools.get(toolId);

        if (tool) {
            // If this is the active tool, deactivate it first
            if (this.activeTool === tool) {
                this.deactivateTool();
            }

            // Clean up the tool
            tool.destroy();

            // Remove from tools map
            this.tools.delete(toolId);
            return true;
        }

        return false;
    }

    /**
     * Activate a tool by ID
     * 
     * @param toolId ID of the tool to activate
     * @returns The activated tool or null if not found
     */
    public activateTool(toolId: string): Tool | null {
        const tool = this.tools.get(toolId);

        if (!tool) {
            return null;
        }

        // Deactivate the current tool if there is one
        if (this.activeTool) {
            this.activeTool.deactivate();
        }

        // Activate the new tool
        tool.activate();
        this.activeTool = tool;

        return tool;
    }

    /**
     * Deactivate the current active tool
     * 
     * @returns True if a tool was deactivated, false otherwise
     */
    public deactivateTool(): boolean {
        if (this.activeTool) {
            this.activeTool.deactivate();
            this.activeTool = null;
            return true;
        }

        return false;
    }

    /**
     * Get a tool by ID
     * 
     * @param toolId ID of the tool to retrieve
     * @returns The tool or null if not found
     */
    public getTool(toolId: string): Tool | null {
        return this.tools.get(toolId) || null;
    }

    /**
     * Get all registered tools
     * 
     * @returns Array of all tools
     */
    public getAllTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get the currently active tool
     * 
     * @returns The active tool or null if none is active
     */
    public getActiveTool(): Tool | null {
        return this.activeTool;
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
    private emitEvent(type: ToolEventType, event: ToolEvent): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }
    }

    /**
     * Clean up the tool manager when it's no longer needed
     */
    public destroy(): void {
        // Deactivate the current tool if there is one
        this.deactivateTool();

        // Destroy all tools
        this.tools.forEach(tool => {
            tool.destroy();
        });
        this.tools.clear();

        // Remove map event handlers
        if (this.boundEventHandlers.click) {
            this.map.off('click', this.boundEventHandlers.click);
        }

        if (this.boundEventHandlers.mousemove) {
            this.map.off('mousemove', this.boundEventHandlers.mousemove);
        }

        if (this.boundEventHandlers.mousedown) {
            this.map.off('mousedown', this.boundEventHandlers.mousedown);
        }

        if (this.boundEventHandlers.mouseup) {
            this.map.off('mouseup', this.boundEventHandlers.mouseup);
        }

        // Remove document event handlers
        if (this.boundEventHandlers.keydown) {
            document.removeEventListener('keydown', this.boundEventHandlers.keydown);
        }

        // Remove handle event handlers
        if (this.boundEventHandlers.handleEvent) {
            const handleEvents: HandleEvent['type'][] = ['dragstart', 'drag', 'dragend', 'click', 'mouseover', 'mouseout'];
            handleEvents.forEach(eventType => {
                this.handleManager.off(eventType, this.boundEventHandlers.handleEvent!);
            });
        }

        this.eventListeners.clear();
    }
}
