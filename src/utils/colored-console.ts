/** List of all supported codes */
const ansiEscapeCodes = {
    // Styles
    bold: 1,
    underline: 4,
    blink: 5,

    // Colors
    black: 30,
    blue: 34,
    cyan: 36,
    gray: 90,
    green: 32,
    magenta: 35,
    purple: 35,
    red: 31,
    white: 37,
    yellow: 33,

    // Background colors
    blackBg: 40,
    blueBg: 44,
    cyanBg: 46,
    grayBg: 100,
    greenBg: 42,
    magentaBg: 45,
    purpleBg: 45,
    redBg: 41,
    whiteBg: 47,
    yellowBg: 43,
};

const stdoutSupportsColors = !!(typeof process === 'object' && process.stdin && (process.stdin as any).isTTY);

/** Default export is for process.stdout. */
const styles: ChainableColorAccessors = createChainableStyles(stdoutSupportsColors, []);
export default styles;

const {
    bold, underline, blink, black, blue, cyan, gray, green, magenta, purple, red, white, yellow,
    blackBg, blueBg, cyanBg, grayBg, greenBg, magentaBg, purpleBg, redBg, whiteBg, yellowBg
} = styles;
export {
    bold, underline, blink, black, blue, cyan, gray, green, magenta, purple, red, white, yellow,
    blackBg, blueBg, cyanBg, grayBg, greenBg, magentaBg, purpleBg, redBg, whiteBg, yellowBg
};

const stylesFor = styles.for;
export { stylesFor as for };


export interface ChainableColorAccessors {
    // Styles
    readonly bold: ChainableColorTemplateTag;
    readonly underline: ChainableColorTemplateTag;
    readonly blink: ChainableColorTemplateTag;

    // Colors
    readonly black: ChainableColorTemplateTag;
    readonly blue: ChainableColorTemplateTag;
    readonly cyan: ChainableColorTemplateTag;
    readonly gray: ChainableColorTemplateTag;
    readonly green: ChainableColorTemplateTag;
    readonly magenta: ChainableColorTemplateTag;
    readonly purple: ChainableColorTemplateTag;
    readonly red: ChainableColorTemplateTag;
    readonly white: ChainableColorTemplateTag;
    readonly yellow: ChainableColorTemplateTag;

    // Background colors
    readonly blackBg: ChainableColorTemplateTag;
    readonly blueBg: ChainableColorTemplateTag;
    readonly cyanBg: ChainableColorTemplateTag;
    readonly grayBg: ChainableColorTemplateTag;
    readonly greenBg: ChainableColorTemplateTag;
    readonly magentaBg: ChainableColorTemplateTag;
    readonly purpleBg: ChainableColorTemplateTag;
    readonly redBg: ChainableColorTemplateTag;
    readonly whiteBg: ChainableColorTemplateTag;
    readonly yellowBg: ChainableColorTemplateTag;

    /** Determine color support for a different stream like process.stderr */
    for(stream: NodeJS.WritableStream): ChainableColorTemplateTag;
}

export interface ChainableColorTemplateTag extends ChainableColorAccessors {
    /**
     * Use as a function
     *
     * @example
     *     colors.blue('text')
     */
    (stringOnly: string): string;

    /**
     * Use as a template tag
     *
     * @example
     *     colors.blue `text`
     */
    (templateStringParts: TemplateStringsArray, ...params: any[]): string;
}


/**
 * Returns a function that outputs the passed text with colors (if supported by the output).
 * It has additional properties (as exported) that are chainable.
 * The returned function can be called directly or used as a tagged template function.
 */
function createChainableStyles(supportsColors: boolean, escapeCodes: number[]): ChainableColorTemplateTag {
    const colorFunction = (stringOrParts: string | TemplateStringsArray, ...params: any[]) => {
        const text = getFullText(stringOrParts, ...params);
        return supportsColors ? withAnsiSequence(escapeCodes, text) : text;
    }

    for (let prop of Object.keys(ansiEscapeCodes) as Array<keyof typeof ansiEscapeCodes>) {
        const newEscapeCode = ansiEscapeCodes[prop];
        Object.defineProperty(colorFunction, prop, {
            configurable: true,
            enumerable: true,
            get() {
                return createChainableStyles(supportsColors, [...escapeCodes, newEscapeCode]);
            }
        });
    }

    Object.defineProperty(colorFunction, 'for', {
        configurable: true,
        enumerable: false,
        writable: false,
        value: (stream: { isTTY?: boolean }): ChainableColorTemplateTag => {
            return createChainableStyles(!!stream.isTTY, escapeCodes);
        }
    });

    return colorFunction as ChainableColorTemplateTag;
}

/**
 * Combines the text of tagged templates.
 *
 * @example
 *     getFullText `a${1}b` => 'a1b'
 *     getFullText('abc') => 'abc'
 */
function getFullText(input: string | TemplateStringsArray, ...params: any[]): string {
     if (typeof input === 'string') {
         return input;
     } else {
         return input[0] + params.map((param, index) => [String(param), input[index + 1]]).join('');
     }
}

/** Formats a string using ANSI escape codes. */
function withAnsiSequence(escapeCodes: number[], text: string): string {
    return '\x1B[0;' + escapeCodes.join(';') + 'm' + text + '\x1B[0m';
}
