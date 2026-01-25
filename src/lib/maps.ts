export interface Coordinates {
    lat: number;
    lng: number;
}

/**
 * Calculates distance between two coordinates in Kilometers using Haversine formula
 */
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(coord2.lat - coord1.lat);
    const dLon = deg2rad(coord2.lng - coord1.lng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(coord1.lat)) * Math.cos(deg2rad(coord2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
};

export const getCurrentLocation = (): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
        } else {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                }
            );
        }
    });
};

/**
 * Parses location data which might be a PostGIS string "POINT(x y)" or an object.
 */
export const parseLocation = (location: any): Coordinates | null => {
    if (!location) return null;

    // Case 1: Already an object
    if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
        return { lat: Number(location.lat), lng: Number(location.lng) };
    }

    // Case 2: PostGIS String "POINT(lng lat)" or WKB Hex
    if (typeof location === 'string') {
        // A) WKT "POINT(x y)"
        if (location.startsWith('POINT')) {
            try {
                const content = location.replace('POINT(', '').replace(')', '');
                const [lng, lat] = content.split(' ').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
            } catch (e) {
                console.error('Failed to parse WKT:', location, e);
            }
        }

        // B) WKB Hex String (e.g. 0101000020E6100000...)
        // We look for standard Point(0101) handling.
        if (location.length >= 50 && /^[0-9A-Fa-f]+$/.test(location)) {
            try {
                // Parse Doubles from Hex
                // X (lng) starts at byte 9 (hex chars 18-34)
                // Y (lat) starts at byte 17 (hex chars 34-50)
                const hexToDouble = (hex: string) => {
                    const bytes = new Uint8Array(8);
                    for (let i = 0; i < 8; i++) {
                        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
                    }
                    const view = new DataView(bytes.buffer);
                    return view.getFloat64(0, true); // Little endian
                };

                // Simple check for Little Endian Point with SRID (01 01 00 00 20 ...)
                if (location.substring(0, 10).toUpperCase() === '0101000020') {
                    const lng = hexToDouble(location.substring(18, 34));
                    const lat = hexToDouble(location.substring(34, 50));
                    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
                }
            } catch (e) {
                console.warn('Failed to parse WKB:', location, e);
            }
        }
    }

    // Case 3: GeoJSON Object { type: "Point", coordinates: [lng, lat] }
    if (typeof location === 'object' && location?.type === 'Point' && Array.isArray(location.coordinates)) {
        const [lng, lat] = location.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat: Number(lat), lng: Number(lng) };
        }
    }

    return null;
};
