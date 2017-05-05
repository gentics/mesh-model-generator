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

    describe('renderAll()', () => {

        it('calls fileHead() with the api version of the passed raml', async () => {
            renderer.fileHead = (version: string) => {
                expect(version).to.equal('0.9.1');
                return Promise.resolve('File head\n');
            };
            renderer.generateEndpointList = () => Promise.resolve('Endpoint list');
            renderer.generateInterfaces = () => Promise.resolve('Model interfaces');

            const input = { version: '0.9.1' } as ParsedMeshRAML;
            const result = await renderer.renderAll(input);
            expect(result).to.equal('File head\nModel interfaces');
        });

        it('calls generateInterfaces() with the passed raml', async () => {
            const input = { } as ParsedMeshRAML;
            renderer.generateInterfaces = (raml) => {
                expect(raml).to.equal(input);
                return Promise.resolve('Model interfaces');
            };

            const result = await renderer.renderAll(input);
            expect(result).to.equal('Model interfaces');
        });

        it('calls generateEndpointList() with the passed raml if addEndpointList option is true', async () => {
            renderer.options.addEndpointList = true;
            const input = { } as ParsedMeshRAML;
            let called = false;
            renderer.generateInterfaces = (raml) => {
                expect(raml).to.equal(input);
                return Promise.resolve('Model interfaces');
            };
            renderer.generateEndpointList = (raml) => {
                called = true;
                return Promise.resolve('Endpoint list');
            };

            await renderer.renderAll(input);
            expect(called).to.be.true;
        });

        it('does not call generateEndpointList() if addEndpointList option is false', async () => {
            const input = { } as ParsedMeshRAML;
            renderer.options.addEndpointList = false;
            let called = false;
            renderer.generateInterfaces = (raml) => {
                return Promise.resolve('Model interfaces');
            };
            renderer.generateEndpointList = (raml) => {
                called = true;
                return Promise.resolve('Endpoint list');
            };

            await renderer.renderAll(input);
            expect(called).to.be.false;
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
                 * Returned for ${'`'}GET person/{uuid}${'`'}
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

    describe('generateEndpointList()', () => {

        it('outputs a hash of all endpoints and their methods', async () => {
            const input: ParsedMeshRAML = {
                baseUri: '/api/v1',
                endpoints: [
                    {
                        description: 'Read multiple groups and return a paged list response.',
                        method: 'GET',
                        url: '/groups',
                        queryParameters: {
                            perPage: {
                                description: 'Number of elements per page. Use in combination with "page".',
                                type: 'number',
                                required: false,
                                repeat: false,
                                default: '25',
                                example: '42'
                            },
                            page: {
                                description: 'Number of page to be loaded.',
                                type: 'number',
                                required: false,
                                repeat: false,
                                default: '1',
                                example: '42'
                            }
                        },
                        responses: {
                            200: {
                                description: 'List response which contains the found groups.',
                                responseBodySchema: {
                                    type: 'object',
                                    id: 'urn:jsonschema:com:gentics:mesh:core:rest:group:GroupListResponse',
                                    properties: { } // irrelevant for this test
                                }
                            }
                        }
                    },
                    {
                        description: 'Create a new group.',
                        method: 'POST',
                        url: '/groups',
                        requestBodySchema: {
                            type: 'object',
                            id: 'urn:jsonschema:com:gentics:mesh:core:rest:group:GroupCreateRequest',
                            properties: {
                                name: {
                                    type: 'string',
                                    required: true,
                                    description: 'Name of the group.'
                                }
                            }
                        },
                        requestBodyExample: '{\n"name": "New group"\n}',
                        responses: {
                            201: {
                                description: 'Created group.',
                                responseBodySchema: {
                                    type: 'object',
                                    id: 'urn:jsonschema:com:gentics:mesh:core:rest:group:GroupResponse',
                                    properties: { } // irrelevant for this test
                                }
                            }
                        }
                    }
                ],
                models: { },
                version: '0.9.1'
            };
            renderer.options.endpointInterface = 'ApiEndpoints';
            const result = await renderer.generateEndpointList(input);

            expect(result).to.equal(unindent `
                /** List of all API endpoints and their types */
                export interface ApiEndpoints {
                    GET: {
                        /** Read multiple groups and return a paged list response. */
                        '/groups': {
                            request: {
                                urlParams?: { };
                                queryParams?: {
                                    /**
                                     * Number of elements per page (default: 25). Use in combination with "page".
                                     * @example 42
                                     */
                                    perPage?: number;
                                    /**
                                     * Number of page to be loaded (default: 1).
                                     * @example 42
                                     */
                                    page?: number;
                                };
                                body?: undefined;
                            };
                            responseType: GroupListResponse;
                            responseTypes: {
                                /** List response which contains the found groups. */
                                200: GroupListResponse;
                            };
                        };
                    };
                    POST: {
                        /** Create a new group. */
                        '/groups': {
                            request: {
                                urlParams?: { };
                                queryParams?: { };
                                body: GroupCreateRequest;
                            };
                            responseType: GroupResponse;
                            responseTypes: {
                                /** Created group. */
                                201: GroupResponse;
                            };
                        };
                    };
                    PUT: { };
                    UPDATE: { };
                    DELETE: { };
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

        it('breaks multi-line descriptions into multiple comment lines', () => {
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

        it('adds default parameters at the end of the first sentence or line', () => {
            const jsdoc1 = renderer.generateJsDoc({
                description: 'Some model. This is mainly used for xyz. Must always be provided.',
                defaultValue: 15
            });
            expect(jsdoc1).to.deep.equal([
                '/** Some model (default: 15). This is mainly used for xyz. Must always be provided. */'
            ]);

            const jsdoc2 = renderer.generateJsDoc({
                description: 'Some model\nwith an unnecessary\nmultiline description.',
                defaultValue: 15
            });
            expect(jsdoc2).to.deep.equal([
                '/**',
                ' * Some model (default: 15)',
                ' * with an unnecessary',
                ' * multiline description.',
                ' */'
            ]);
        });

        it('wraps long descriptions to multiple lines at word boundaries', () => {
            const jsdoc = renderer.generateJsDoc({
                description: 'This is a very long description that should be wrapped'
                    + ' to the next line at word boundaries, instead of just being used as-is.'
            });
            expect(jsdoc).to.deep.equal([
                '/**',
                ' * This is a very long description that should be wrapped to the next line at word',
                ' * boundaries, instead of just being used as-is.',
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
                ' * Returned for `GET /persons`',
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
                ' *   - `GET /persons`',
                ' *   - `POST /persons`',
                ' *',
                ' * @example',
                ' * {',
                " *     fruit: 'apple',",
                ' *     color: [255, 0, 0]',
                ' * }',
                ' */'
            ]);
        });

        it('outputs a single matching response without a description', () => {
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
                ' * Returned for `GET /persons`',
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
                ' *   - `GET /persons`',
                ' *   - `POST /persons`',
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
                ' * Returned for `GET /persons`',
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

    describe('sortEndpointsForJsDoc()', () => {

        function toStringArray(responseList: CombinedResponseInfo[]): string[] {
            return responseList.map(res => res.endpoint.method + ' ' + res.endpoint.url);
        }

        it('sorts the passed endpoints by (method -> url)', () => {
            const input = [
                { endpoint: { method: 'POST', url: 'users/online' } } as CombinedResponseInfo,
                { endpoint: { method: 'GET', url: 'users/online' } } as CombinedResponseInfo,
                { endpoint: { method: 'DELETE', url: 'projects/{projectUuid}' } } as CombinedResponseInfo,
                { endpoint: { method: 'GET', url: 'users/offline' } } as CombinedResponseInfo,
                { endpoint: { method: 'GET', url: 'projects/{projectUuid}' } } as CombinedResponseInfo
            ];
            const sorted = renderer.sortEndpointsForJsDoc(input);
            expect(toStringArray(sorted)).to.deep.equal([
                'GET projects/{projectUuid}',
                'GET users/offline',
                'GET users/online',
                'POST users/online',
                'DELETE projects/{projectUuid}'
            ]);
        });

        it('only returns the same url with the same method once', () => {
            const input = [
                { endpoint: { method: 'GET', url: 'users/online' }, statusCode: 200 } as CombinedResponseInfo,
                { endpoint: { method: 'POST', url: 'users' }, statusCode: 201 } as CombinedResponseInfo,
                { endpoint: { method: 'POST', url: 'users' }, statusCode: 202 } as CombinedResponseInfo,
                { endpoint: { method: 'GET', url: 'users/online' }, statusCode: 204 } as CombinedResponseInfo
            ];
            const sorted = renderer.sortEndpointsForJsDoc(input);
            expect(toStringArray(sorted)).to.deep.equal([
                'GET users/online',
                'POST users'
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

    generateJsDoc({ description, example, defaultValue, responses }: {
                description?: string,
                example?: string
                defaultValue?: any,
                responses?: CombinedResponseInfo[]
            }) {
        return super.generateJsDoc({ description, example, defaultValue, responses });
    }

    sortEndpointsForJsDoc(endpoints: CombinedResponseInfo[]): CombinedResponseInfo[] {
        return super.sortEndpointsForJsDoc(endpoints);
    }
}
