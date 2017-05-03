import { ModelRenderer } from './renderer';
import { ParsedMeshRAML, ModelMap, Endpoint, ObjectProperty, PropertyDefinition, CombinedResponseInfo, Parameter } from '../interfaces';
import { unindent } from '../utils/unindent';
import { formatAsObjectKey, formatValueAsPOJO } from '../utils/format-as-pojo';
import { unhandledCase } from '../utils/unhandled-case';

export const defaultOptions = {
    addEndpointList: false,
    emitIntegerAs: 'Integer',
    emitInterfacesAsReadonly: false,
    emitRequestExamples: true,
    emitRequestURLs: false,
    emitResponseExamples: false,
    endpointInterface: 'ApiEndpoints',
    indentation: '    ',
    interfacePrefix: '',
    interfaceSuffix: '',
    methodSortOrder: ['GET', 'POST', 'PUT', 'UPDATE', 'DELETE'] as Array<'GET' | 'POST' | 'PUT' | 'UPDATE' | 'DELETE'>,
    sortInterfaces: true,
    sortKeys: true
};
export type Options = typeof defaultOptions;

export type ModelFilter = (model: ObjectProperty, modelMap: ModelMap) => boolean;

/**
 * Renders the request/response models as TypeScript interfaces.
 */
export class TypescriptModelRenderer implements ModelRenderer {

    public options: Options;

    constructor(options?: Partial<Options>) {
        this.options = { ...defaultOptions, ...(options || {}) };
    }

    async renderAll(raml: ParsedMeshRAML): Promise<string> {
        const always = () => true;
        const head = await this.fileHead(raml.version);
        const bodyParts = [
            this.options.addEndpointList ? await this.generateEndpointList(raml) : '',
            await this.generateInterfaces(raml, always)
        ];
        const body = bodyParts.filter(part => !!part).join('\n');
        return body ? head + body : '';
    }

    protected async fileHead(version: string): Promise<string> {
        return unindent `
            // Auto-generated from the RAML for Version ${version} of the Gentics Mesh REST API.

            export type Integer = number;


        `;
    }

    /**
     * Generate a TypeScript interface that lists all API endpoints and their request & response models.
     */
    async generateEndpointList(raml: ParsedMeshRAML): Promise<string> {
        const lines: string[] = [];
        const endpointsByMethod = this.groupEndpointsByMethod(raml.endpoints);

        // Iterate over the endpoints by method...
        for (let method of Object.keys(endpointsByMethod)) {

            const urlLines: string[] = [];

            // ... and by URL
            for (let endpoint of endpointsByMethod[method]) {
                urlLines.push(
                    ...this.generateJsDoc({ description: endpoint.description }),
                    formatAsObjectKey(endpoint.url) + ': {',
                    ...this.indent(await this.formatEndpointInterface(endpoint)),
                    '};'
                );
            }

            if (urlLines.length) {
                lines.push(
                    method + ': {',
                    ...this.indent(urlLines),
                    '};'
                );
            } else {
                lines.push(method + ': { };')
            }
        }

        return [
            '/** List of all API endpoints and their types */',
            'export interface ' + this.options.endpointInterface + ' {',
            ...this.indent(lines),
            '}\n',
        ].join('\n');
    }

    protected groupEndpointsByMethod(endpoints: Endpoint[]): { [method: string]: Endpoint[] } {
        const grouped: { [method: string]: Endpoint[] } = { };

        // Sort methods by method sort order
        for (let method of this.options.methodSortOrder) {
            grouped[method] = [];
        }

        for (let endpoint of endpoints) {
            grouped[endpoint.method].push(endpoint);
        }

        // Sort arrays by url in grouped-by-method hash
        for (let key in grouped) {
            grouped[key].sort((a, b) => a.url < b.url ? -1 : 1);
        }

        return grouped;
    }

    protected groupEndpointsByUrl(endpoints: Endpoint[]): { [url: string]: Endpoint[] } {
        const grouped: { [url: string]: Endpoint[] } = { };
        // Sort keys by URL
        for (let url of endpoints.map(endpoint => endpoint.url).sort()) {
            grouped[url] = [];
        }

        for (let endpoint of endpoints) {
            grouped[endpoint.url].push(endpoint);
        }

        // Sort methods in grouped-by-url hash
        for (let key in grouped) {
            grouped[key].sort((a, b) => {
                const orderA = this.options.methodSortOrder.indexOf(a.method);
                const orderB = this.options.methodSortOrder.indexOf(b.method);
                return orderA - orderB;
            });
        }

        return grouped;
    }

