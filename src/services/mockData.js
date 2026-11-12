export function createInitialMockUsers() {
    return [
        {
            id: 'u1',
            name: 'Valeria R.',
            gender: 'F',
            uni: 'UTP',
            emailDomain: '@utp.edu.pe',
            rating: '4.9',
            trips: 28,
            punctuality: '98%',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            matchType: 'same',
            distanceMeters: 180,
            payment: 'YAPE / PLIN',
            departure: 'AHORA',
            sharedPercent: '100% MISMA RUTA',
            stopDistrict: 'YANAHUARA',
            stopStreet: 'Av. Ejército / Óvalo Quiñones',
            bio: 'Salgo de pabellón B hacia Av. Aviación. Podemos pedir InDrive o Uber.',
            replies: [
                '¡Hola! Dale, estoy saliendo por la puerta principal de Av. Parra 😊',
                'Perfecto, tengo mi app de InDrive lista para pedirlo apenas nos veamos.',
                'Ya te vi, estoy al costado del kiosko con mochila beige.'
            ]
        },
        {
            id: 'u2',
            name: 'Mateo G.',
            gender: 'M',
            uni: 'UNSA',
            emailDomain: '@unsa.edu.pe',
            rating: '4.8',
            trips: 15,
            punctuality: '95%',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
            matchType: 'route',
            distanceMeters: 220,
            payment: 'YAPE / PLIN',
            departure: 'AHORA',
            sharedPercent: '65% EN TU RUTA (DE PASO)',
            stopDistrict: 'YANAHUARA',
            stopStreet: 'Av. Ejército / Óvalo Quiñones',
            bio: 'Voy por toda la avenida principal y me bajo 10 cuadras antes de tu destino.',
            replies: [
                'Qué tal bro, estoy a media cuadra en el grifo. ¿Nos vemos en la esquina?',
                'De una, pedimos un Uber y te yapeo mi parte al toque.',
                'Listo, ya estoy en la esquina con polera ploma.'
            ]
        },
        {
            id: 'u3',
            name: 'Camila S.',
            gender: 'F',
            uni: 'UCSM',
            emailDomain: '@ucsm.edu.pe',
            rating: '5.0',
            trips: 41,
            punctuality: '100%',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
            matchType: 'same',
            distanceMeters: 140,
            payment: 'EFECTIVO',
            departure: 'EN 10 MIN',
            sharedPercent: '100% MISMA RUTA',
            stopDistrict: 'CERCADO',
            stopStreet: 'Av. Venezuela / Puente Grau',
            bio: 'Voy directo hacia la misma zona, prefiero dividir en efectivo o Plin.',
            replies: [
                '¡Hola! Qué coincidencia, justo iba a pedir un Uber sola.',
                'Nos vemos en la esquina iluminada frente a la farmacia, ¿te parece?',
                'Genial, ya estoy ahí.'
            ]
        }
    ];
}

