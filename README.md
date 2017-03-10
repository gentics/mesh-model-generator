# Generator to render model interfaces from Gentics Mesh RAML

[![npm version](https://badge.fury.io/js/mesh-model-generator.svg)](https://www.npmjs.com/package/mesh-model-generator)

### NOTE

This package is work in progress and not ready for production use. It requires Gentics Mesh 0.8.x+

Render the server interfaces returned by [Mesh](http://getmesh.io/) as type definitions which can be used in TypeScript.
Designed for use with TypeScript, but can be extended for other languages.


## Usage as a module

```bash
npm install mesh-raml-generator
```

```TypeScript
import { readFileSync, writeFileSync } from 'fs';
import { parseAndGenerate } from 'mesh-raml-generator';

const inputFile = readFileSync('./my-api.raml', 'utf-8');
parseAndGenerate(inputFile)
    .then(generatedModels => {
        writeFileSync('./my-models.ts', generatedModels, 'utf-8');
    })
    .catch(err => console.error(err));
```

## Generating from the CLI

```Bash
npm install -g mesh-model-generator
mesh-model-generator my-api.raml > model-declarations.ts
```

## License

[MIT](LICENSE)
