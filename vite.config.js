import { defineConfig } from 'vite';

export default defineConfig({
    // Root directory
    root: './',

    // Development server options
    server: {
        port: 3000,
        open: true
    },

    // Build options
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    },

    // Resolve options for pdfjs-dist worker
    optimizeDeps: {
        include: ['pdfjs-dist']
    }
});
