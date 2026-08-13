import { del, get, put } from "@vercel/blob";

export async function putPrivateImage(pathname: string, file: File) {
  return put(pathname, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type,
    cacheControlMaxAge: 60,
  });
}

export async function getPrivateImage(pathname: string) {
  return get(pathname, { access: "private", useCache: false });
}

export async function deletePrivateImages(pathnames: string | string[]) {
  const values = Array.isArray(pathnames) ? pathnames : [pathnames];
  if (values.length) await del(values);
}
