import { expect } from 'chai';
import { MeshRamlParser } from './parser';
import { ModelMap, ResponseMapYaml, PropertyDefinition, Endpoint, ParsedMeshRAML, RequestSchemaInRAML,
    ObjectProperty, PrimitiveProperty, ArrayProperty, UrlParameterMap } from './interfaces';


describe('MeshRamlParser', () => {

    let parser: MeshRamlParserExposeProtectedProperties;
    beforeEach(() => {
        parser = new MeshRamlParser() as MeshRamlParserExposeProtectedProperties;
    });

    describe('parseRAML', () => {

        it('parses a passed RAML string and calls findModelsAndEndpoints', async () => {
            parser.parseYamlToObject = async (yaml) => {
                expect(yaml).to.equal('raml to parse');
                return { 'parsed yaml': true };
            };
            parser.findModelsAndEndpoints = async (apiRaml) => {
                expect(apiRaml).to.deep.equal({ 'parsed yaml': true });
                return {
                    endpoints: [],
                    models: { expectedResult: true } as any
                };
            };

            const result = await parser.parseRAML('raml to parse')
            expect(result.models).to.deep.equal({ expectedResult: true });
        });

        it('calls findModelsAndEndpoints when passed an object without parsing it', async () => {
            let called = false;
            parser.parseYamlToObject = async (yaml) => {
                throw new Error('Tried to parse object like a string');
            };
            parser.findModelsAndEndpoints = async (apiRaml) => {
                expect(apiRaml).to.deep.equal({ 'parsed yaml': true });
                called = true;
                return { };
            };

            const result = await parser.parseRAML({ 'parsed yaml': true })
            expect(called).to.be.true;
        });

    });

    describe('findModelsAndEndpoints', () => {

        it('searches endpoints and calls traverseRequest for them', async () => {
            const exampleRaml = {
                '/users': {
                    displayName: '/users',
                    description: 'description of users',
                    '/': {
                        post: {
                            'example endpoint': true
                        }
                    }
                }
            };

            parser.traverseRequest = async (reqRaml, methodName, url, urlParams, models) => {
                expect(reqRaml).to.deep.equal({ 'example endpoint': true });
                expect(methodName).to.equal('post');
                expect(url).to.equal('/users');
                expect(models).to.deep.equal({ });

                return {
                    description: 'description of users',
                    method: 'POST',
                    responses: {
                        201: {
                            description: 'description of user 201'
                        }
                    },
                    url: '/users'
                };
            };

            const result = await parser.findModelsAndEndpoints(exampleRaml);
            expect(result.endpoints[0]).to.deep.equal({
                description: 'description of users',
                method: 'POST',
                responses: {
                    201: {
                        description: 'description of user 201'
                    }
                },
                url: '/users'
            });
        });

        it('returns the models added in traverseRequest', async () => {
            const exampleRaml = {
                '/users': {
                    displayName: '/users',
                    description: 'description of users',
                    '/': {
                        post: {
                            'example endpoint': true
                        }
                    }
                }
            };

            parser.traverseRequest = async (reqRaml, methodName, url, urlParams, models) => {
                models['example'] = {
                    description: 'example for unit test',
                    type: 'number'
                };
                return { };
            };

            const result = await parser.findModelsAndEndpoints(exampleRaml);
            expect(result.models).to.deep.equal({
                example: {
                    description: 'example for unit test',
                    type: 'number'
                }
            });
        });

        it('collapses leading slashes', async () => {
            const exampleRaml = {
                '/': {
                    '/{project}': {
                        uriParameters: {
                            project: {
                                type: 'string',
                                required: true
                            }
                        },
                        get: {
                            description: 'description of projects endpoint',
                            responses: {
                                200: {
                                    body: {
                                        'application/json': {
                                            schema: JSON.stringify({
                                                type: 'object',
                                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:project:ProjectResponse',
                                                properties: {
                                                    someProp: {
                                                        type: 'string',
                                                        required: true,
                                                        description: 'Description of someProp'
                                                    }
                                                }
                                            }),
                                            example: JSON.stringify({
                                                someProp: 'abc'
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };

            const result = await parser.findModelsAndEndpoints(exampleRaml);
            expect(result.endpoints).to.have.lengthOf(1);
            expect(result.endpoints[0].url).to.equal('/{project}');
            expect(result.endpoints[0].url).not.to.equal('//{project}');
        });

        it('removes trailing slashes', async () => {
            const exampleRaml = {
                '/{project}': {
                    '/': {
                        uriParameters: {
                            project: {
                                type: 'string',
                                required: true
                            }
                        },
                        get: {
                            description: 'description of projects endpoint',
                            responses: {
                                200: {
                                    body: {
                                        'application/json': {
                                            schema: JSON.stringify({
                                                type: 'object',
                                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:project:ProjectResponse',
                                                properties: {
                                                    someProp: {
                                                        type: 'string',
                                                        required: true,
                                                        description: 'Description of someProp'
                                                    }
                                                }
                                            }),
                                            example: JSON.stringify({
                                                someProp: 'abc'
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };

            const result = await parser.findModelsAndEndpoints(exampleRaml);
            expect(result.endpoints).to.have.lengthOf(1);
            expect(result.endpoints[0].url).to.equal('/{project}');
            expect(result.endpoints[0].url).not.to.equal('/{project}/');
        });

        it('combines uriParameters of parent and child route', async () => {
            const exampleRaml = {
                '/': {
                    '/{project}': {
                        uriParameters: {
                            project: {
                                description: 'Description of project',
                                type: 'string',
                                required: true
                            }
                        },
                        get: {
                            responses: {
                                200: {
                                    body: {
                                        'application/json': {
                                            schema: JSON.stringify({
                                                type: 'object',
                                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:project:ProjectResponse',
                                                properties: { }
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '/{project}/nodes': {
                        get: {
                            responses: {
                                200: {
                                    body: {
                                        'application/json': {
                                            schema: JSON.stringify({
                                                type: 'object',
                                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:project:NodeListResponse',
                                                properties: { }
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };

            const result = await parser.findModelsAndEndpoints(exampleRaml);
            expect(result.endpoints).to.have.lengthOf(2);

            expect(result.endpoints[0].url).to.equal('/{project}');
            expect(result.endpoints[1].url).to.equal('/{project}/nodes');
            expect(result.endpoints[1].urlParameters).to.deep.equal({
                project: {
                    description: 'Description of project',
                    type: 'string',
                    required: true
                }
            });
        });

    });

    describe('traverseRequest', () => {

        let exampleRequestRaml: RequestSchemaInRAML;

        beforeEach(() => {
            exampleRequestRaml = {
                description: 'create user',
                body: {
                    'application/json': {
                        schema: JSON.stringify({
                            type: 'object',
                            id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserCreateRequest',
                            properties: {
                                firstname: {
                                    type: 'string',
                                    description: 'description for firstname'
                                }
                            }
                        }),
                        example: '{"firstname":"John Doe"}'
                    }
                },
                responses: {
                    201: {
                        description: 'description of 201 response',
                        body: {
                            'application/json': {
                                schema: JSON.stringify({
                                    type: 'object',
                                    id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse',
                                    properties: {
                                        uuid: {
                                            type: 'string',
                                            required: true,
                                            description: 'description of uuid'
                                        }
                                    }
                                }),
                                example: '{"uuid":"some-uuid-for-testing"}'
                            }
                        }
                    }
                }
            };
        });

        it('calls traverseResponseSchemas for all responses', async () => {
            const modelMap = { };

            parser.traverseResponseSchemas = async (responseMap, models) => {
                expect(responseMap).to.deep.equal({
                    201: {
                        description: 'description of 201 response',
                        body: {
                            'application/json': {
                                schema: JSON.stringify({
                                    type: 'object',
                                    id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse',
                                    properties: {
                                        uuid: {
                                            type: 'string',
                                            required: true,
                                            description: 'description of uuid'
                                        }
                                    }
                                }),
                                example: '{"uuid":"some-uuid-for-testing"}'
                            }
                        }
                    }
                } as ResponseMapYaml);
                expect(models).to.equal(modelMap);
                return { 201: { parsedExampleResponse: true } as any };
            };

            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, modelMap);
            expect(result.responses).to.deep.equal({ 201: { parsedExampleResponse: true } });
        });

        it('copies relevant properties to the result object', async () => {
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, {});
            expect(result.description).to.equal('create user');
            expect(result.url).to.equal('/users');
        });

        it('uppercases the request method', async () => {
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, {});
            expect(result.method).to.equal('POST');
        });

        it('parses the query parameter models', async () => {
            exampleRequestRaml.queryParameters = {
                lang: {
                    description: 'description of lang',
                    example: 'en',
                    repeat: false,
                    required: false,
                    type: 'string'
                }
            };
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, {});
            expect(result.queryParameters).to.deep.equal({
                lang: {
                    description: 'description of lang',
                    example: 'en',
                    repeat: false,
                    required: false,
                    type: 'string'
                }
            });
        });

        it('adds the passed url parameters', async () => {
            const urlParameters: UrlParameterMap = {
                lang: {
                    description: 'description of lang',
                    example: 'en',
                    repeat: false,
                    required: false,
                    type: 'string'
                }
            };
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', urlParameters, {});
            expect(result.urlParameters).to.deep.equal({
                lang: {
                    description: 'description of lang',
                    example: 'en',
                    repeat: false,
                    required: false,
                    type: 'string'
                }
            });
        });

        it('adds the request schema from the RAML', async () => {
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, {});
            expect(result.requestBodySchema).to.deep.equal({
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserCreateRequest',
                properties: {
                    firstname: {
                        type: 'string',
                        description: 'description for firstname'
                    }
                }
            });
        });

        it('adds the request body example from the RAML', async () => {
            exampleRequestRaml.body['application/json'].example = '{"firstname":"John Doe"}';
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, {});
            expect(result.requestBodyExample).to.deep.equal({ firstname: 'John Doe' });
        });

        it('adds the parsed models to the model hash via normalizeSchema', async () => {
            const models = {};
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', undefined, models);
            expect(models).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:UserCreateRequest');
            expect(models).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse');
        });

    });

    describe('traverseResponseSchemas', () => {

        let exampleResponseMap: ResponseMapYaml;
        beforeEach(() => {
            exampleResponseMap = {
                201: {
                    description: 'description of 201',
                    body: {
                        'application/json': {
                            schema: JSON.stringify({
                                type: 'object',
                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse',
                                properties: {
                                    uuid: {
                                        type: 'string',
                                        required: true,
                                        description: 'description of uuid'
                                    }
                                }
                            }),
                            example: '{"uuid":"some-uuid-for-testing"}'
                        }
                    }
                },
                202: {
                    description: 'description of 202',
                    body: {
                        'application/json': {
                            schema: JSON.stringify({
                                type: 'object',
                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:MessageResponse',
                                properties: {
                                    message: {
                                        type: 'string',
                                        required: true,
                                        description: 'description of message'
                                    }
                                }
                            }),
                            example: '{"message":"no changes, already existed"}'
                        }
                    }
                }
            };
        });

        it('calls normalizeSchema for every schema model', async () => {
            const calledWith: PropertyDefinition[] = [];
            const exampleModels = {};

            parser.normalizeSchema = async (schema, models) => {
                calledWith.push(schema);
                expect(models).to.equal(exampleModels);
                return schema;
            };

            const result = await parser.traverseResponseSchemas(exampleResponseMap, exampleModels);
            expect(calledWith).to.have.lengthOf(2);
            expect(calledWith[0]).to.deep.equal({
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse',
                properties: {
                    uuid: {
                        type: 'string',
                        required: true,
                        description: 'description of uuid'
                    }
                }
            });
            expect(calledWith[1]).to.deep.equal({
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:MessageResponse',
                properties: {
                    message: {
                        type: 'string',
                        required: true,
                        description: 'description of message'
                    }
                }
            });

            expect(result).to.have.property('201');
            expect(result).to.have.property('202');
        });

        it('copies the description of responses', async () => {
            const result = await parser.traverseResponseSchemas(exampleResponseMap, {});
            expect(result[201].description).to.equal('description of 201');
            expect(result[202].description).to.equal('description of 202');
        });

        it('adds the parsed response body schema', async () => {
            const result = await parser.traverseResponseSchemas(exampleResponseMap, {});
            expect(result[201].responseBodySchema).to.deep.equal({
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse',
                properties: {
                    uuid: {
                        type: 'string',
                        required: true,
                        description: 'description of uuid'
                    }
                }
            });
            expect(result[202].responseBodySchema).to.deep.equal({
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:MessageResponse',
                properties: {
                    message: {
                        type: 'string',
                        required: true,
                        description: 'description of message'
                    }
                }
            });
        });

        it('adds the parsed response body examples', async () => {
            const result = await parser.traverseResponseSchemas(exampleResponseMap, {});
            expect(result[201].responseBodyExample).to.deep.equal({
                uuid: 'some-uuid-for-testing'
            });
            expect(result[202].responseBodyExample).to.deep.equal({
                message: 'no changes, already existed'
            });
        });

        it('adds the parsed models to the model hash via normalizeSchema', async () => {
            const models = {};
            const result = await parser.traverseResponseSchemas(exampleResponseMap, models);
            expect(models).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:MessageResponse');
            expect(models).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse');
        });

        it('works for body-less 204 responses', async () => {
            exampleResponseMap = {
                204: {
                    description: 'description of 204'
                }
            } as any;

            const models = {};
            const result = await parser.traverseResponseSchemas(exampleResponseMap, models);
            expect(result).to.have.key('204');
            expect(result[204]).to.have.property('description').which.equals('description of 204');
        });

    });

    describe('normalizeSchema', () => {

        let exampleModel: ObjectProperty;
        let nestedExampleModel: ObjectProperty;
        let numberModel: PrimitiveProperty;
        let arrayModel: ArrayProperty;
        beforeEach(() => {
            exampleModel = {
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse',
                properties: {
                    uuid: {
                        type: 'string',
                        required: true,
                        description: 'description of uuid'
                    }
                }
            };
            nestedExampleModel = {
                type: 'object',
                id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:NestedExample1',
                properties: {
                    secondLevel: {
                        type: 'object',
                        id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:NestedExample2',
                        properties: {
                            thirdLevel: {
                                type: 'object',
                                id: 'urn:jsonschema:com:gentics:mesh:core:rest:test:NestedExample3',
                                properties: {
                                    fourthLevel: {
                                        type: 'string'
                                    }
                                }
                            }
                        }
                    }
                }
            };
            numberModel = {
                type: 'number',
                description: 'a number',
                required: true
            };
            arrayModel = {
                type: 'array',
                required: true,
                items: {
                    type: 'object',
                    id: 'urn:jsonschema:com:gentics:mesh:core:rest:group:GroupReference',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'description of name'
                        }
                    }
                }
            }
        });

        it('returns the passed model', async () => {
            const result = await parser.normalizeSchema(exampleModel, {});
            expect(result).to.deep.equal(exampleModel);

            const secondResult = await parser.normalizeSchema(numberModel, {});
            expect(secondResult).to.deep.equal(numberModel);
        });

        it('returns the previously stored model reference if the model was already processed', async () => {
            const modelMap = { [exampleModel.id]: exampleModel };
            const result = await parser.normalizeSchema(exampleModel, {});
            const clone = { ...exampleModel };
            expect(result).to.equal(exampleModel);
            expect(result).not.to.equal(clone);
        });

        it('stores a flat object schema in the passed model map', async () => {
            const modelMap = {};
            const result = await parser.normalizeSchema(exampleModel, modelMap);
            expect(modelMap)
                .to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse')
                .which.deep.equals(exampleModel);
        });

        it('traverses properties of object schemas and stores nested models in the passed model map', async () => {
            const modelMap = {};
            const result = await parser.normalizeSchema(nestedExampleModel, modelMap);
            expect(result).to.deep.equal(nestedExampleModel);
            expect(modelMap).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:test:NestedExample1');
            expect(modelMap).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:test:NestedExample2');
            expect(modelMap).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:test:NestedExample3');
        });

        it('traverses array schemas and stores nested models in the passed model map', async () => {
            const modelMap = {};
            const result = await parser.normalizeSchema(arrayModel, modelMap);
            expect(result).to.deep.equal(arrayModel);
            expect(modelMap).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:group:GroupReference');
        });

        it('does not store non-object schemas in the passed model map', async () => {
            const modelMap = {};
            const result = await parser.normalizeSchema(numberModel, modelMap);
            expect(modelMap).to.deep.equal({});
        });

    });

});

class MeshRamlParserExposeProtectedProperties extends MeshRamlParser {
    public parseYamlToObject(yaml: string) {
        return super.parseYamlToObject(yaml);
    }

    public findModelsAndEndpoints(apiRaml: any) {
        return super.findModelsAndEndpoints(apiRaml);
    }

    public traverseRequest(reqRaml: any, methodName: string, url: string, urlParams: UrlParameterMap | undefined, models: ModelMap) {
        return super.traverseRequest(reqRaml, methodName, url, urlParams, models);
    }

    public traverseResponseSchemas(responseMap: ResponseMapYaml, models: ModelMap) {
        return super.traverseResponseSchemas(responseMap, models);
    }

    public normalizeSchema(schema: PropertyDefinition, models: ModelMap) {
        return super.normalizeSchema(schema, models);
    }
}

