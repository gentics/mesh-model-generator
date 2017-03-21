import { expect } from 'chai';
import { CLI } from './cli';

describe('CLI', () => {

    describe('argument parsing', () => {

        let cli: CLI;
        let calls: string[] = [];
        let callArgs: any[][] = [];
        beforeEach(() => {
            cli = new CLI();

            let trackedCalls: string[] = calls = [];
            let trackedArgs: any[][] = callArgs = [];

            cli.generate = async (...args: any[]) => {
                trackedCalls.push('generate');
                trackedArgs.push(args);
            };
            cli.showHelp = (...args: any[]) => {
                trackedCalls.push('showHelp');
                trackedArgs.push(args);
            };
            cli.showVersion = (...args: any[]) => {
                trackedCalls.push('showVersion');
                trackedArgs.push(args);
            };
        });

        it('outputs the help with no arguments', async () => {
            await cli.main([]);
            expect(calls).to.deep.equal(['showHelp']);
            if (callArgs[0] && callArgs[0][0]) {
                expect(callArgs[0][0]).to.equal(process.stdout);
            }
        });

        it('-h outputs the help', async () => {
            await cli.main(['-h']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('--help outputs the help', async () => {
            await cli.main(['--help']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('-v outputs the version', async () => {
            await cli.main(['-v']);
            expect(calls).to.deep.equal(['showVersion']);
        });

        it('--version outputs the version', async () => {
            await cli.main(['--version']);
            expect(calls).to.deep.equal(['showVersion']);
        });

        it('--infile and --outfile set the input / output file', async () => {
            await cli.main(['--infile', 'api.raml', '--outfile', 'models.ts']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0]).to.deep.equal(['api.raml', 'models.ts', false]);
        });

        it('-i and -o set the input / output file', async () => {
            await cli.main(['-i', 'api.raml', '-o', 'models.ts']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0]).to.deep.equal(['api.raml', 'models.ts', false]);
        });

        it('--infile can be omitted', async () => {
            await cli.main(['api.raml', '--outfile', 'models.ts']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0]).to.deep.equal(['api.raml', 'models.ts', false]);
        });

        it('--verbose enables verbose output', async () => {
            await cli.main(['--verbose', '--infile', 'api.raml', '--outfile', 'models.ts']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0]).to.deep.equal(['api.raml', 'models.ts', true]);
        });

        it('--stdin and --stdout set the input / output', async () => {
            await cli.main(['--stdin', '--stdout']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0][0]).to.equal(process.stdin);
            expect(callArgs[0][1]).to.equal(process.stdout);
        });

        it('--stdin works alongside an output filename', async () => {
            await cli.main(['--stdin', '--outfile', 'models.ts']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0][0]).to.equal(process.stdin);
            expect(callArgs[0][1]).to.equal('models.ts');
        });

        it('--stdout works alongside an input filename', async () => {
            await cli.main(['--infile', 'api.raml', '--stdout']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0][0]).to.equal('api.raml');
            expect(callArgs[0][1]).to.equal(process.stdout);
        });

        it('-I and -O set the input / output', async () => {
            await cli.main(['-I', '-O']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0][0]).to.equal(process.stdin);
            expect(callArgs[0][1]).to.equal(process.stdout);
        });

        it('accepts "--" as argument separator', async () => {
            await cli.main(['--stdout', '--', '-somefilewithadash']);
            expect(calls).to.deep.equal(['generate']);
            expect(callArgs[0][0]).to.equal('-somefilewithadash');
            expect(callArgs[0][1]).to.equal(process.stdout);
        });

        it('outputs the help for invalid arguments (1)', async () => {
            await cli.main(['--doesnotexist']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('outputs the help for invalid arguments (2)', async () => {
            await cli.main(['--stdin', '--stdin', '--stdout', '--stdout']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('outputs the help for invalid arguments (3)', async () => {
            await cli.main(['--outfile', 'models.ts', '-somefilewithadash']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('outputs the help for invalid arguments (4)', async () => {
            await cli.main(['--infile', 'api.raml', '--outfile']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('outputs the help for invalid arguments (5)', async () => {
            await cli.main(['--outfile', 'models.ts', '--infile']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('outputs the help for invalid arguments (6)', async () => {
            await cli.main(['--infile', 'api.raml', '--stdin', '--stdout']);
            expect(calls).to.deep.equal(['showHelp']);
        });

        it('outputs the help for invalid arguments (7)', async () => {
            await cli.main(['--stdin', '--outfile', 'models.ts', '--stdout']);
            expect(calls).to.deep.equal(['showHelp']);
        });

    });

});