    protected async formatEndpointInterface(endpoint: Endpoint): Promise<string[]> {
        // const example = endpoint.requestBodyExample && formatValueAsPOJO(endpoint.requestBodyExample, this.options.indentation);

        // Format a hash with the parameters required for requesting from the endpoint
        const requestLines: string[] = [
            ...this.formatParameters(endpoint.urlParameters, 'urlParams'),
            ...this.formatParameters(endpoint.queryParameters, 'queryParams')
        ];

        // Format request body interface
        if (!endpoint.requestBodySchema) {
            requestLines.push('body?: undefined;');
        } else {
            // const modelRef = endpoint.requestBodySchema.type === 'object' && (endpoint.requestBodySchema.id || endpoint.requestBodySchema.$ref)
            const optional = endpoint.requestBodySchema.required === false;
            const optionalText = optional ? '?' : '';
            const valueText = await this.renderTypescriptPropertyDefinition(endpoint.requestBodySchema);
            requestLines.push('body' + optionalText + ': ' + valueText + ';');
        }

        const isOptional = (input?: { [k: string]: { required?: boolean } }) =>
            input == null || Object.keys(input).every(k => !input[k].required);

        // Determine if all request parameters are optional
        const bodySchema = endpoint.requestBodySchema;
        const bodyOptional = !bodySchema || bodySchema.type === 'object' && isOptional(bodySchema.properties);
        const urlParamsOptional = isOptional(endpoint.urlParameters);
        const queryParamsOptional = isOptional(endpoint.queryParameters);
        const allRequestParamsAreOptional = bodyOptional && urlParamsOptional && queryParamsOptional;

        const lines: string[] = [
            allRequestParamsAreOptional ? 'request?: {' : 'request: {',
            ...this.indent(requestLines),
            '};'
        ];

        // Find all types that can be returned by the endpoint
        const allResponseTypes: string[] = [];
        const responseStatusLines: string[] = [];
        let responsesWithMissingType = 0;

        for (let statusCode of Object.keys(endpoint.responses)) {
            const response = endpoint.responses[Number(statusCode)];
            let responseType: string;
            if (response.responseBodySchema) {
                responseType = await this.renderTypescriptPropertyDefinition(response.responseBodySchema);
            } else {
                responseType =  'undefined /* TODO: This is not typed in the RAML */';
                responsesWithMissingType += 1;
            }

            if (allResponseTypes.indexOf(responseType) < 0) {
                allResponseTypes.push(responseType);
            }
            responseStatusLines.push(...this.generateJsDoc({ description: response.description }));
            responseStatusLines.push(`${statusCode}: ${responseType};`);
        }

        if (!Object.keys(endpoint.responses).length || responsesWithMissingType === allResponseTypes.length) {
            lines.push(...[
                'responseType: any; // TODO: This is not typed in the RAML',
                'responseTypes: {',
                this.options.indentation + '200: any; // TODO: This is not typed in the RAML',
                '};'
            ]);
        } else {
            lines.push(...[
                'responseType: ' + allResponseTypes.join(' | ') + ';',
                'responseTypes: {',
                ...this.indent(responseStatusLines),
                '};'
            ]);
        }

        return lines;
    }

    /** Formats url parameters / query parameters as TypeScript interface. */
    protected formatParameters(paramMap: { [key: string]: Parameter } | undefined, resultKey: string): string[] {
        if (!paramMap || Object.keys(paramMap).length === 0) {
            return [resultKey + '?: undefined;'];
        } else {
            const lines = [] as string[];
            const optional = !Object.keys(paramMap)
                .some(param => paramMap[param].required);

            lines.push(resultKey + (optional ? '?' : '') + ': {');
            for (let paramName of Object.keys(paramMap)) {
                const param = paramMap[paramName];

                // The "default" and "example" values are a string also for numbers and booleans
                let defaultValue: any;
                let exampleText: string;
                if (param.type === 'number') {
                    defaultValue = Number(param.default);
                    exampleText = String(Number(param.example));
                } else if (param.type === 'boolean') {
                    defaultValue = !!param.default;
                    exampleText = String(!!param.default);
                } else {
                    defaultValue = param.default !== undefined && JSON.stringify(param.default);
                    exampleText = param.example != null ? JSON.stringify(param.example) : '';
                }

                const description = param.description;
                const example = this.options.emitRequestExamples ? exampleText : '';
                const keyText = formatAsObjectKey(paramName) + (param.required ? '': '?');
                const typeText = param.repeat ? `${param.type} | ${param.type}[]` : param.type;
                const jsdoc = this.generateJsDoc({ description, example, defaultValue })
                    .join('\n')
                    .replace(/ \*\n \* @example\n \* /g, ' * @example ')
                    .split('\n');

                lines.push(...this.indent([
                    ...jsdoc,
                    keyText + ': ' + typeText + ';'
                ]));
            }
            lines.push('};');

            return lines;
        }
    }


