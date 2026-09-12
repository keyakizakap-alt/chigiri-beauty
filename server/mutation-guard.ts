import { boundedRequest, sameOriginMutation } from '@/server/request-validation.mjs';
import { privateJson } from '@/server/request-owner';

export function protectMutation(handler: (request: Request) => Promise<Response>, maxBytes = 128 * 1024) {
  return async (request: Request) => {
    if (!sameOriginMutation(request)) return privateJson({error: '同じサイトから操作をやり直してください。'}, 403, null);
    try {
      return await handler(await boundedRequest(request, maxBytes));
    } catch (error) {
      return privateJson({error: error instanceof RangeError ? '送信内容が大きすぎます。' : '処理を完了できませんでした。時間をおいて再試行してください。'}, error instanceof RangeError ? 413 : 503, null);
    }
  };
}
