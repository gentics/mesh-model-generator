import { MeshRamlParser } from './parser';
import { TypescriptModelRenderer } from './renderers/typescript-renderer';

/**
 * Parse the Gentics Mesh RAML for Request/Response models and generate TypeScript interfaces.
 *
 * For more fine-tuned generation, use {@link MeshRamlParser} and a {@link ModelRenderer} of your choice.
 */
export async function parseAndGenerate(raml: string): Promise<string> {
    const parser = new MeshRamlParser();
    const renderer = new TypescriptModelRenderer();

    const parsed = await parser.parseRAML(raml);
    const rendered = await renderer.renderAll(parsed);
    return rendered;
}
