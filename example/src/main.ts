import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import {
    HandleManager,
    SelectionManager,
    ToolManager,
    SelectionTool,
    SelectionEvent
} from '../../src';

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
    zoom: 13
});

// Initialize our tool managers
let handleManager: HandleManager;
let selectionManager: SelectionManager;
let toolManager: ToolManager;

// Wait for the map to load before initializing
map.on('load', () => {
    // Add sample GeoJSON data to the map
    addSampleData();

    // Initialize the managers and tools
    initializeManagers();

    // Add event listeners to the UI controls
    setupEventListeners();
});

function addSampleData() {
    // Add some sample features for selection
    const parisFeatures: any = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Eiffel Tower Area",
                    "type": "landmark"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [2.2922, 48.8584],
                        [2.2932, 48.8584],
                        [2.2932, 48.8574],
                        [2.2922, 48.8574],
                        [2.2922, 48.8584]
                    ]]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Luxembourg Gardens",
                    "type": "park"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [2.3354, 48.8460],
                        [2.3374, 48.8460],
                        [2.3374, 48.8440],
                        [2.3354, 48.8440],
                        [2.3354, 48.8460]
                    ]]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Notre-Dame",
                    "type": "landmark"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [2.3494, 48.8530],
                        [2.3514, 48.8530],
                        [2.3514, 48.8510],
                        [2.3494, 48.8510],
                        [2.3494, 48.8530]
                    ]]
                }
            }
        ]
    };

    // Add source for features
    map.addSource('sample-features', {
        type: 'geojson',
        data: parisFeatures
    });

    // Add the features layer
    map.addLayer({
        id: 'sample-features-fill',
        type: 'fill',
        source: 'sample-features',
        paint: {
            'fill-color': '#0080ff',
            'fill-opacity': 0.5
        }
    });

    // Add outline layer
    map.addLayer({
        id: 'sample-features-line',
        type: 'line',
        source: 'sample-features',
        paint: {
            'line-color': '#0080ff',
            'line-width': 2
        }
    });
}

function initializeManagers() {
    // Initialize the handle manager (for the tools to use)
    handleManager = new HandleManager({
        map
    });

    // Initialize the selection manager
    selectionManager = new SelectionManager({
        map,
        selectionColor: '#ffffff',
        currentSelectionColor: '#ffbb00',
        previousSelectionColor: '#cccccc',
        selectionFillOpacity: 0.2,
        selectionLineWidth: 2
    });

    // Initialize the tool manager
    toolManager = new ToolManager({
        map,
        handleManager,
        selectionManager
    });

    // Create selection tool
    const selectionTool = new SelectionTool({
        map,
        handleManager,
        selectionManager,
        selectableLayers: ['sample-features-fill'],
        multiSelect: false
    });

    // Register and activate the selection tool
    toolManager.registerTool(selectionTool);
    toolManager.activateTool('selection-tool');

    // Listen for selection changes
    selectionManager.on('change', handleSelectionChange);
}

function setupEventListeners() {
    // Tool selection buttons
    const selectionToolBtn = document.getElementById('selection-tool');
    if (selectionToolBtn) {
        selectionToolBtn.addEventListener('click', () => {
            toolManager.activateTool('selection-tool');
            setActiveButton(selectionToolBtn);
        });
    }

    // Clear selection button
    const clearSelectionBtn = document.getElementById('clear-selection');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            selectionManager.clearSelection();
        });
    }
}

function setActiveButton(activeButton: HTMLElement) {
    // Remove active class from all buttons
    document.querySelectorAll('#controls button').forEach(button => {
        button.classList.remove('active');
    });

    // Add active class to the clicked button
    activeButton.classList.add('active');
}

function handleSelectionChange(event: SelectionEvent) {
    const selectionInfo = document.getElementById('selection-info');
    if (!selectionInfo) return;

    if (event.selected.length === 0) {
        selectionInfo.textContent = 'None';
    } else {
        const names = event.selected.map(feature =>
            feature.feature.properties?.name || 'Unnamed feature'
        );
        selectionInfo.textContent = names.join(', ');
    }
}