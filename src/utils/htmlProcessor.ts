import sanitizeHtml from 'sanitize-html';
import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';

/**
 * HTMLタグを除去してプレーンテキスト化
 * @param html HTMLコンテンツ
 * @param maxLength 最大文字数（省略可）
 * @returns プレーンテキスト
 */
export function stripHtml(html: string, maxLength?: number): string {
	if (!html) return '';

	// 文字列でない場合は空文字列を返す（xml2jsがオブジェクトを返す場合の対策）
	if (typeof html !== 'string') {
		console.error('stripHtml: received non-string input', html);
		return '';
	}

	// ブラウザネイティブのDOMParserを使用
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	let text = doc.body.textContent || '';

	// 余分な空白・改行を整理
	text = text.replace(/\s+/g, ' ').trim();

	if (maxLength && text.length > maxLength) {
		text = text.substring(0, maxLength) + '...';
	}

	return text;
}

/**
 * HTML → Markdown変換（defuddle使用）
 * @param html HTMLコンテンツ
 * @returns Markdownコンテンツ
 */
export async function htmlToMarkdown(html: string): Promise<string> {
	if (!html) return '';

	// 文字列でない場合は空文字列を返す（xml2jsがオブジェクトを返す場合の対策）
	if (typeof html !== 'string') {
		console.error('htmlToMarkdown: received non-string input', html);
		return '';
	}

	try {
		// RSSコンテンツはすでに抽出済みなので、最小限のdocument構造でラップしてdefuddleに渡す
		const wrappedHtml = `<html><body><article>${html}</article></body></html>`;
		const { document } = parseHTML(wrappedHtml);
		const result = await Defuddle(document, '', {
			markdown: true,
			useAsync: false,
			standardize: false,
			removeLowScoring: false,
			removeContentPatterns: false,
		});
		return result.content || '';
	} catch (error) {
		console.error('htmlToMarkdown: defuddle parsing failed', error);
		return '';
	}
}

/**
 * HTMLのサニタイズ（危険なタグを除去）
 * @param html HTMLコンテンツ
 * @returns サニタイズされたHTML
 */
export function sanitizeContent(html: string): string {
	if (!html) return '';

	return sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ['src', 'alt', 'title']
		}
	});
}

/**
 * 画像URLの抽出（最初の画像を取得）
 * @param html HTMLコンテンツ
 * @returns 画像URL（存在しない場合はundefined）
 */
export function extractFirstImage(html: string): string | undefined {
	if (!html) return undefined;

	// ブラウザネイティブのDOMParserを使用
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const firstImg = doc.querySelector('img');
	return firstImg?.getAttribute('src') || undefined;
}
