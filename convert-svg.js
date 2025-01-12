const fs = require('fs');
const sharp = require('sharp');

async function convertSvgToPng(svgPath, pngPath, width, height) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    await sharp(Buffer.from(svg))
        .resize(width, height)
        .png()
        .toFile(pngPath);
}

async function main() {
    // Hexagon pattern
    await convertSvgToPng(
        'public/assets/hexagon-pattern.svg',
        'public/assets/hexagon-pattern.png',
        200,
        200
    );

    // Food
    await convertSvgToPng(
        'public/assets/food.svg',
        'public/assets/food.png',
        32,
        32
    );

    // Snake eyes
    await convertSvgToPng(
        'public/assets/snake-eyes.svg',
        'public/assets/snake-eyes.png',
        32,
        32
    );
}

main().catch(console.error); 