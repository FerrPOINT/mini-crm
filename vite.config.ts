import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  createUiProviderDedupe,
  createUiDevCachePlugin,
  createUiFontAssetsPlugin,
} from '@pdlc/ui/build';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), createUiDevCachePlugin(), createUiFontAssetsPlugin()],
  resolve: { dedupe: createUiProviderDedupe() },
  build: { sourcemap: false },
});
