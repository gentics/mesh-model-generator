import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'fs';

/** Wrapped fs.readFile as Promise */
export function readFile(filename: string, encoding = 'utf-8'): Promise<string> {
    return new Promise((resolve, reject) => {
        nodeReadFile(filename, { encoding }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/** Reads all contents of a node file stream */
export function readStreamToEnd(stream: NodeJS.ReadableStream, encoding = 'utf-8'): Promise<string> {
    return new Promise((resolve, reject) => {
        const parts: string[] = [];
        stream.on('data', (chunk: string | Buffer) => {
            parts.push(typeof chunk === 'string' ? chunk : chunk.toString(encoding));
        })
        .on('end', () => {
            resolve(parts.join(''));
        })
        .on('error', reject);
    });
}

/** Wrapped fs.writeFile as Promise */
export function writeFile(filename: string, data: string, encoding = 'utf-8'): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        nodeWriteFile(filename, data, { encoding }, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/** Writes to a node file stream */
export function writeToStream(stream: NodeJS.WritableStream, data: string, encoding = 'utf-8'): Promise<string> {
    return new Promise((resolve, reject) => {
        stream.on('error', reject)
        .write(data, encoding, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}