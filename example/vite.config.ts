import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    server: {
        port: 3000
    },
    resolve: {
        alias: {
            // This allows the example to import from the local library
            'maplibre-handles': resolve(__dirname, '../src')
        }
    }
});