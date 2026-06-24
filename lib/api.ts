import { NextResponse } from "next/server";

// Standard API envelope so every endpoint responds with the same shape:
//   { success, message, data, ...extra }   (extra is used for `pagination`)
export function ok<T>(
  data: T,
  message = "Success",
  extra: Record<string, unknown> = {},
  status = 200
) {
  return NextResponse.json({ success: true, message, data, ...extra }, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}
