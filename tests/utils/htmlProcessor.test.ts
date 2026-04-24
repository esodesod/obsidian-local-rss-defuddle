import { describe, it, expect } from 'vitest';
import { stripHtml, htmlToMarkdown, sanitizeContent, extractFirstImage, removeElementsBySelectors, keepElementsBySelectors } from '../../src/utils/htmlProcessor';

describe('stripHtml', () => {
	it('should strip HTML tags and return plain text', () => {
		expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
	});

	it('should truncate text to maxLength', () => {
		const result = stripHtml('<p>This is a long text that should be truncated</p>', 10);
		expect(result).toBe('This is a ...');
	});

	it('should not truncate if text is shorter than maxLength', () => {
		expect(stripHtml('<p>Short</p>', 100)).toBe('Short');
	});

	it('should return empty string for empty input', () => {
		expect(stripHtml('')).toBe('');
	});

	it('should return empty string for non-string input', () => {
		expect(stripHtml(null as unknown as string)).toBe('');
		expect(stripHtml(undefined as unknown as string)).toBe('');
	});

	it('should collapse multiple whitespace characters', () => {
		expect(stripHtml('<p>hello   \n   world</p>')).toBe('hello world');
	});
});

describe('htmlToMarkdown', () => {
	it('should convert basic HTML to markdown', async () => {
		const result = await htmlToMarkdown('<p>Title</p><p>Paragraph</p>');
		expect(result).toContain('Title');
		expect(result).toContain('Paragraph');
	});

	it('should convert links', async () => {
		const result = await htmlToMarkdown('<a href="https://example.com">Link</a>');
		expect(result).toContain('[Link]');
		expect(result).toContain('https://example.com');
	});

	it('should remove script tags', async () => {
		const result = await htmlToMarkdown('<p>Hello</p><script>alert("xss")</script>');
		expect(result).not.toContain('script');
		expect(result).not.toContain('alert');
	});

	it('should return empty string for empty input', async () => {
		expect(await htmlToMarkdown('')).toBe('');
	});

	it('should return empty string for non-string input', async () => {
		expect(await htmlToMarkdown(null as unknown as string)).toBe('');
	});
});

describe('sanitizeContent', () => {
	it('should allow safe HTML tags', () => {
		const result = sanitizeContent('<p>Hello <b>World</b></p>');
		expect(result).toContain('<p>');
		expect(result).toContain('<b>');
	});

	it('should allow img tags with safe attributes', () => {
		const result = sanitizeContent('<img src="test.jpg" alt="test" title="test">');
		expect(result).toContain('src="test.jpg"');
		expect(result).toContain('alt="test"');
	});

	it('should strip script tags', () => {
		const result = sanitizeContent('<p>Safe</p><script>alert("xss")</script>');
		expect(result).not.toContain('script');
	});

	it('should return empty string for empty input', () => {
		expect(sanitizeContent('')).toBe('');
	});
});

describe('extractFirstImage', () => {
	it('should extract src from first img tag', () => {
		const html = '<p>Text</p><img src="first.jpg"><img src="second.jpg">';
		expect(extractFirstImage(html)).toBe('first.jpg');
	});

	it('should return undefined when no img tag exists', () => {
		expect(extractFirstImage('<p>No images</p>')).toBeUndefined();
	});

	it('should return undefined for empty input', () => {
		expect(extractFirstImage('')).toBeUndefined();
	});
});

describe('removeElementsBySelectors', () => {
	it('should remove elements matching a single selector', () => {
		const html = '<p>keep</p><div class="ad">remove</div><p>keep</p>';
		const result = removeElementsBySelectors(html, '.ad');
		expect(result).not.toContain('remove');
		expect(result).toContain('keep');
	});

	it('should remove elements matching multiple comma-separated selectors', () => {
		const html = '<p>keep</p><div class="ad">no</div><span class="tracking">no</span><p>keep</p>';
		const result = removeElementsBySelectors(html, '.ad, .tracking');
		expect(result).not.toContain('ad');
		expect(result).not.toContain('tracking');
		expect(result).toContain('keep');
	});

	it('should return original html when selectors is empty', () => {
		const html = '<p>hello</p>';
		expect(removeElementsBySelectors(html, '')).toBe(html);
	});

	it('should return original html when input is empty', () => {
		expect(removeElementsBySelectors('', '.ad')).toBe('');
	});
});

describe('keepElementsBySelectors', () => {
	it('should keep only elements matching a single selector', () => {
		const html = '<p>remove</p><div id="content">keep</div><p>remove</p>';
		const result = keepElementsBySelectors(html, '#content');
		expect(result).toContain('keep');
		expect(result).not.toContain('remove');
	});

	it('should keep multiple sibling elements matching separate selectors', () => {
		const html = `
			<div class="wrapper">
				<div class="u-phn">first</div>
				<div class="c-drp">second</div>
				<div class="other">remove</div>
			</div>`;
		const result = keepElementsBySelectors(html, '.u-phn, .c-drp');
		expect(result).toContain('first');
		expect(result).toContain('second');
		expect(result).not.toContain('remove');
	});

	it('should keep sibling elements at body level', () => {
		const html = '<div class="a">A</div><div class="b">B</div><div class="c">C</div>';
		const result = keepElementsBySelectors(html, '.a, .c');
		expect(result).toContain('A');
		expect(result).toContain('C');
		expect(result).not.toContain('B');
	});

	it('should skip nested matches that are descendants of an already-kept element', () => {
		const html = '<div id="outer"><p id="inner">text</p></div>';
		const result = keepElementsBySelectors(html, '#outer, #inner');
		expect(result).toContain('outer');
		expect(result).toContain('inner');
		// #outer should appear only once (no duplicate from #inner)
		expect(result.split('id="outer"').length - 1).toBe(1);
	});

	it('should return original html when no matches found', () => {
		const html = '<p>nothing matches</p>';
		expect(keepElementsBySelectors(html, '.nonexistent')).toBe(html);
	});

	it('should return original html when selectors is empty', () => {
		const html = '<p>hello</p>';
		expect(keepElementsBySelectors(html, '')).toBe(html);
	});

	it('should return original html when input is empty', () => {
		expect(keepElementsBySelectors('', '.a')).toBe('');
	});

	it('should rename <article> to <main> to avoid defuddle confusion', () => {
		const html = '<article><p>content</p></article>';
		const result = keepElementsBySelectors(html, 'article');
		expect(result).toContain('<main');
		expect(result).not.toContain('<article');
	});
});
