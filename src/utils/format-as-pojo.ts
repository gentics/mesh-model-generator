/**
 * Format a JSON string as a JavaScript value
 *
 * @example
 *     formatJsonAsPOJO('{"a":"text", "b": 15"})
 *     // => '{\n    a: 'text',\n    b: 15\n}'
 */
export function formatJsonAsPOJO(json: string, indentation = '    '): string {
    return formatValueAsPOJO(JSON.parse(json));
}

/**
 * Format a value as its JavaScript representation.
 *
 * Not safe to use on cyclic objects.
 *
 * @example
 *     formatJsonAsPOJO('{"a":"text", "b": 15"})
 *     // => '{\n    a: 'text',\n    b: 15\n}'
 */
export function formatValueAsPOJO(value: any, indentation = '    '): string {
    const indent = (input: string) => input.split('\n').join('\n' + indentation);

    if (value === null) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            if (Number.isNaN(value)) {
                return 'NaN';
            } else if (value === 1/0) {
                return 'Infinity';
            } else if (value === -1/0) {
                return '-Infinity';
            } else {
                return JSON.stringify(value);
            }
        case 'string':
            const jsonString = JSON.stringify(value).replace(/'/g, '\\\'');
            return '\'' + jsonString.substr(1, jsonString.length - 2) + '\'';
        case 'object':
            if (Array.isArray(value)) {
                if (!value.length) {
                    return '[]';
                }
                return '[\n    ' + value.map(v =>
                    indent(formatValueAsPOJO(v))
                    ).join(',\n' + indentation) + '\n]';
            } else {
                let keys = Object.keys(value);
                if (keys.length === 0) {
                    return '{ }';
                }
                keys = keys.map(key => formatAsObjectKey(key) + ': ' + indent(formatValueAsPOJO(value[key])));
                return '{\n    ' + keys.join(',\n    ') + '\n}';
            }
        case 'undefined':
            return 'undefined';

        default:
            throw new Error('unhandled type ' + typeof value);
    }
}

/**
 * Formats a string as a JavaScript object key, returns non-key-safe values as a string.
 *
 * @example
 *     "abc" => "abc"
 *     "some key" => "'some key'"
 *     "a.b" => "'a.b'"
 */
export function formatAsObjectKey(key: string): string {
    if (/^[a-zA-Z$_][a-zA-Z0-9$_]*$/.test(key)) {
        return key;
    } else {
        let escaped = key.replace(/([\\'])/g, '\\$1');
        escaped = escaped.replace(/\n/g, '\\n');
        escaped = escaped.replace(/\r/g, '\\r');
        escaped = escaped.replace(/\t/g, '\\t');
        return `'${escaped}'`;
    }
}