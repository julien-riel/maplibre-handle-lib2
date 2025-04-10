# MapLibre Handles

A TypeScript library for creating and managing interactive handles on MapLibre GL maps. This library allows you to create different types of editing handles that are represented as features on a MapLibre map.

## Features

- Multiple handle types: resize, rotate, move, curve, label, and snap
- Various handle shapes: square, circle, diamond, triangle
- Handle constraints: snap to grid, lock axis, proportional resizing
- Event system for handle interactions
- Built with TypeScript for type safety
- Uses TurfJS for geospatial calculations

## Installation

```bash
npm install maplibre-handles
```

## Requirements

- MapLibre GL JS (version 2.0.0 or higher)
- TurfJS (version 6.0.0 or higher)

## Basic Usage

```typescript
import { HandleManager, Handle } from 'maplibre-handles';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';

// Initialize your MapLibre GL map
const map = new maplibregl.Map({
  container: 'map',
  style: '...',
  center: [0, 0],
  zoom: 10
});

// Create a handle manager
const handleManager = new HandleManager({
  map,
  interactiveHandles: true
});

// Create and add a handle
const handle: Handle = {
  id: 'handle1',
  type: 'move',
  shape: 'circle',
  position: { lon: 0, lat: 0 },
  color: '#3bb2d0',
  size: 1,
  cursor: 'move',
  visible: true,
  draggable: true
};

handleManager.addHandle(handle);

// Listen for events
handleManager.on('drag', (event) => {
  console.log(`Handle dragged to: ${event.position.lon}, ${event.position.lat}`);
});
```

## API Reference

### HandleManager

The main class for managing handles on a MapLibre GL map.

#### Constructor

```typescript
new HandleManager(options: HandleManagerOptions)
```

Options:
- `map`: MapLibre GL map instance
- `handleLayerId` (optional): Custom layer ID for the handles
- `handleSourceId` (optional): Custom source ID for the handles
- `defaultStyle` (optional): Default style for handles
- `interactiveHandles` (optional): Whether handles are interactive

#### Methods

- `addHandle(handle: Handle): Handle` - Add a single handle
- `addHandles(handles: Handle[]): Handle[]` - Add multiple handles
- `removeHandle(handleId: string): boolean` - Remove a handle by ID
- `updateHandle(handleId: string, newProps: Partial<Handle>): Handle | null` - Update a handle
- `getHandle(handleId: string): Handle | null` - Get a handle by ID
- `getAllHandles(): Handle[]` - Get all handles
- `setHandleVisibility(handleId: string, visible: boolean): Handle | null` - Set handle visibility
- `setHandlePosition(handleId: string, position: { lon: number; lat: number }): Handle | null` - Set handle position
- `clearHandles(): void` - Remove all handles
- `on(type: HandleEventType, listener: HandleEventListener): void` - Add event listener
- `off(type: HandleEventType, listener: HandleEventListener): void` - Remove event listener
- `destroy(): void` - Clean up resources

### Handle Interface

```typescript
interface Handle {
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
```

### Events

The following events can be listened to:
- `dragstart` - When a handle drag starts
- `drag` - When a handle is being dragged
- `dragend` - When a handle drag ends
- `click` - When a handle is clicked
- `mouseover` - When the cursor enters a handle
- `mouseout` - When the cursor leaves a handle

## Example

See the `example` directory for a full demonstration of using the library.

## License

MIT