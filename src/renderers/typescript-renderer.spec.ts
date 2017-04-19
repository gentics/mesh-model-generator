import { expect } from 'chai';
import { TypescriptModelRenderer, ModelFilter } from './typescript-renderer';
import { ParsedMeshRAML, ModelMap, ObjectProperty, Endpoint, PropertyDefinition, CombinedResponseInfo } from '../interfaces';
import { unindent } from '../utils/unindent';

describe('TypescriptModelRenderer', () => {

    let renderer: TypescriptModelRendererExposeProtectedProperties;
    beforeEach(() => {
        renderer = new TypescriptModelRendererExposeProtectedProperties({
            interfacePrefix: '',
            interfaceSuffix: '',
            sortInterfaces: true,
            sortKeys: true
        });
    });

    it('returns an empty string when no models are passed', async () => {
        const result = await renderer.renderAll({
            baseUri: '',
            endpoints: [],
            models: {},
            version: '0.8'
        });
        expect(result).to.equal('');
    });

    it('correctly renders simple interfaces', async () => {
        const models: ModelMap = {
            'urn:jsonschema:com:gentics:mesh:core:rest:test:CarModel': {
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:CarModel',
                properties: {
                    tires: {
                        required: true,
                        type: 'number'
                    },
                    brandName: {
                        required: true,
                        type: 'string'
                    }
                }
            }
        };

        const result = await renderer.renderAll({
            baseUri: '',
            endpoints: [],
            models,
            version: '0.8'
        });
        expect(result).to.equal(unindent `
            export interface CarModel {
                brandName: string;
                tires: number;
            }

        `);
    });

    it('renders optional properties with or without a question mark', async () => {
        const models: ModelMap = {
            'urn:jsonschema:com:gentics:mesh:core:rest:test:ExampleModel': {
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:ExampleModel',
                properties: {
                    isNeeded: {
                        required: true,
                        type: 'string'
                    },
                    isNotNeeded: {
                        required: false,
                        type: 'string'
                    }
                }
            }
        };

        const result = await renderer.renderAll({
            baseUri: '',
            endpoints: [],
            models,
            version: '0.8'
        });
        expect(result).to.equal(unindent `
            export interface ExampleModel {
                isNeeded: string;
                isNotNeeded?: string;
            }

        `);
    });

    it('renders additional properties as a string hash', async () => {
        const models: ModelMap = {
            'urn:jsonschema:com:gentics:mesh:core:rest:test:ExampleModel': {
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:ExampleModel',
                properties: {
                    hash: {
                        type: 'object',
                        required: true,
                        additionalProperties: {
                            type: 'number'
                        }
                    } as any
                }
            }
        };

        const result = await renderer.renderAll({
            baseUri: '',
            endpoints: [],
            models,
            version: '0.8'
        });
        expect(result).to.equal(unindent `
            export interface ExampleModel {
                hash: { [key: string]: number };
            }

        `);
    });

    describe('jsdoc comments', () => {

        let personModel: ObjectProperty;
        let endpoints: Endpoint[];
        beforeEach(() => {
            personModel = {
                description: 'A person model for unit tests',
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:PersonModel',
                properties: {
                    uuid: {
                        required: true,
                        type: 'string'
                    },
                    firstName: {
                        description: 'The first name of the person',
                        required: true,
                        type: 'string'
                    },
                    lastName: {
                        description: 'The last name of the person',
                        required: true,
                        type: 'string'
                    },
                    age: {
                        description: 'Age of the person in floating-point years (like 38.5)',
                        required: true,
                        type: 'number'
                    }
                }
            };

            endpoints = [
                {
                    description: 'A specific person',
                    method: 'GET',
                    url: 'person/{uuid}',
                    // requestBodySchema: personModel,
                    responses: {
                        200: {
                            description: 'Description of the 200 response',
                            responseBodySchema: personModel,
                            responseBodyExample: {
                                uuid: 'a uuid for unit tests',
                                firstName: 'John',
                                lastName: 'Doe',
                                age: 36
                            }
                        }
                    }
                }
            ];
        });

        it('renders descriptions as jsdoc comments', async () => {
            const models = { [personModel.id]: personModel };

            renderer.options.emitRequestExamples = false;
            renderer.options.emitResponseExamples = false;

            const result = await renderer.renderAll({
                baseUri: '',
                endpoints,
                models,
                version: '0.8'
            });
            expect(result).to.equal(unindent `
                /** A person model for unit tests */
                export interface PersonModel {
                    /** Age of the person in floating-point years (like 38.5) */
                    age: number;
                    /** The first name of the person */
                    firstName: string;
                    /** The last name of the person */
                    lastName: string;
                    uuid: string;
                }

            `);
        });

        it('renders examples as jsdoc comments when set in options', async () => {
            const models = { [personModel.id]: personModel };

            renderer.options.emitRequestExamples = true;
            renderer.options.emitResponseExamples = true;

            const result = await renderer.renderAll({
                baseUri: '',
                endpoints,
                models,
                version: '0.8'
            });
            expect(result).to.equal(unindent `
                /**
                 * A person model for unit tests
                 *
                 * @example
                 * {
                 *     uuid: 'a uuid for unit tests',
                 *     firstName: 'John',
                 *     lastName: 'Doe',
                 *     age: 36
                 * }
                 */
                export interface PersonModel {
                    /** Age of the person in floating-point years (like 38.5) */
                    age: number;
                    /** The first name of the person */
                    firstName: string;
                    /** The last name of the person */
                    lastName: string;
                    uuid: string;
                }

            `);
        });

        it('renders request URLs for models with no description when set in options', async () => {
            personModel.description = undefined;
            const models = { [personModel.id]: personModel };

            renderer.options.emitRequestExamples = false;
            renderer.options.emitRequestURLs = true;
            renderer.options.emitResponseExamples = false;

            const result = await renderer.renderAll({
                baseUri: '',
                endpoints,
                models,
                version: '0.8'
            });

            expect(result).to.equal(unindent `
                /**
                 * Returned for: GET person/{uuid}
                 */
                export interface PersonModel {
                    /** Age of the person in floating-point years (like 38.5) */
                    age: number;
                    /** The first name of the person */
                    firstName: string;
                    /** The last name of the person */
                    lastName: string;
                    uuid: string;
                }

            `);
        });

    });

    describe('generateJsDoc()', () => {

        it('renders single-line descriptions in one line', () => {
            const jsdoc = renderer.generateJsDoc({
                description: 'Some description'
            });
            expect(jsdoc).to.deep.equal([
                '/** Some description */'
            ]);
        });

        it('breaks multi-line descriptions into multiple lines', () => {
            const jsdoc = renderer.generateJsDoc({
                description: 'A description\nthat spans\nmultiple lines\n\nworks as expected'
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * A description',
                ' * that spans',
                ' * multiple lines',
                ' *',
                ' * works as expected',
                ' */'
            ]);
        });

        it('breaks dot-separated descriptions at sentence boundaries', () => {
            const jsdoc = renderer.generateJsDoc({
                description: 'Some model. This is mainly used for xyz. Must always be provided.'
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Some model.',
                ' * This is mainly used for xyz.',
                ' * Must always be provided.',
                ' */'
            ]);
        });

        it('outputs examples as jsdoc @example', () => {
            const jsdoc = renderer.generateJsDoc({
                description: 'Some description',
                example: unindent `
                    {
                        fruit: 'apple',
                        color: [255, 0, 0]
                    }
                `
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Some description',
                ' *',
                ' * @example',
                ' * {',
                " *     fruit: 'apple',",
                ' *     color: [255, 0, 0]',
                ' * }',
                ' */'
            ]);
        });

        it('outputs examples without a description', () => {
            const jsdoc = renderer.generateJsDoc({
                example: unindent `
                    {
                        fruit: 'apple',
                        color: [255, 0, 0]
                    }
                `
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * @example',
                ' * {',
                " *     fruit: 'apple',",
                ' *     color: [255, 0, 0]',
                ' * }',
                ' */'
            ]);
        });

        it('outputs a single matching response on a single line', () => {
            const endpoint: Endpoint = {
                description: 'Description of endpoint',
                method: 'GET',
                url: '/persons',
                responses: {
                    200: {
                        description: 'Description of 200 response'
                    }
                }
            };

            renderer.options.emitRequestURLs = true;

            const jsdoc = renderer.generateJsDoc({
                description: 'Some description',
                 responses: [
                    {
                        endpoint,
                        response: endpoint.responses[200],
                        statusCode: 200
                    }
                ]
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Some description',
                ' *',
                ' * Returned for: GET /persons',
                ' */'
            ]);
        });

        it('outputs multiple matching responses as a list', () => {
            const endpoint1: Endpoint = {
                description: 'Description of endpoint 1',
                method: 'GET',
                url: '/persons',
                responses: {
                    200: {
                        description: 'Description of 200 response 1'
                    }
                }
            };

            const endpoint2: Endpoint = {
                description: 'Description of endpoint 2',
                method: 'POST',
                url: '/persons',
                responses: {
                    201: {
                        description: 'Description of 201 response 2'
                    }
                }
            };

            renderer.options.emitRequestURLs = true;

            const jsdoc = renderer.generateJsDoc({
                description: 'Some description',
                example: unindent `
                    {
                        fruit: 'apple',
                        color: [255, 0, 0]
                    }
                `,
                responses: [
                    {
                        endpoint: endpoint1,
                        response: endpoint1.responses[200],
                        statusCode: 200
                    },
                    {
                        endpoint: endpoint2,
                        response: endpoint2.responses[201],
                        statusCode: 201
                    }
                ]
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Some description',
                ' *',
                ' * Returned for:',
                ' *     GET /persons',
                ' *     POST /persons',
                ' *',
                ' * @example',
                ' * {',
                " *     fruit: 'apple',",
                ' *     color: [255, 0, 0]',
                ' * }',
                ' */'
            ]);
        });

        it('outputs a single matching response wihtout a description', () => {
            const endpoint: Endpoint = {
                description: 'Description of endpoint',
                method: 'GET',
                url: '/persons',
                responses: {
                    200: {
                        description: 'Description of 200 response'
                    }
                }
            };

            renderer.options.emitRequestExamples = false;
            renderer.options.emitRequestURLs = true;
            renderer.options.emitResponseExamples = false;

            const jsdoc = renderer.generateJsDoc({
                 responses: [
                    {
                        endpoint,
                        response: endpoint.responses[200],
                        statusCode: 200
                    }
                ]
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Returned for: GET /persons',
                ' */'
            ]);
        });

        it('outputs multiple matching responses without a description', () => {
            const endpoint1: Endpoint = {
                description: 'Description of endpoint 1',
                method: 'GET',
                url: '/persons',
                responses: {
                    200: {
                        description: 'Description of 200 response 1'
                    }
                }
            };

            const endpoint2: Endpoint = {
                description: 'Description of endpoint 2',
                method: 'POST',
                url: '/persons',
                responses: {
                    201: {
                        description: 'Description of 201 response 2'
                    }
                }
            };

            renderer.options.emitRequestExamples = false;
            renderer.options.emitRequestURLs = true;
            renderer.options.emitResponseExamples = false;

            const jsdoc = renderer.generateJsDoc({
                responses: [
                    {
                        endpoint: endpoint1,
                        response: endpoint1.responses[200],
                        statusCode: 200
                    },
                    {
                        endpoint: endpoint2,
                        response: endpoint2.responses[201],
                        statusCode: 201
                    }
                ]
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Returned for:',
                ' *     GET /persons',
                ' *     POST /persons',
                ' */'
            ]);
        });

        it('outputs description, endpoints and example separated by newlines', () => {
            const endpoint: Endpoint = {
                description: 'Description of endpoint',
                method: 'GET',
                url: '/persons',
                responses: {
                    200: {
                        description: 'Description of 200 response'
                    }
                }
            };

            renderer.options.emitRequestURLs = true;

            const jsdoc = renderer.generateJsDoc({
                description: 'Some description',
                example: unindent `
                    {
                        fruit: 'apple',
                        color: [255, 0, 0]
                    }
                `,
                responses: [
                    {
                        endpoint,
                        response: endpoint.responses[200],
                        statusCode: 200
                    }
                ]
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * Some description',
                ' *',
                ' * Returned for: GET /persons',
                ' *',
                ' * @example',
                ' * {',
                " *     fruit: 'apple',",
                ' *     color: [255, 0, 0]',
                ' * }',
                ' */'
            ]);
        });

    });

});

class TypescriptModelRendererExposeProtectedProperties extends TypescriptModelRenderer {
    renderAll(raml: ParsedMeshRAML) {
        return super.renderAll(raml);
    }

    // Strip the file header for testing
    fileHead(version: string) {
        return Promise.resolve('');
    }

    generateInterfaces(raml: ParsedMeshRAML, filter: ModelFilter) {
        return super.generateInterfaces(raml, filter);
    }

    endpointsWithResponseType(schema: PropertyDefinition, endpoints: Endpoint[]) {
        return super.endpointsWithResponseType(schema, endpoints);
    }

    generateJsDoc({ description, example, responses }: {
                description?: string,
                example?: string
                responses?: CombinedResponseInfo[]
            }) {
        return super.generateJsDoc({ description, example, responses });
    }
}
