import { safeLoad as loadYaml } from 'js-yaml';
import { Endpoint, ParsedMeshRAML, PropertyDefinition, ModelMap, ResponseMap, ResponseMapYaml, ObjectProperty, RequestSchemaInRAML, Response } from './interfaces';
import { formatJsonAsPOJO } from './utils/format-as-pojo';
import { unhandledCase } from './utils/unhandled-case';


const crudMethods = ['delete', 'get', 'post', 'put', 'update'];

/**
 * Parses the Gentics Mesh RAML for request and response models.
 */
export class MeshRamlParser {

    /**
     * Entry point. Parses mesh RAML from a string.
     */
    public async parseRAML(ramlString: string): Promise<ParsedMeshRAML>;

    /**
     * Entry point. Parses mesh RAML from an already-parsed RAML object.
     */
    public async parseRAML(ramlObject: object): Promise<ParsedMeshRAML>;

    public async parseRAML(raml: string | object): Promise<ParsedMeshRAML> {
        let ramlDocument: any;
        if (typeof raml === 'string') {
            ramlDocument = await this.parseYamlToObject(raml);
        } else if (typeof raml === 'object' && !!raml) {
            ramlDocument = raml;
        } else {
            throw new TypeError('Invalid input: ' + typeof raml);
        }

        const { models, endpoints } = await this.findModelsAndEndpoints(ramlDocument);
        return {
            baseUri: ramlDocument.baseUri,
            endpoints,
            models,
            version: ramlDocument.version
        };
    }

    protected async parseYamlToObject(yaml: string): Promise<Object> {
        return loadYaml(yaml);
    }

    protected async findModelsAndEndpoints(apiRaml: any) {
        const paths = Object.keys(apiRaml).filter(key => key.startsWith('/'));
        const models: { [name: string]: PropertyDefinition } = {};
        const endpoints: Endpoint[] = [];

        for (let pathName of paths) {
            const path = apiRaml[pathName];
            const childPaths = Object.keys(path).filter(key => key.startsWith('/'));

            for (let childPathName of childPaths) {
                const childPath = path[childPathName];
                const methods = Object.keys(childPath).filter(key => crudMethods.indexOf(key) >= 0);

                for (let methodName of methods) {
                    const requestSchemaRaml = childPath[methodName];
                    const url = (pathName + (childPathName === '/' ? '' : childPathName)).replace(/\/+/, '/');
                    const parsedRequest = await this.traverseRequest(requestSchemaRaml, methodName, url, models);
                    endpoints.push(parsedRequest);
                }
            }
        }

        return { endpoints, models };
    }

    async traverseRequest(requestSchema: RequestSchemaInRAML, methodName: string, url: string, models: ModelMap): Promise<Endpoint> {
        const parsedRequest: Endpoint = {
            url,
            method: methodName.toUpperCase() as any,
            queryParameters: requestSchema.queryParameters,
            description: requestSchema.description,
            responses: { }
        };

        const requestBody = requestSchema.body && requestSchema.body['application/json'];
        if (requestBody && requestBody.example) {
            parsedRequest.requestBodyExample = JSON.parse(requestBody.example);
        }
        if (requestBody && requestBody.schema) {
            const schema: PropertyDefinition = JSON.parse(requestBody.schema);
            parsedRequest.requestBodySchema = await this.normalizeSchema(schema, models);
        }

        parsedRequest.responses = await this.traverseResponseSchemas(requestSchema.responses, models);

        return parsedRequest;
    }

    async traverseResponseSchemas(responseMap: ResponseMapYaml, models: ModelMap): Promise<ResponseMap> {
        const responseTypes: ResponseMap = {};

        for (let responseCode of Object.keys(responseMap  || {})) {
            const responseYaml = responseMap[Number(responseCode)];

            let result: Response = {
                description: responseYaml.description,
                responseBodyExample: undefined,
                responseBodySchema: undefined
            };

            const responseBody = responseYaml.body && responseYaml.body['application/json'];
            if (responseBody && responseBody.example) {
                result.responseBodyExample = JSON.parse(responseBody.example);
            }
            if (responseBody && responseBody.schema) {
                const schema: PropertyDefinition = JSON.parse(responseBody.schema);
                result.responseBodySchema = await this.normalizeSchema(schema, models);
            }

            responseTypes[Number(responseCode)] = result;
        }
        return responseTypes;
    }

    /**
     * Normalizes the passed schema from the YAML input.
     * When schema was already parsed, the old reference is returned.
     * Object and array schemas are traversed recursively and stored in the passed model hash.
     */
    async normalizeSchema(schema: PropertyDefinition, modelMap: ModelMap): Promise<PropertyDefinition> {
        switch (schema.type) {
            case 'any':
            case 'boolean':
            case 'integer':
            case 'number':
            case 'string':
                return schema;

            case 'array':
                // Sometimes, the array type does not provide a "type" key. Needs to be fixed.
                let arrayType: PropertyDefinition = schema.items;
                if (!arrayType.type && (arrayType as ObjectProperty).$ref) {
                    arrayType = Object.assign({ type: 'object' }, arrayType) as PropertyDefinition;
                }
                schema.items = await this.normalizeSchema(arrayType, modelMap);
                return schema;

            case 'object':
                const id = schema.$ref || schema.id || '';
                if (id in modelMap) {
                    return modelMap[id];
                } else if (schema.id) {
                    modelMap[schema.id] = schema;
                }

                if (schema.properties) {
                    for (let key of Object.keys(schema.properties)) {
                        schema.properties[key] = await this.normalizeSchema(schema.properties[key], modelMap);
                    }
                }

                if (schema.additionalProperties) {
                    const hashType: PropertyDefinition = Object.assign({ type: 'object' }, schema.additionalProperties);
                    schema.additionalProperties = await this.normalizeSchema(hashType, modelMap);
                }

                return schema;

            default:
                return unhandledCase(schema, 'type');
        }
    }
}
