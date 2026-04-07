const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const START_CODE_B = 104;
const STOP_CODE = 106;

const escapeXml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function isSupportedCode128Value(value: string) {
    return /^[\x20-\x7E]+$/.test(value);
}

export function renderCode128Svg(
    value: string,
    options?: {
        moduleWidth?: number;
        height?: number;
        fontSize?: number;
        quietZone?: number;
        showText?: boolean;
    }
) {
    const cleanValue = value.trim();
    if (!cleanValue) throw new Error('Barcode kosong.');
    if (!isSupportedCode128Value(cleanValue)) throw new Error('Barcode hanya mendukung huruf/angka ASCII standar.');

    const moduleWidth = options?.moduleWidth ?? 2;
    const barHeight = options?.height ?? 60;
    const fontSize = options?.fontSize ?? 14;
    const quietZone = options?.quietZone ?? 12;
    const showText = options?.showText ?? true;

    const codes = [START_CODE_B];
    for (const char of cleanValue) {
        codes.push(char.charCodeAt(0) - 32);
    }
    const checksum = codes.reduce((sum, code, index) => (
        index === 0 ? sum + code : sum + code * index
    ), 0) % 103;
    codes.push(checksum, STOP_CODE);

    let x = quietZone;
    const bars: string[] = [];
    for (const code of codes) {
        const pattern = CODE128_PATTERNS[code];
        for (let i = 0; i < pattern.length; i += 1) {
            const width = Number(pattern[i]) * moduleWidth;
            if (i % 2 === 0) {
                bars.push(`<rect x="${x}" y="0" width="${width}" height="${barHeight}" fill="#111827" />`);
            }
            x += width;
        }
    }

    const totalWidth = x + quietZone;
    const totalHeight = barHeight + (showText ? fontSize + 16 : 0);
    const text = showText
        ? `<text x="${totalWidth / 2}" y="${barHeight + fontSize + 4}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="#111827" letter-spacing="1">${escapeXml(cleanValue)}</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Barcode ${escapeXml(cleanValue)}">${bars.join('')}${text}</svg>`;
}

export function barcodeSvgToDataUri(svg: string) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
