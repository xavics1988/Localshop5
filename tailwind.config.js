/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./screens/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'primary': '#c29b88',          // Color principal (marrón suave/tierra)
                'mustard': '#d4b4a3',          // Mostaza suave
                'olive': '#a67c68',            // Oliva/marrón oscuro
                'background-light': '#f8f9fa', // Fondo claro
                'background-dark': '#1c1816',  // Fondo oscuro
                'text-light': '#6B7785',       // Texto principal claro
                'text-dark': '#F0F2F4',        // Texto principal oscuro
                'text-subtle-light': '#8E8E93',// Texto sutil claro
                'text-subtle-dark': '#94a3b8', // Texto sutil oscuro
                'border-light': '#f1f5f9',     // Bordes claros
                'border-dark': '#2d2d2d',      // Bordes oscuros
                'accent-light': '#ffffff',     // Acento claro
                'accent-dark': '#252525',      // Acento oscuro
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
                display: ['Inter', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            }
        }
    },
    plugins: [],
    darkMode: 'class',
}
