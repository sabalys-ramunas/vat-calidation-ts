import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function fixture(name: string): string {
  const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
  return readFileSync(`${currentDirectory}fixtures/${name}`, "utf8");
}

export function createTextResponse(body: string, status = 200): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/xml; charset=utf-8",
    },
    status,
  });
}

export function createResponse(
  body: string,
  status = 200,
  contentType = "text/plain; charset=utf-8"
): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
    },
    status,
  });
}
