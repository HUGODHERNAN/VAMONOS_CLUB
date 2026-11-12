window.tailwind = window.tailwind || {};
window.tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                display: ['"Archivo Black"', 'sans-serif'],
                script: ['"Pacifico"', 'cursive'],
                sans: ['"Space Grotesk"', 'sans-serif']
            },
            colors: {
                sup: {
                    cream: '#E7DEC8',
                    creamDark: '#DCD0B4',
                    green: '#063120',
                    greenLight: '#0E4A32',
                    orange: '#FA4A19',
                    orangeHover: '#E03D0F',
                    yellow: '#F5B82E',
                    plum: '#6D287A'
                }
            },
            boxShadow: {
                hard: '4px 4px 0px #063120',
                'hard-sm': '2px 2px 0px #063120',
                'hard-lg': '6px 6px 0px #063120',
                'hard-cream': '4px 4px 0px #E7DEC8',
                'hard-orange': '4px 4px 0px #FA4A19'
            }
        }
    }
};

