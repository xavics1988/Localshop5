import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, limpia la sesión de Supabase del localStorage al cargar la página
// para evitar que el navegador restaure la última sesión activa.
function devClearSessionPlugin() {
  return {
    name: 'dev-clear-session',
    transformIndexHtml(html: string) {
      const script = `<script>
        (function(){
          try {
            Object.keys(localStorage)
              .filter(k => k.startsWith('sb-'))
              .forEach(k => localStorage.removeItem(k));
          } catch(e){}
        })();
      </script>`;
      return html.replace('</head>', script + '\n</head>');
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), ...(mode === 'development' ? [devClearSessionPlugin()] : [])],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