    /**
     * Generate the TypeScript interfaces for all models in the parsed RAML input.
     * @param raml The parsed mesh raml, output by `MeshRamlParser`.
     * @param filter A filter function similar to Array.prototype.filter.
     */
    async generateInterfaces(raml: ParsedMeshRAML, filter: ModelFilter): Promise<string> {
        const { models, endpoints } = raml;
        let modelNames = Object.keys(models);

        if (this.options.sortInterfaces) {
            modelNames = modelNames
                .map(fullName => ({
                    fullName,
                    shortName: this.generateModelName(fullName)
                }))
                .sort((a, b) => (a.shortName < b.shortName) ? -1 : (a.shortName > b.shortName ? 1 : 0))
                .map(name => name.fullName);
        }

        let lines: string[] = [];

        for (let modelRef of modelNames) {
            const model = models[modelRef];

            if (model.type === 'object' && filter(model, models)) {
                let example = '';
                if (this.options.emitResponseExamples) {
                    const responseExample = this.endpointsWithResponseType(model, endpoints)
                        .map(responseInfo => responseInfo.response.responseBodyExample)
                        .filter(responseExample => !!responseExample)[0]
                    example = responseExample ? await this.formatResponseExample(responseExample) : '';
                }

                const responses = this.options.emitRequestURLs
                    ? this.sortEndpointsForJsDoc(this.endpointsWithResponseType(model, endpoints))
                    : [];

                const interfaceName = this.generateModelName(modelRef);
                const jsDocLines = this.generateJsDoc({ description: model.description, example, responses });
                const typescriptProperties = await this.renderTypescriptProperties(model.properties);

                lines = [
                    ...lines,
                    ...jsDocLines,
                    `export interface ${interfaceName} {`,
                    ...typescriptProperties,
                    `}\n`
                ];
            }
        }

        return lines.join('\n');
    }

    /**
     * Returns a list of all endpoints that return the passed schema as Response for any status code.
     */
    protected endpointsWithResponseType(schema: PropertyDefinition, endpoints: Endpoint[]): CombinedResponseInfo[] {
        const list: CombinedResponseInfo[] = [];

        for (let endpoint of endpoints) {
            for (let statusCode of Object.keys(endpoint.responses).map(k => Number(k))) {
                const response = endpoint.responses[statusCode];
                if (response.responseBodySchema === schema || (
                        response.responseBodySchema &&
                        response.responseBodySchema.type === 'object' && (
                            response.responseBodySchema.$ref === (schema as ObjectProperty).id ||
                            response.responseBodySchema.id === (schema as ObjectProperty).id
                        )
                    )) {
                    list.push({ endpoint, response, statusCode });
                }
            }
        }

        return list;
    }

    /**
     * Generate the output interface name of a model reference.
     *
     * @param {string} schemaRef The full name of the referenced model,
     *     e.g. "urn:jsonschema:com:gentics:mesh:core:rest:user:UserCreateRequest"
     */
    protected generateModelName(schemaRef: string): string {
        const shortName = schemaRef.replace(/^urn:jsonschema:com:([a-z]+:)*/, '');
        return this.formatModelName(shortName, schemaRef);
    }

    /**
     * Format an interface name with prefix and suffix.
     * Can be overwritten by the consuming code to add conditional logic.
     *
     * @param {string} shortName The short name of the referenced model,
     *     e.g. "UserCreateRequest"
     * @param {string} fullSchemaRef The full name of the referenced model,
     *     e.g. "urn:jsonschema:com:gentics:mesh:core:rest:user:UserCreateRequest"
     */
    protected formatModelName(shortName: string, fullSchemaRef: string): string {
        return this.options.interfacePrefix + shortName + this.options.interfaceSuffix;
    }

    /** Format a request example as a string for a JsDoc comment. */
    protected async formatRequestExample(responseExample: object): Promise<string> {
        return formatValueAsPOJO(responseExample, this.options.indentation);
    }

    /** Format a response example as a string for a JsDoc comment. */
    protected async formatResponseExample(responseExample: object): Promise<string> {
        return formatValueAsPOJO(responseExample, this.options.indentation);
    }

