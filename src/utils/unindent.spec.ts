import { expect } from 'chai';
import { unindent } from './unindent';

describe('unindent', () => {

    it('returns single-line strings unchanged', () => {
        expect(unindent `a b c`).to.equal('a b c');
        expect(unindent ``).to.equal('');
    });

    it('strips leading whitespace depending on the first indented line', () => {
        expect(unindent `
            a
            b
            c
        `).to.equal('a\nb\nc');
        expect(unindent `
            a
                b
            c
        `).to.equal('a\n    b\nc');
    });

    it('removes only the first leading newline', () => {
        expect(unindent `

            two newlines
        `).to.equal('\ntwo newlines');
        expect(unindent `


            three newlines
        `).to.equal('\n\nthree newlines');
    });

    it('removes only the first trailing newline', () => {
        expect(unindent `
            two newlines

        `).to.equal('two newlines\n');
        expect(unindent `
            three newlines


        `).to.equal('three newlines\n\n');
    });

});
