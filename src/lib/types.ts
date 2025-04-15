/**
 * Handle interface for map editing tools
 */
export interface Handle {
    id: string;
    type: 'resize' | 'rotate' | 'move' | 'curve' | 'label' | 'snap';
    shape: 'square' | 'circle' | 'diamond' | 'triangle';
    position: { lon: number; lat: number };
    color: string;
    size: number;
    cursor: string;
    visible: boolean;
    draggable: boolean;
    constraints?: {
        snapToGrid?: boolean;
        lockAxis?: 'x' | 'y';
        proportional?: boolean;
    };
}

/**
 * Style options for rendering a handle
 */
export interface HandleStyle {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
}

/**
 * Events that can be triggered on a handle
 */
export type HandleEventType =
    | 'dragstart'
    | 'drag'
    | 'dragend'
    | 'click'
    | 'mouseover'
    | 'mouseout';

/**
 * Event payload for handle events
 */
export interface HandleEvent {
    type: HandleEventType;
    handle: Handle;
    originalEvent: MouseEvent | TouchEvent;
    position: { lon: number; lat: number };
}

/**
 * Options for creating a handle manager
 */
export interface HandleManagerOptions {
    map: maplibregl.Map;
    handleLayerId?: string;
    handleSourceId?: string;
    defaultStyle?: HandleStyle;
    // interactiveHandles?: boolean;
}

/**
 * Handle event listener function
 */
export type HandleEventListener = (event: HandleEvent) => void;