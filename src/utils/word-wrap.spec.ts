import { expect } from 'chai';
import { wordWrap } from './word-wrap';


describe('wordWrap', () => {

    it('wraps a long line at word bounds (20)', () => {
        const input = 'A line that is exactly 32 characters long.';
        const output = wordWrap(input, 20);

        expect(output).to.deep.equal([
            'A line that is',
            'exactly 32',
            'characters long.'
        ]);
    });

    it('wraps a long line at word bounds (24)', () => {
        const input = 'A line that is exactly 32 characters long.';
        const output = wordWrap(input, 24);

        expect(output).to.deep.equal([
            'A line that is exactly',
            '32 characters long.'
        ]);
    });

    it('does not break the first word', () => {
        const input = 'supercalifragilisticexpialidocious';
        const output = wordWrap(input, 10);

        expect(output).to.deep.equal([
            'supercalifragilisticexpialidocious'
        ]);
    });

    it('preserves whitespace if the input is not wrapped in the whitespace', () => {
        const input = 'some words      with whitespace, which should wrap to a second line';
        const output = wordWrap(input, 35);

        expect(output).to.deep.equal([
            'some words      with whitespace,',
            'which should wrap to a second line'
        ]);
    });

    it('strips whitespace if the input is wrapped in the whitespace', () => {
        const input = 'some words      with spaces';
        const output = wordWrap(input, 12);

        expect(output).to.deep.equal([
            'some words',
            'with spaces'
        ]);
    });

    it('wraps all lines when called with an array', () => {
        const input = [
            'This is the first of multiple lines',
            'which are all passed to wordWrap()',
            'and individually wrapped.'
        ];
        const output = wordWrap(input, 25);

        expect(output).to.deep.equal([
            'This is the first of',
            'multiple lines',
            'which are all passed to',
            'wordWrap()',
            'and individually wrapped.'
        ]);
    });

});
