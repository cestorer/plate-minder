import sharp from 'sharp';
import cv from './OpenCV.js';

export const channelsToMatType = {
	'1': cv.CV_8UC1,
	'2': cv.CV_8UC2,
	'3': cv.CV_8UC3,
	'4': cv.CV_8UC4
};

export class ROI {
	#left = null;
	#top = null;
	#width = null;
	#height = null;
	constructor(left, top, width, height) {
		if(!Number.isInteger(left))
			throw new TypeError('left must be an integer.');
		if(!Number.isInteger(top))
			throw new TypeError('top must be an integer.');
		if(!Number.isInteger(width))
			throw new TypeError('width must be an integer.');
		if(!Number.isInteger(height))
			throw new TypeError('height must be an integer.');

		this.#left = left;
		this.#top = top;
		this.#width = width;
		this.#height = height;
	}
	get left() {
		return this.#left;
	}
	get top() {
		return this.#top;
	}
	get width() {
		return this.#width;
	}
	get height() {
		return this.#height;
	}
	add(roi) {
		if(!(roi instanceof ROI))
			throw new TypeError('roi must be an instance of ROI.');
		this.#left += roi.left;
		this.#top += roi.top;
		this.#width = roi.width;
		this.#height = roi.height;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			config.left,
			config.top,
			config.width,
			config.height
		);
	}
}

export default class RawImage {
	#buffer = null;
	#width = null;
	#height = null;
	#channels = null;
	#cropData = null;
	#sharpInstance = null;

	constructor(buffer, width, height, channels) {
		this.buffer = buffer;
		this.width = width;
		this.height = height;
		this.channels = channels;
		this.#cropData = ROI.fromObject({
			left: 0,
			top: 0,
			width,
			height
		});
		this.#sharpInstance = sharp(buffer, {
		  raw: {
			width,
			height,
			channels,
		  },
		});
	}
	get buffer() {
		return this.#buffer;
	}
	set buffer(v) {
		if(!(v instanceof Buffer))
			throw new TypeError('buffer must be an instance of Buffer.');
		this.#buffer = v;
	}
	get width() {
		return this.#width;
	}
	set width(v) {
		if(!Number.isInteger(v))
			throw new TypeError('width must be an integer.');
		this.#width = v;
	}
	get height() {
		return this.#height;
	}
	set height(v) {
		if(!Number.isInteger(v))
			throw new TypeError('height must be an integer.');
		this.#height = v;
	}
	get channels() {
		return this.#channels;
	}
	set channels(v) {
		if(!Number.isInteger(v))
			throw new TypeError('channels must be an integer.');
		this.#channels = v;
	}
	get cropData() {
		return this.#cropData;
	}
	clear() {
		this.buffer = Buffer.from([]);
		this.width = 0;
		this.height = 0;
		this.channels = 0;
	}
	async markRoi(roi) {
		const svgBuffer = Buffer.from(`
			<svg width="${this.width}" height="${this.height}" version="1.1" xmlns="http://www.w3.org/2000/svg">
				<rect x="${roi.left}" y="${roi.top}" width="${roi.width}" height="${roi.height}" stroke="#00FF00" fill="transparent" stroke-width="3"/>
			</svg>
		`);

		const compositeOperation = [
			{
			  input: svgBuffer,
			  top: 0,
			  left: 0,
			  blend: 'over',
			},
		  ];

		this.buffer = await this.#sharpInstance
			.composite(compositeOperation)
			.removeAlpha()
			.toBuffer();
	}
	async roi(roi) {
		const img = this.#sharpInstance.extract(roi);
		const buffer = await img.toBuffer();
		const croppedImage = new RawImage(
			buffer,
			roi.width,
			roi.height,
			this.channels
		);
		croppedImage.#cropData = ROI.fromObject({
			left: this.#cropData.left + roi.left,
			top: this.#cropData.top + roi.top,
			width: roi.width,
			height: roi.height,
		});
		return croppedImage;
	}
	async crop(roi) {
		if(!(roi instanceof ROI))
			throw new TypeError('roi must be an instance of ROI.');
		const img = this.toSharp().extract(roi);

		this.buffer = await img.toBuffer();
		this.width = roi.width;
		this.height = roi.height;
		this.cropData.add(roi);
	}
	toSharp() {
		return this.#sharpInstance;
	}
	toMat() {
		const mat = new cv.Mat(this.height, this.width, channelsToMatType[this.channels]);
		mat.data.set(this.buffer);
		return mat;
	}
	async toJpegBuffer() {
		if (this.buffer.length === 0) {
		  return Buffer.from([]);
		}
	
		return await this.#sharpInstance
			.jpeg()
			.toBuffer();
	}
	loadMat(mat) {
		if(!(mat instanceof cv.Mat))
			throw new TypeError('mat must be an instance of cv.Mat.');
		this.buffer = Buffer.from(mat.data);
		this.width = mat.cols;
		this.height = mat.rows;
		this.channels = mat.channels();
	}
	static copy(rawImage) {
		if(!(rawImage instanceof RawImage))
			throw new TypeError('rawImage must be an instance of RawImage.');
		return new this(
			Buffer.from(rawImage.buffer),
			rawImage.width,
			rawImage.height,
			rawImage.channels
		);
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		return new this(
			config.buffer,
			config.width,
			config.height,
			config.channels
		);
	}
	static async fromBuffer(buffer) {
		const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
		return new this(
			data,
			info.width,
			info.height,
			info.channels
		);
	}
}
