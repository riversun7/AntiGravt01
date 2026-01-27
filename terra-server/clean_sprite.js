
const fs = require('fs');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const path = require('path');

const targetFile = process.argv[2];

if (!targetFile) {
    console.error("Usage: node clean_sprite.js <path_to_image>");
    process.exit(1);
}

const absolutePath = path.resolve(targetFile);
const fileBuffer = fs.readFileSync(absolutePath);

// Detect type
let rawData; // { width, height, data }
let isJpeg = false;

try {
    // Try parsing as PNG first
    const png = PNG.sync.read(fileBuffer);
    rawData = { width: png.width, height: png.height, data: png.data };
} catch (e) {
    // If not PNG, try JPEG
    try {
        const jpegData = jpeg.decode(fileBuffer, { useTArray: true });
        rawData = { width: jpegData.width, height: jpegData.height, data: jpegData.data };
        isJpeg = true;
        console.log("Detected JPEG format. Converting to PNG...");
    } catch (e2) {
        console.error("Failed to decode image as PNG or JPEG.");
        process.exit(1);
    }
}

// Prepare output PNG
const newPng = new PNG({
    width: rawData.width,
    height: rawData.height
});

// Process pixels
// Custom Target: Magenta Background (Standard Chroma Key)
const bgR = 255;
const bgG = 0;
const bgB = 255;

console.log(`Background Color detected (Hardcoded Magenta): R=${bgR}, G=${bgG}, B=${bgB}`);

let replacedCount = 0;
const totalPixels = rawData.width * rawData.height;

for (let y = 0; y < rawData.height; y++) {
    for (let x = 0; x < rawData.width; x++) {
        const idx = (rawData.width * y + x) * 4;

        const r = rawData.data[idx];
        const g = rawData.data[idx + 1];
        const b = rawData.data[idx + 2];
        const a = rawData.data[idx + 3] !== undefined ? rawData.data[idx + 3] : 255;

        // If already transparent, keep it transparent
        if (a < 255) {
            newPng.data[idx] = r;
            newPng.data[idx + 1] = g;
            newPng.data[idx + 2] = b;
            newPng.data[idx + 3] = a;
            continue;
        }

        // Magenta is very distinct, so we use a lower tolerance
        const tolerance = 100;
        const dist = Math.sqrt(
            Math.pow(r - bgR, 2) +
            Math.pow(g - bgG, 2) +
            Math.pow(b - bgB, 2)
        );

        if (dist < tolerance) {
            newPng.data[idx] = 0;
            newPng.data[idx + 1] = 0;
            newPng.data[idx + 2] = 0;
            newPng.data[idx + 3] = 0; // Transparent
            replacedCount++;
        } else {
            newPng.data[idx] = r;
            newPng.data[idx + 1] = g;
            newPng.data[idx + 2] = b;
            newPng.data[idx + 3] = 255; // Opaque
        }
    }
}

console.log(`Processed ${totalPixels} pixels. Made ${replacedCount} pixels transparent.`);

newPng.pack().pipe(fs.createWriteStream(absolutePath))
    .on('finish', () => {
        console.log('Image processing & conversion complete.');
    });