    /** Returns lines representing a JsDoc comment for the passed information */
    protected generateJsDoc({ description, defaultValue, example, responses }: {
                description?: string,
                defaultValue?: any,
                example?: string
                responses?: CombinedResponseInfo[]
            }): string[] {

        if (responses && responses.length === 0) {
            responses = undefined;
        }

        if (!description && !example && !responses) {
            return [];
        }

        if (defaultValue != null && description) {
            let defaultText = formatValueAsPOJO(defaultValue);
            description = description.replace(/(\. ?)|(\n)|$/, ` (default: ${defaultText})$1$2`);
        }

        const descriptionLines = description
            ? description.replace(/\. (?!\()/g, '.\n').split('\n')
            : [];

        if (!example && description && descriptionLines.length === 1 && !responses) {
            return ['/** ' + description + ' */'];
        }

        const lines: string[] = [];
        if (description) {
            lines.push(...descriptionLines);
        }

        if (description && responses) {
            lines.push('');
        }

        if (responses) {
            if (responses.length === 1) {
                const { method, url } = responses[0].endpoint;
                lines.push(`Returned for \`${method} ${url}\``);
            } else {
                const listIndentation = this.options.indentation.replace(/  $/, '');
                lines.push(`Returned for:`, ...responses.map(({ endpoint }) =>
                    `${listIndentation}- \`${endpoint.method} ${endpoint.url}\``));
            }
        }

        if ((description || responses) && example) {
            lines.push('');
        }

        if (example) {
            if (typeof example !== 'string') {
                example = JSON.stringify(example, null, this.options.indentation);
            }
            lines.push('@example', ...example.split('\n'));
        }

        return [
            '/**',
            ...lines.map(line => line ? ' * ' + line : ' *'),
            ' */'
        ];
    }

    /** Indent lines of text with the indentation provided in the renderer options */
    protected indent(text: string[]): string[] {
        return text && text.map(line => line ? this.options.indentation + line : '');
    }

    /**
     * Sort a list of responses by (method -> url).
     * Can be overwritten by the consuming code to add additional logic.
     */
    protected sortEndpointsForJsDoc(list: CombinedResponseInfo[]): CombinedResponseInfo[] {
        list.sort((a, b) => {
            const orderIndexA = this.options.methodSortOrder.indexOf(a.endpoint.method);
            const orderIndexB = this.options.methodSortOrder.indexOf(b.endpoint.method);
            if (orderIndexA !== orderIndexB) {
                return orderIndexA - orderIndexB;
            } else if (a.endpoint.url < b.endpoint.url) {
                return -1;
            } else {
                return 1;
            }
        });

        // Group all endpoints that have the same request URL and method
        const unique: CombinedResponseInfo[] = [];
        for (let response of list) {
            if (unique.every(r => r.endpoint.url !== response.endpoint.url
                               || r.endpoint.method !== response.endpoint.method)) {
                unique.push(response);
            }
        }
        return unique;
    }

    protected async renderTypescriptProperties(props: { [name: string]: PropertyDefinition }): Promise<string[]> {
        const lines: string[] = [];
        const keys = Object.keys(props);
        if (this.options.sortKeys) {
            keys.sort();
        }

        for (let key of keys) {
            const prop = props[key];
            if (prop.description) {
                lines.push(...this.generateJsDoc({ description: prop.description, example: prop.example }));
            }

            const readonlyText = this.options.emitInterfacesAsReadonly ? 'readonly ' : '';
            const valueText = await this.renderTypescriptPropertyDefinition(prop);
            const separator = prop.required ? ': ' : '?: ';

            lines.push([readonlyText, formatAsObjectKey(key), separator, valueText, ';'].join(''));
        }

        return this.indent(lines);
    }

    protected async renderTypescriptPropertyDefinition(prop: PropertyDefinition): Promise<string> {
        switch (prop.type) {
            case 'any':
            case 'boolean':
            case 'number':
            case 'string':
                return prop.type;
            case 'integer':
                return this.options.emitIntegerAs || 'number';
            case 'array':
                const arrayType = await this.renderTypescriptPropertyDefinition(prop.items);
                if (/^[A-Za-z$_][A-Za-z0-9$_]*$/.test(arrayType)) {
                    return arrayType + '[]';
                } else {
                    return 'Array<' + arrayType + '>';
                }
            case 'object':
                const modelName = this.generateModelName(prop.id || prop.$ref || '');
                if (modelName && (prop.id || prop.$ref)) {
                    return modelName;
                }
                if (prop.additionalProperties) {
                    const hashType = await this.renderTypescriptPropertyDefinition(prop.additionalProperties);
                    return '{ [key: string]: ' + hashType + ' }';
                }
                throw new Error('object property without id or additionalProperties: ' + JSON.stringify(prop, null, 2));

            default:
                return unhandledCase(prop);
        }
    }
}
