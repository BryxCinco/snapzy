import JSZip from "jszip";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "screenshots";
// Keeps one request from buffering an unbounded amount of memory.
const MAX_FILES = 300;
const DOWNLOAD_CONCURRENCY = 6;

// Windows and macOS both reject these in file names.
function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "photo";
}

function uniqueName(name: string, used: Set<string>) {
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
  }
}

/**
 * GET /dashboard/download?album=<all|unsorted|categoryId>
 * Streams back a ZIP of every photo in that album. The proxy already
 * requires a session for /dashboard; RLS scopes the rows and files.
 */
export async function GET(request: NextRequest) {
  const album = request.nextUrl.searchParams.get("album") ?? "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Not logged in", { status: 401 });
  }

  let albumName = "All photos";
  let query = supabase
    .from("screenshots")
    .select("storage_path, original_filename")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(MAX_FILES);

  if (album === "unsorted") {
    albumName = "Unsorted";
    query = query.is("category_id", null);
  } else if (album !== "all") {
    const { data: category } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", album)
      .maybeSingle();
    if (!category) {
      return new Response("Album not found", { status: 404 });
    }
    albumName = category.name;
    query = query.eq("category_id", category.id);
  }

  const { data: rows, error } = await query;
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return new Response("This album is empty", { status: 404 });
  }

  const zip = new JSZip();
  const used = new Set<string>();
  const queue = [...rows];
  let failed = 0;

  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const { data: blob } = await supabase.storage
        .from(BUCKET)
        .download(row.storage_path);
      if (!blob) {
        failed++;
        continue;
      }
      const name = uniqueName(
        safeName(row.original_filename ?? row.storage_path.split("/").pop() ?? "photo"),
        used,
      );
      zip.file(name, await blob.arrayBuffer());
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, rows.length) }, worker),
  );

  if (failed === rows.length) {
    return new Response("Could not read any files", { status: 500 });
  }

  // Images are already compressed; STORE skips pointless re-compression.
  const body = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  const zipName = `snapzy-${safeName(albumName).replace(/\s+/g, "-").toLowerCase()}.zip`;

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      // Plain `filename` must be ASCII; `filename*` carries the real name.
      "Content-Disposition": `attachment; filename="${zipName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "no-store",
    },
  });
}
