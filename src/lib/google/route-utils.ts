import { NextResponse } from "next/server";

export function cacheHeaders(seconds = 30) {
  return {
    "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
  };
}

export function ok(data: unknown) {
  return NextResponse.json(data, { headers: cacheHeaders(30) });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
