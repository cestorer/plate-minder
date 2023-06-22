import fetch from 'node-fetch';
import Blob from 'fetch-blob';
import { ROI } from './RawImage.js';
import { FormData } from 'formdata-polyfill/esm.min.js';

export const DEFAULT_COUNTRY_CODE = 'us';

export default class OpenALPRDetect {
	#url = null;
	#countryCode = null;
	#pattern = null;

	constructor(url, countryCode, pattern = null) {
		
		this.url = url;
		this.countryCode = countryCode;
		this.pattern = pattern;
	}
	get url() {
		return this.#url;
	}
	set url(v) {
		if(!(v instanceof URL))
			throw new TypeError('url must be an instance of URL.');
		this.#url = v;
	}
	get countryCode() {
		return this.#countryCode;
	}
	set countryCode(v) {
		if(typeof v !== 'string')
			throw new TypeError('countryCode must be a string.');
		this.#countryCode = v;
	}
	get pattern() {
		return this.#pattern;
	}
	set pattern(v) {
		if(v !== null && typeof v !== 'string')
			throw new TypeError('pattern must be a string.');
		this.#pattern = v;
	}
	async detect(rawImage) {
		const formData  = new FormData();
		const jpegBuffer = await rawImage.toJpegBuffer();
		formData.append('upload', new Blob([jpegBuffer]));
		formData.append('country_code', this.countryCode);
		if (this.pattern !== null) formData.append('pattern', this.pattern);

		console.log('detecting');

		const response = await fetch(this.#url.href, {
			method: 'POST',
			body: formData
		});

		const data = await response.json();

		if(response.status !== 200)
			throw new Error(data);

		const tasks = data.results.map(result => {
			const coordinates = result.coordinates.map(coord => ({ 
				x: Math.max(0, Math.min(rawImage.width, coord.x)), 
				y: Math.max(0, Math.min(rawImage.height, coord.y)) 
			}));
		
			const minX = Math.min(...coordinates.map(coord => coord.x));
			const minY = Math.min(...coordinates.map(coord => coord.y));
			const maxX = Math.max(...coordinates.map(coord => coord.x));
			const maxY = Math.max(...coordinates.map(coord => coord.y));
		
			const rect = { 
				left: minX, 
				top: minY, 
				width: maxX - minX, 
				height: maxY - minY 
			};
		
			const roi = ROI.fromObject(rect);
		
			return rawImage.roi(roi).then(img => img.toJpegBuffer()).then(buff => {
				rawImage.crop(roi);
				result.jpeg = buff;
			});
		});
		
		await Promise.all(tasks);

		return data;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			new URL(config.url),
			config.countryCode || DEFAULT_COUNTRY_CODE,
			config.pattern
		);
	}
}
