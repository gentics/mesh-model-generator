import { expect } from 'chai';
import { unindent } from './unindent';
import { formatAsObjectKey, formatJsonAsPOJO, formatValueAsPOJO } from './format-as-pojo';

describe('formatAsObjectKey', () => {

    it('returns JavaScript-safe property names nchanged', () => {
        for (let key of ['prop', 'a1', '_', '$']) {
            const result = formatAsObjectKey(key);
            expect(result).to.equal(key);
        }
    });

    it('escapes keys which are unsafe as property names', () => {
        expect(formatAsObjectKey('1234')).to.equal(`'1234'`);
        expect(formatAsObjectKey(`a'b`)).to.equal(`'a\\'b'`);
        expect(formatAsObjectKey(`.dot`)).to.equal(`'.dot'`);
        expect(formatAsObjectKey('multi\nline')).to.equal(`'multi\\nline'`);
        expect(formatAsObjectKey('special\rchars')).to.equal(`'special\\rchars'`);
        expect(formatAsObjectKey('white \tspace')).to.equal(`'white \\tspace'`);
    });

});

describe('formatJSONAsPOJO', () => {

    it('parses the input JSON and passes the result to formatValueAsPOJO', () => {
        const result = formatJsonAsPOJO('{"a":1,"b":"str","c":true,"d":null,"e":[]}');
        expect(result).to.equal(unindent `
            {
                a: 1,
                b: 'str',
                c: true,
                d: null,
                e: []
            }
        `);
    });

});

describe('formatValueAsPOJO', () => {

    it('formats boolean values correctly', () => {
        expect(formatValueAsPOJO(true)).to.equal('true');
        expect(formatValueAsPOJO(false)).to.equal('false');
    });

    it('formats null and undefined correctly', () => {
        expect(formatValueAsPOJO(null)).to.equal('null');
        expect(formatValueAsPOJO(undefined)).to.equal('undefined');
    });

    it('formats numeric values correctly', () => {
        expect(formatValueAsPOJO(1234)).to.equal('1234');
        expect(formatValueAsPOJO(0)).to.equal('0');
        expect(formatValueAsPOJO(1/0)).to.equal('Infinity');
        expect(formatValueAsPOJO(-1/0)).to.equal('-Infinity');
        expect(formatValueAsPOJO(Number.NaN)).to.equal('NaN');
    });

    it('formats strings correctly', () => {
        expect(formatValueAsPOJO('abc')).to.equal(`'abc'`);
        expect(formatValueAsPOJO('a"b')).to.equal(`'a\\"b'`);
        expect(formatValueAsPOJO(`a'b`)).to.equal(`'a\\'b'`);
        expect(formatValueAsPOJO('')).to.equal(`''`);
        expect(formatValueAsPOJO('\n\r')).to.equal(`'\\n\\r'`);
    });

    it('formats arrays correctly', () => {
        expect(formatValueAsPOJO([])).to.equal(`[]`);
        expect(formatValueAsPOJO([1, 2, 3])).to.equal(`[\n    1,\n    2,\n    3\n]`);
        expect(formatValueAsPOJO([1, '2', 3])).to.equal(`[\n    1,\n    '2',\n    3\n]`);
        expect(formatValueAsPOJO([null, null, null])).to.equal(`[\n    null,\n    null,\n    null\n]`);
        expect(formatValueAsPOJO([])).to.equal(`[]`);
    });

    it('formats objects correctly', () => {
        expect(formatValueAsPOJO({})).to.equal(`{ }`);
        expect(formatValueAsPOJO({ a: 1, b: '2' })).to.equal(`{\n    a: 1,\n    b: '2'\n}`);
        expect(formatValueAsPOJO({ a: undefined })).to.equal(`{\n    a: undefined\n}`);
        expect(formatValueAsPOJO({ a: { b: {} } })).to.equal(`{\n    a: {\n        b: { }\n    }\n}`);
    });

});
