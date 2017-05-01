/** Wrap text at word bounds if it exceeds a maximum line length. */
export function wordWrap(line: string, maxLength: number): string[];

/** Wrap text at word bounds if it exceeds a maximum line length. */
export function wordWrap(lines: string[], maxLength: number): string[];

export function wordWrap(input: string | string[], maxLength: number): string[] {
    if (Array.isArray(input)) {
        return input.reduce<string[]>((result, line) =>
            result.concat(wordWrap(line, maxLength)), []);
    } else if (input.indexOf('\n') >= 0) {
        return wordWrap(input.split('\n'), maxLength);
    }

    if (!maxLength || input.length < maxLength) {
        return [input];
    }

    const regex = /([\s\t]*)([^\s\t]+)/g;

    let length = 0;
    let currentLine: string[] = [];
    const lines: string[] = [];

    let match: RegExpExecArray | null;
    while (match = regex.exec(input)) {
        let [, space, word] = match;
        if (length && length + space.length + word.length > maxLength) {
            lines.push(currentLine.join(''));
            currentLine = [];
            length = 0;
        }

        if (currentLine.length) {
            currentLine.push(space, word);
            length += space.length + word.length;
        } else {
            currentLine.push(word);
            length += word.length;
        }
    }

    if (currentLine.length) {
        lines.push(currentLine.join(''));
    }

    return lines;
}


