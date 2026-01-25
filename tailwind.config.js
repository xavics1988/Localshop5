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
                primary: '#C29B88', // Tono Terracota/Nude elegante
                secondary: '#A67C52', // Marrón suave
                olive: '#8A9A5B', // Verde Oliva para toques eco
                text: {
                    light: '#2D2D2D', // Gris casi negro para texto principal
                    dark: '#E0E0E0',
                    subtle: {
                        light: '#757575',
                        dark: '#9E9E9E'
                    }
                },
                background: {
                    light: '#FAFAFA', // Blanco roto
                    dark: '#121212'   // Negro profundo
                },
                surface: {
                    light: '#FFFFFF',
                    dark: '#1E1E1E'
                },
                border: {
                    light: '#E0E0E0',
                    dark: '#333333'
                },
                accent: {
                    light: '#F5F5F0', // Beige muy claro para fondos de sección
                    dark: '#1E1E1E'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Moderno y legible
                serif: ['Playfair Display', 'serif'], // Para titulares elegantes
                display: ['Outfit', 'sans-serif'] // Para UI moderna
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
        },
    },
    plugins: [],
    darkMode: 'media', // o 'class'
}
