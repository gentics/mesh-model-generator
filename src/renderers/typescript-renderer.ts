import { ModelRenderer } from './renderer';
import { ParsedMeshRAML, ModelMap, Endpoint, ObjectProperty, PropertyDefinition, CombinedResponseInfo } from '../interfaces';
import { unindent } from '../utils/unindent';
import { formatAsObjectKey, formatValueAsPOJO } from '../utils/format-as-pojo';
import { unhandledCase } from '../utils/unhandled-case';

export const defaultOptions = {
    emitIntegerAs: 'Integer',
    emitInterfacesAsReadonly: false,
    emitRequestExamples: true,
    emitRequestURLs: false,
    emitResponseExamples: false,
    indentation: '    ',
    interfacePrefix: '',
    interfaceSuffix: '',
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
        const body = await this.generateInterfaces(raml, always);
        return body ? head + body : '';
    }

    protected async fileHead(version: string): Promise<string> {
        return unindent `
            // Auto-generated from the RAML for Version ${version} of the Gentics Mesh REST API.

            export type Integer = number;


        `;
    }

    /**
     * Generate the TypeScript interfaces for a 
     */
    protected async generateInterfaces(raml: ParsedMeshRAML, filter: ModelFilter): Promise<string> {
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
                    ? this.endpointsWithResponseType(model, endpoints)
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
     * @param {string} schemaRef The full name of the referenced model,
     *     e.g. "urn:jsonschema:com:gentics:mesh:core:rest:user:UserCreateRequest"
     */
    protected generateModelName(schemaRef: string): string {
        const shortName = schemaRef.replace(/^urn:jsonschema:com:([a-z]+:)*/, '');
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
    protected generateJsDoc({ description, example, responses }: {
                description?: string,
                example?: string
                responses?: CombinedResponseInfo[]
            }): string[] {

        if (responses && responses.length === 0) {
            responses = undefined;
        }

        if (!description && !example) {
            return [];
        }

        const descriptionLines = description
            ? description.replace(/\. /g, '.\n').split('\n')
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
                lines.push(`Returned for: ${responses[0].endpoint.method} ${responses[0].endpoint.url}`);
            } else {
                lines.push(`Returned for:`);
                for (let res of responses) {
                    lines.push(this.options.indentation + res.endpoint.method + ' ' + res.endpoint.url);
                }
            }
        }

        if ((description || responses) && example) {
            lines.push('');
        }

        if (example) {
            lines.push('@example');
            lines.push(...example.split('\n'));
        }

        return [
            '/**',
            ...lines.map(line => line ? ' * ' + line : ' *'),
            ' */'
        ];
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
                lines.push(...this.generateJsDoc({ description: prop.description }));
            }

            const readonlyText = this.options.emitInterfacesAsReadonly ? 'readonly ' : '';
            const valueText = await this.renderTypescriptPropertyDefinition(prop);
            const separator = prop.required ? ': ' : '?: ';

            lines.push([readonlyText, formatAsObjectKey(key), separator, valueText, ';'].join(''));
        }

        return lines.map(line => this.options.indentation + line);
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
