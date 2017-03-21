import { expect } from 'chai';
import { MeshRamlParser } from './parser';
import { ModelMap, ResponseMapYaml, PropertyDefinition, Endpoint, ParsedMeshRAML, RequestSchemaInRAML, ObjectProperty, PrimitiveProperty, ArrayProperty } from './interfaces';


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

            parser.traverseRequest = async (reqRaml, methodName, url, models) => {
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

            parser.traverseRequest = async (reqRaml, methodName, url, models) => {
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

            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', modelMap);
            expect(result.responses).to.deep.equal({ 201: { parsedExampleResponse: true } });
        });

        it('copies relevant properties to the result object', async () => {
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', {});
            expect(result.description).to.equal('create user');
            expect(result.url).to.equal('/users');
        });

        it('uppercases the request method', async () => {
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', {});
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
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', {});
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

        it('adds the request schema from the RAML', async () => {
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', {});
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
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', {});
            expect(result.requestBodyExample).to.deep.equal({ firstname: 'John Doe' });
        });

        it('adds the parsed models to the model hash via normalizeSchema', async () => {
            const models = {};
            const result = await parser.traverseRequest(exampleRequestRaml, 'post', '/users', models);
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
                204: {
                    description: 'description of 204',
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
            expect(result).to.have.property('204');
        });

        it('copies the description of responses', async () => {
            const result = await parser.traverseResponseSchemas(exampleResponseMap, {});
            expect(result[201].description).to.equal('description of 201');
            expect(result[204].description).to.equal('description of 204');
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
            expect(result[204].responseBodySchema).to.deep.equal({
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
            expect(result[204].responseBodyExample).to.deep.equal({
                message: 'no changes, already existed'
            });
        });

        it('adds the parsed models to the model hash via normalizeSchema', async () => {
            const models = {};
            const result = await parser.traverseResponseSchemas(exampleResponseMap, models);
            expect(models).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:MessageResponse');
            expect(models).to.have.property('urn:jsonschema:com:gentics:mesh:core:rest:user:UserResponse');
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

    public traverseRequest(reqRaml: any, methodName: string, url: string, models: ModelMap) {
        return super.traverseRequest(reqRaml, methodName, url, models);
    }

    public traverseResponseSchemas(responseMap: ResponseMapYaml, models: ModelMap) {
        return super.traverseResponseSchemas(responseMap, models);
    }

    public normalizeSchema(schema: PropertyDefinition, models: ModelMap) {
        return super.normalizeSchema(schema, models);
    }
}

