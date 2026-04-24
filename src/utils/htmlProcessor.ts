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
 * @param contentSelector defuddleに渡すCSSセレクタ（自動検出をバイパス）
 * @returns Markdownコンテンツ
 */
export async function htmlToMarkdown(html: string, contentSelector?: string): Promise<string> {
	if (!html) return '';

	// 文字列でない場合は空文字列を返す（xml2jsがオブジェクトを返す場合の対策）
	if (typeof html !== 'string') {
		console.error('htmlToMarkdown: received non-string input', html);
		return '';
	}

	try {
		// linkedomでパース後、bodyのコンテンツのみを抽出
		// これにより完全なHTML文書でもフラグメントでも同じ処理にできる
		const { document } = parseHTML(html);
		const bodyContent = document.body?.innerHTML || html;

		// 最小限の構造で再ラップしてdefuddleに渡す
		const wrappedHtml = `<html><body>${bodyContent}</body></html>`;
		const { document: cleanDoc } = parseHTML(wrappedHtml);
		const result = await Defuddle(cleanDoc, '', {
			markdown: true,
			useAsync: false,
			standardize: false,
			removeLowScoring: false,
			removeContentPatterns: false,
			contentSelector: contentSelector || undefined,
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

/**
 * CSSセレクタに一致する要素をHTMLから除去
 * @param html HTMLコンテンツ
 * @param selectors 除去するCSSセレクタ（カンマ区切り）
 * @returns 処理されたHTML
 */
export function removeElementsBySelectors(html: string, selectors: string): string {
	if (!html || !selectors) return html;

	if (typeof html !== 'string') {
		console.error('removeElementsBySelectors: received non-string input', html);
		return '';
	}

	try {
		const wrappedHtml = `<html><body>${html}</body></html>`;
		const { document } = parseHTML(wrappedHtml);

		// 半角/全角カンマでセレクタを分割し、空白をトリム
		const selectorList = selectors.split(/[,，]/).map(s => s.trim()).filter(Boolean);

		for (const selector of selectorList) {
			const elements = document.querySelectorAll(selector);
			elements.forEach(el => el.remove());
		}

		return document.body.innerHTML;
	} catch (error) {
		console.error('removeElementsBySelectors: failed', error);
		return html;
	}
}

/**
 * CSSセレクタに一致する要素のみをHTMLから抽出（それ以外を除去）
 * @param html HTMLコンテンツ
 * @param selectors 保持するCSSセレクタ（カンマ区切り）
 * @returns 処理されたHTML
 */
export function keepElementsBySelectors(html: string, selectors: string): string {
	if (!html || !selectors) return html;

	if (typeof html !== 'string') {
		console.error('keepElementsBySelectors: received non-string input', html);
		return '';
	}

	try {
		const wrappedHtml = `<html><body>${html}</body></html>`;
		const { document } = parseHTML(wrappedHtml);

		// 半角/全角カンマでセレクタを分割し、空白をトリム
		const selectorList = selectors.split(/[,，]/).map(s => s.trim()).filter(Boolean);
		const combinedSelector = selectorList.join(',');

		// 保持するルート要素を特定（bodyの直接の子孫のみ）
		const allMatches = Array.from(document.querySelectorAll(combinedSelector));
		const rootKept: HTMLElement[] = [];

		for (const el of allMatches) {
			// 既に保持要素の子孫の場合はスキップ
			const isDescendant = rootKept.some(kept => kept.contains(el as Node));
			if (!isDescendant) {
				// <article>要素を<main>にリネームして、defuddleがネストした<article>で混乱しないようにする
				if (el.tagName === 'ARTICLE') {
					const mainEl = document.createElement('main');
					mainEl.innerHTML = el.innerHTML;
					for (const attr of el.attributes) {
						mainEl.setAttribute(attr.name, attr.value);
					}
					el.replaceWith(mainEl);
					rootKept.push(mainEl);
				} else {
					rootKept.push(el as HTMLElement);
				}
			}
		}

		if (rootKept.length === 0) return html;

		// body の子要素のうち、保持リストに含まれないものを削除（インプレース）
		const bodyChildren = Array.from(document.body.children);
		for (const child of bodyChildren) {
			const isKept = rootKept.some(kept => kept === child || kept.contains(child));
			if (!isKept) {
				child.remove();
			}
		}

		return document.body.innerHTML;
	} catch (error) {
		console.error('keepElementsBySelectors: failed', error);
		return html;
	}
}
