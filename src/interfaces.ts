export interface ArrayProperty {
    type: 'array';
    description?: string;
    example?: any[];
    required?: boolean;
    items: PropertyDefinition;
}

export interface CombinedResponseInfo {
    endpoint: Endpoint;
    statusCode: number;
    response: Response;
}

export interface Endpoint {
    method: RequestMethod;
    url: string;
    description: string;
    urlParameters?: UrlParameterMap;
    queryParameters?: QueryParameterMap;
    requestBodyExample?: string;
    requestBodySchema?: PropertyDefinition;
    responses: ResponseMap;
}

export interface ModelMap {
    [name: string]: PropertyDefinition;
}

export interface QueryParameterMap {
    [name: string]: Parameter;
};

export interface Parameter {
    default?: string;
    description: string;
    displayName?: string;
    type: 'boolean' | 'number' | 'string';
    required: boolean;
    repeat: boolean;
    example: string;
}

export interface ObjectProperty {
    type: 'object';
    description?: string;
    example?: any;
    required?: boolean;
    id: string;
    $ref?: string;
    properties: {
        [name: string]: PropertyDefinition;
    };
    /** Defines the property it is assigned on as a hash of the described type */
    additionalProperties?: PropertyDefinition;
}

export interface ParsedMeshRAML {
    /** The API baseUri as stated in the RAML */
    baseUri: string;

    /** An array of normalized endpoints with request and response models. */
    endpoints: Endpoint[];

    /** A hash of all models declared in the RAML. */
    models: {
        [name: string]: PropertyDefinition;
    };

    /** The mesh version the RAML was generated from. */
    version: string;
}

export type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Request as represented in the input RAML. Transformed to {@link ParsedMeshRAML} by the parser. */
export interface RequestSchemaInRAML {
    description: string;
    queryParameters?: QueryParameterMap;
    body: {
        'application/json': {
            schema: string;
            example: string;
        };
    };
    responses: {
        [status: number]: {
            description: string;
            body: {
                'application/json': {
                    schema: string;
                    example: string;
                };
            };
        }
    }
}

export interface PrimitiveProperty {
    type: 'any' | 'boolean' | 'integer' | 'number' | 'string';
    description?: string;
    example?: any;
    required?: boolean;
}

export type PropertyDefinition = PrimitiveProperty | ArrayProperty | ObjectProperty;

/** Parsed API response */
export interface Response {
    description: string;
    responseBodySchema?: PropertyDefinition;
    /** Example response body if provided in the raml. Result of parsing the example as JSON. */
    responseBodyExample?: any;
}

export interface ResponseMap {
    [statusCode: number]: Response;
}

export interface ResponseMapYaml {
    [statusCode: number]: {
        description: string;
        body: {
            'application/json': {
                /** JSON schema that can be parsed to a PropertyDefinition */
                schema: string,
                /** example JSON data */
                example?: string
            }
        }
    };
}

export interface UrlParameterMap {
    [name: string]: Parameter;
}
