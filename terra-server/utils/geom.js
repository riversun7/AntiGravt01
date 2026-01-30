
/**
 * Check if a point is inside a polygon (Ray Casting algorithm)
 * @param {object} point {lat, lng}
 * @param {Array} vs Array of {lat, lng} vertices
 * @returns {boolean}
 */
function isPointInPolygon(point, vs) {
    // x = lat, y = lng
    const x = point.lat, y = point.lng;

    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].lat, yi = vs[i].lng;
        const xj = vs[j].lat, yj = vs[j].lng;

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Check if a point is inside a shape defined by a collection of disjoint segments (Ray Casting)
 * @param {object} point {lat, lng}
 * @param {Array<Array<{lat, lng}>>} segments Array of [p1, p2] pairs
 * @returns {boolean}
 */
function isPointInSegments(point, segments) {
    const x = point.lat, y = point.lng;
    let inside = false;

    for (const segment of segments) {
        // Each segment is [p1, p2]
        const p1 = segment[0];
        const p2 = segment[1];

        const xi = p1.lat, yi = p1.lng;
        const xj = p2.lat, yj = p2.lng;

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

module.exports = { isPointInPolygon, isPointInSegments };
