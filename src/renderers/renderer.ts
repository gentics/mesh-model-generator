import { ParsedMeshRAML } from '../interfaces';

export interface ModelRenderer {
    renderAll(raml: ParsedMeshRAML): Promise<string>;
    renderRequestModels?(raml: ParsedMeshRAML): Promise<string>;
    renderResponseModels?(raml: ParsedMeshRAML): Promise<string>;
}
