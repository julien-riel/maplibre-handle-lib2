import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { HandleManager, Handle } from '../../src';
import * as turf from '@turf/turf';

// Initialize MapLibre GL map
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'osm': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors'
            }
        },
        layers: [
            {
                id: 'osm',
                type: 'raster',
                source: 'osm',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    },
    center: [2.3522, 48.8566], // Paris
    zoom: 12
});

// Initialize our handles manager
let handleManager: HandleManager;

// Generate a unique ID for handles
function generateId(): string {
    return 'handle-' + Math.random().toString(36).substring(2, 9);
}

// Get a random position near the center of the map
function getRandomPosition() {
    const center = map.getCenter();
    const randomLon = center.lng + (Math.random() - 0.5) * 0.05;
    const randomLat = center.lat + (Math.random() - 0.5) * 0.05;
    return { lon: randomLon, lat: randomLat };
}

// Create a handle with the specified type
function createHandle(type: Handle['type'], shape: Handle['shape']): Handle {
    return {
        id: generateId(),
        type,
        shape,
        position: getRandomPosition(),
        color: getColorForType(type),
        size: 1,
        cursor: getCursorForType(type),
        visible: true,
        draggable: true,
        constraints: getConstraintsForType(type)
    };
}

// Get a color based on handle type
function getColorForType(type: Handle['type']): string {
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

// Get a cursor type based on handle type
function getCursorForType(type: Handle['type']): string {
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

// Get constraints based on handle type
function getConstraintsForType(type: Handle['type']): Handle['constraints'] {
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

// Wait for the map to load before initializing the handle manager
map.on('load', () => {
    // Load handle shape images
    const shapes: Handle['shape'][] = ['square', 'circle', 'diamond', 'triangle'];
    shapes.forEach(shape => {
        createShapeImage(map, shape);
    });

    // Initialize the handle manager
    handleManager = new HandleManager({
        map,
        interactiveHandles: true
    });

    // Add event listeners to demonstration buttons
    document.getElementById('add-resize-handle')?.addEventListener('click', () => {
        handleManager.addHandle(createHandle('resize', 'square'));
    });

    document.getElementById('add-rotate-handle')?.addEventListener('click', () => {
        handleManager.addHandle(createHandle('rotate', 'circle'));
    });

    document.getElementById('add-move-handle')?.addEventListener('click', () => {
        handleManager.addHandle(createHandle('move', 'circle'));
    });

    document.getElementById('add-curve-handle')?.addEventListener('click', () => {
        handleManager.addHandle(createHandle('curve', 'diamond'));
    });

    document.getElementById('add-label-handle')?.addEventListener('click', () => {
        handleManager.addHandle(createHandle('label', 'square'));
    });

    document.getElementById('add-snap-handle')?.addEventListener('click', () => {
        handleManager.addHandle(createHandle('snap', 'triangle'));
    });

    document.getElementById('clear-handles')?.addEventListener('click', () => {
        handleManager.clearHandles();
    });

    // Set up event listeners for handle interactions
    handleManager.on('dragstart', (event) => {
        console.log(`Handle ${event.handle.id} dragstart at ${event.position.lon}, ${event.position.lat}`);
    });

    handleManager.on('drag', (event) => {
        console.log(`Handle ${event.handle.id} drag at ${event.position.lon}, ${event.position.lat}`);
    });

    handleManager.on('dragend', (event) => {
        console.log(`Handle ${event.handle.id} dragend at ${event.position.lon}, ${event.position.lat}`);
    });

    handleManager.on('click', (event) => {
        console.log(`Handle ${event.handle.id} clicked at ${event.position.lon}, ${event.position.lat}`);
    });
});

// Create handle shape images
function createShapeImage(map: maplibregl.Map, shape: Handle['shape']): void {
    const size = 64;
    const center = size / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    // Draw shape
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    switch (shape) {
        case 'square':
            const squareSize = size * 0.7;
            const squareOffset = (size - squareSize) / 2;
            ctx.beginPath();
            ctx.rect(squareOffset, squareOffset, squareSize, squareSize);
            ctx.fill();
            ctx.stroke();
            break;

        case 'circle':
            ctx.beginPath();
            ctx.arc(center, center, size * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

        case 'diamond':
            ctx.beginPath();
            ctx.moveTo(center, center - size * 0.35);
            ctx.lineTo(center + size * 0.35, center);
            ctx.lineTo(center, center + size * 0.35);
            ctx.lineTo(center - size * 0.35, center);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;

        case 'triangle':
            ctx.beginPath();
            ctx.moveTo(center, center - size * 0.35);
            ctx.lineTo(center + size * 0.3, center + size * 0.25);
            ctx.lineTo(center - size * 0.3, center + size * 0.25);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
    }

    const imageData = ctx.getImageData(0, 0, size, size);

    // Create an array with RGBA values (required by MapLibre)
    const data = new Uint8Array(size * size * 4);

    // Copy pixel data
    for (let i = 0; i < imageData.data.length; i++) {
        data[i] = imageData.data[i];
    }

    // Add the image to the map
    map.addImage(shape, { width: size, height: size, data: data });
}