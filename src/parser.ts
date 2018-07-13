import { safeLoad as loadYaml } from 'js-yaml';
import { Endpoint, FormPartMap, ModelMap, ObjectProperty, Parameter, ParsedMeshRAML, PropertyDefinition, RequestSchemaInRAML, Response, ResponseMap, ResponseMapYaml, UrlParameterMap } from './interfaces';
import { formatJsonAsPOJO } from './utils/format-as-pojo';
import { unhandledCase } from './utils/unhandled-case';


const requestMethods = ['delete', 'get', 'post', 'patch', 'put'];

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
                const methods = Object.keys(childPath).filter(key => requestMethods.indexOf(key) >= 0);

                for (let methodName of methods) {
                    const requestSchemaRaml = childPath[methodName];
                    const url = (pathName + (childPathName === '/' ? '' : childPathName)).replace(/\/+/, '/');
                    const urlParams = childPath.uriParameters;
                    const parsedRequest = await this.traverseRequest(requestSchemaRaml, methodName, url, urlParams, models);
                    endpoints.push(parsedRequest);
                }
            }
        }

        this.addMissingUriParameters(endpoints);

        return { endpoints, models };
    }

    /** For parent-child endpoints (e.g. "/{project}", "/{project}/nodes"), add the uri parameters of the parent. */
    protected addMissingUriParameters(endpoints: Endpoint[]): void {
        const endpointsByUrl: { [url: string]: Endpoint } = {};
        for (let endpoint of endpoints) {
            // only add URLs with "{parameter}"
            if (/\{[^\}]+\}/.test(endpoint.url)) {
                endpointsByUrl[endpoint.url] = endpoint;
            }
        }

        const endpointsSortedByShortToLongUrl = endpoints.slice().sort((a, b) => a.url.length - b.url.length);
        for (let endpoint of endpointsSortedByShortToLongUrl) {
            const rx = /\{([a-zA-Z0-9]+)\}/g;
            let matches: RegExpMatchArray | null;
            // find {parameters} in URL
            while ((matches = rx.exec(endpoint.url)) !== null) {
                // Name of the parameter, e.g. 'groupUuid'
                const paramName = matches[1];
                // Part of the url that leads to the parameter, e.g. '/groups/{groupUuid}'
                const urlPart = (matches.input || '').substr(0, (matches.index || 0) + matches[0].length);

                if (!endpoint.urlParameters || !endpoint.urlParameters[paramName]) {
                    // Find parameter in the parent endpoint
                    const parentEndpoint = endpointsByUrl[urlPart];
                    if (parentEndpoint && parentEndpoint.urlParameters && parentEndpoint.urlParameters[paramName]) {
                        endpoint.urlParameters = Object.assign({}, parentEndpoint.urlParameters, endpoint.urlParameters || {});
                    } else {
                        throw new Error(`MeshRamlParser: No definition of URL parameter "${paramName}" can be found for url "${endpoint.url}"`);
                    }
                }
            }
        }
    }

    async traverseRequest(requestSchema: RequestSchemaInRAML, methodName: string, url: string, urlParams: UrlParameterMap | undefined, models: ModelMap): Promise<Endpoint> {
        const parsedRequest: Endpoint = {
            url,
            method: methodName.toUpperCase() as any,
            urlParameters: urlParams,
            queryParameters: requestSchema.queryParameters,
            description: requestSchema.description,
            responses: {}
        };

        const body = requestSchema.body;
        const jsonBody: { schema: string; example: string; } = body && (body as any)['application/json'];
        const formBody: FormPartMap = body && ((body as any)['multipart/form-data'] || {} as any).formParameters;

        if (jsonBody) {
            parsedRequest.requestBody = { mimeType: 'application/json' };
            if (jsonBody.example) {
                parsedRequest.requestBody.example = JSON.parse(jsonBody.example);
            }
            if (jsonBody.schema) {
                const schema: PropertyDefinition = JSON.parse(jsonBody.schema);
                parsedRequest.requestBody.schema = await this.normalizeSchema(schema, models);
            }
        } else if (formBody) {
            parsedRequest.requestBody = { mimeType: 'multipart/form-data' };
            let formSchema: Partial<ObjectProperty> = {
                type: 'object',
                required: Object.keys(formBody).some(k => formBody[k].required),
                properties: formBody as any
            };
            parsedRequest.requestBody.schema = formSchema as ObjectProperty;
        }

        parsedRequest.responses = await this.traverseResponseSchemas(requestSchema.responses, models);

        return parsedRequest;
    }

    /** Format a RAML parameters hash as a JsonSchema declaration */
    private paramsHashToJsonSchema(parameters: { [key: string]: Parameter }, description?: string): ObjectProperty {
        let returnValue: ObjectProperty = {
            description,
            type: 'object',
            required: true,
            properties: {}
        } as ObjectProperty;
        return returnValue;
    }

    async traverseResponseSchemas(responseMap: ResponseMapYaml, models: ModelMap): Promise<ResponseMap> {
        const responseTypes: ResponseMap = {};

        for (let responseCode of Object.keys(responseMap || {})) {
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
