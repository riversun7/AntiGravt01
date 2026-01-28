
const fs = require('fs');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const path = require('path');

const targetFile = process.argv[2];
// Optional args: node clean_sprite.js <path> <R> <G> <B> <tolerance>
const targetR = process.argv[3] ? parseInt(process.argv[3]) : 255;
const targetG = process.argv[4] ? parseInt(process.argv[4]) : 0;
const targetB = process.argv[5] ? parseInt(process.argv[5]) : 255;
const toleranceVal = process.argv[6] ? parseInt(process.argv[6]) : 40;

if (!targetFile) {
    console.error("Usage: node clean_sprite.js <path_to_image> [R] [G] [B] [tolerance]");
    process.exit(1);
}

const absolutePath = path.resolve(targetFile);
const fileBuffer = fs.readFileSync(absolutePath);

// Detect type
let rawData; // { width, height, data }

try {
    // Try parsing as PNG first
    const png = PNG.sync.read(fileBuffer);
    rawData = { width: png.width, height: png.height, data: png.data };
} catch (e) {
    // If not PNG, try JPEG
    try {
        const jpegData = jpeg.decode(fileBuffer, { useTArray: true });
        rawData = { width: jpegData.width, height: jpegData.height, data: jpegData.data };
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

console.log(`Targeting Background Color: R=${targetR}, G=${targetG}, B=${targetB}, Tolerance=${toleranceVal}`);

let replacedCount = 0;
const totalPixels = rawData.width * rawData.height;

for (let y = 0; y < rawData.height; y++) {
    for (let x = 0; x < rawData.width; x++) {
        const idx = (rawData.width * y + x) * 4;

        const r = rawData.data[idx];
        const g = rawData.data[idx + 1];
        const b = rawData.data[idx + 2];
        const a = rawData.data[idx + 3] !== undefined ? rawData.data[idx + 3] : 255;

        // If already transparent, preserve it
        if (a < 255) {
            newPng.data[idx] = r;
            newPng.data[idx + 1] = g;
            newPng.data[idx + 2] = b;
            newPng.data[idx + 3] = a;
            continue;
        }

        const dist = Math.sqrt(
            Math.pow(r - targetR, 2) +
            Math.pow(g - targetG, 2) +
            Math.pow(b - targetB, 2)
        );

        if (dist < toleranceVal) {
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
