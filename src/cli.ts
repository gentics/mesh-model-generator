//
// This file is executed when the package is called from the command line:
//     $ npm install --global mesh-model-generator
//     $ mesh-model-generator api.raml -o interfaces.ts
//     $ mesh-model-generator api.raml > interfaces.ts
//

import colors from './utils/colored-console';
import { unindent } from './utils/unindent';
import { readFile, readStreamToEnd, writeFile, writeToStream } from './utils/node-core-as-promise';
import { MeshRamlParser } from './parser';
import { TypescriptModelRenderer } from './renderers/typescript-renderer';

// File was loaded from the command line, not required from another module.
const isRunFromCommandLine = require.main === module;

export class CLI {
    async generate(input: string | NodeJS.ReadableStream, output: string | NodeJS.WritableStream, verbose = false) {
        const inputData = await (typeof input === 'string' ? readFile(input) : readStreamToEnd(input));
        const logStream = verbose && (output === process.stdout) ? process.stderr : process.stdout;

        const parser = new MeshRamlParser();
        const renderer = new TypescriptModelRenderer();
        const raml = await parser.parseRAML(inputData);

        if (verbose) {
            // TODO output models
        }

        const rendered = await renderer.renderAll(raml);
        if (typeof output === 'string') {
            await writeFile(output, rendered)
        } else {
            await writeToStream(output, rendered);
        }

        if (verbose) {
            // TODO output success / failure
        }
    }

    showHelp(outputStream = process.stdout): void {
        const { gray, blue, bold } = colors.for(outputStream);
        outputStream.write(unindent `

            ${bold.white `Usage:`} mesh-model-generator ${blue `[options]`} filename

            ${bold.white `Examples:`} mesh-model-generator -i api.raml -o models.ts
                      mesh-model-generator --stdout api.raml > models.ts
                      cat api.raml | mesh-model-generator > models.ts

            Options:
              --help, -h       ${gray `Show this help.`}
              --version, -v    ${gray `Print the version.`}
              --infile, -i     ${gray `Set the path of the input file.`}
              --outfile, -o    ${gray `Set the path of the output file.`}
              --stdin, -I      ${gray `Read from standard input instead of a file.`}
              --stdout, -O     ${gray `Write to standard output instead of a file.`}
              --verbose        ${gray `Output a list of all found models.`}

        `);
    }

    showVersion(): void {
        const version = 'v' + require('../package.json').version;
        console.log(version);
    }

    /** Entry point. Parses the passed arguments and calls the appropriate method. */
    async main(args: string[]) {
        if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
            this.showHelp();
        } else if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
            this.showVersion();
        } else {
            let inFile: string | NodeJS.ReadableStream | undefined;
            let outFile: string | NodeJS.WritableStream | undefined;
            let verbose = false;

            const argc = args.length;
            let invalid = false;
            let endParsing = false;

            for (let index = 0; index < argc && !endParsing; index++) {
                const arg = args[index];
                switch (arg) {
                    case '-i': case '--infile':
                        if (inFile || index >= argc) {
                            invalid = true;
                        } else {
                            inFile = args[++index];
                        }
                        break;
                    case '-I': case '--stdin':
                        if (inFile) {
                            invalid = true;
                        } else {
                            inFile = process.stdin;
                        }
                        break;
                    case '-o': case '--outfile':
                        if (outFile || index >= argc) {
                            invalid = true;
                        } else {
                            outFile = args[++index];
                        }
                        break;
                    case '-O': case '--stdout':
                        if (outFile) {
                            invalid = true;
                        } else {
                            outFile = process.stdout;
                        }
                        break;
                    case '--verbose':
                        verbose = true;
                        break;
                    case '--':
                        endParsing = true;
                        if (index + 2 !== argc || inFile) {
                            invalid = true;
                        } else {
                            inFile = args[index + 1];
                        }
                        break;
                    default:
                        if (arg.startsWith('-') || inFile) {
                            invalid = true;
                        } else {
                            inFile = arg;
                        }
                }
            }

            if (!inFile && !(process.stdin as any).isTTY) {
                inFile = process.stdin;
            }

            if (!outFile && !(process.stdout as any).isTTY) {
                outFile = process.stdout;
            }

            if (!args.length && !inFile && !outFile) {
                // Called without arguments and not piping from/to a file
                this.showHelp();
            } else if (invalid || !inFile || !outFile) {
                // Called with invalid arguments
                this.showHelp(outFile === process.stdout ? process.stderr : process.stdout);
                if (isRunFromCommandLine) {
                    process.exitCode = 2;
                }
            } else {
                // Called with valid arguments
                return this.generate(inFile, outFile, verbose);
            }
        }
    }
}

if (isRunFromCommandLine) {
    const args = process.argv.slice(2);
    const cli = new CLI();

    cli.main(args)
        .catch(reason => {
            console.error(reason);
            process.exitCode = 1;
        });
}
