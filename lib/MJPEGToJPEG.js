import { Writable } from 'stream';

const JPEG_START = Buffer.from([0xff, 0xd8]);
const JPEG_END = Buffer.from([0xff, 0xd9]);

export default class MJPEGToJPEG extends Writable {
	#chunks = [];
    #totalLength = 0;  // for calculating total chunks length

    _write(chunk, encoding, done) {
        let start = 0;
        let indexStart, indexEnd;

        while (start < chunk.length) {
            indexStart = chunk.indexOf(JPEG_START, start);
            indexEnd = chunk.indexOf(JPEG_END, start);

            if (this.#chunks.length > 0) {
                if (indexEnd !== -1) {
                    this.#chunks.push(chunk.slice(start, indexEnd + 2));
                    this.#totalLength += indexEnd - start + 2;
                    const jpeg = Buffer.concat(this.#chunks, this.#totalLength);
                    this.#chunks = [];
                    this.#totalLength = 0;
                    start = indexEnd + 2;
                    this.emit('jpeg', jpeg);
                } else {
                    this.#chunks.push(chunk.slice(start));
                    this.#totalLength += chunk.length - start;
                    start = chunk.length;
                }
            } else {
                if (indexStart !== -1) {
                    if (indexEnd !== -1) {
                        this.#chunks.push(chunk.slice(indexStart, indexEnd + 2));
                        this.#totalLength += indexEnd - indexStart + 2;
                        const jpeg = Buffer.concat(this.#chunks, this.#totalLength);
                        this.#chunks = [];
                        this.#totalLength = 0;
                        start = indexEnd + 2;
                        this.emit('jpeg', jpeg);
                    } else {
                        this.#chunks.push(chunk.slice(indexStart));
                        this.#totalLength += chunk.length - indexStart;
                        start = chunk.length;
                    }
                } else {
                    start = chunk.length;
                }
            }
        }

        done();
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		return new this();
	}
}
