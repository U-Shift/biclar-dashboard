/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#001d06',
                    light: '#00330b',
                    dark: '#001204',
                },
                secondary: {
                    DEFAULT: '#ffdd00',
                    yellow: '#ffdd00',
                    cyan: '#8EA271',
                    blue: '#8EA271',
                },
            },
        },
    },
    plugins: [],
}
