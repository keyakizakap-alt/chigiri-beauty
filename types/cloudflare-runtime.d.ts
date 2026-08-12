type D1Database = Parameters<typeof import("drizzle-orm/d1").drizzle>[0];

interface Fetcher {
  fetch(input: Request): Promise<Response>;
}

interface ChigiriR2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  writeHttpMetadata(headers: Headers): void;
}

interface ChigiriR2Bucket {
  get(key: string): Promise<ChigiriR2Object | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    BUCKET?: ChigiriR2Bucket;
  };
}
