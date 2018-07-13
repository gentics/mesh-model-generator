import { Endpoint } from "../interfaces";

/**
 * Helper function to unindent tagged strings in TypeScript code.
 *
 * @example
 *     const str = unindent `
 *         Some text
 *             which is multiline
 *         but the whole string is indented
 *     `;
 *     // str equals 'Some text\n    which is multiline\nbut the whole string is indented'
 */
export function unindent(parts: TemplateStringsArray, ...params: any[]): string {
    const fullText = [parts[0]].concat(...params.map((p, i) => [String(p), parts[i + 1]])).join('');
    const match = fullText.match(/^\n*(\n[\t ]+)/);
    const indent = match ? match[1] : '\n';

    return fullText
        .split(new RegExp(indent + '|\\n'))
        .map(line => line.replace(/ +$/g, ''))
        .join('\n')
        .replace(/^\n|(?:\n| +)$/g, '');
}
