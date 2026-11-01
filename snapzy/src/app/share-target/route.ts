import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { saveUpload } from "@/lib/save-upload";
import { createClient } from "@/lib/supabase/server";

// Target of the manifest's share_target: the phone's "Share" sheet POSTs the
// chosen images here as multipart form data (field name "files"). They go
// through the same checks as a normal upload, then the user lands on the
// dashboard with a summary in ?shared= / ?skipped=.
const MAX_SHARED_FILES = 10;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const to = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = new URLSearchParams(params).toString();
    // 303 turns the POST into a GET of the destination.
    return NextResponse.redirect(url, 303);
  };

  // The shared files can't survive a login detour, so they are dropped.
  if (!user) return to("/login");

  let files: File[] = [];
  try {
    const formData = await request.formData();
    files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  } catch {
    return to("/dashboard", { shared: "0", skipped: "1" });
  }

  let shared = 0;
  let skipped = Math.max(0, files.length - MAX_SHARED_FILES);
  for (const file of files.slice(0, MAX_SHARED_FILES)) {
    const result = await saveUpload(supabase, user, file);
    if (result.ok) shared++;
    else skipped++;
  }

  if (shared > 0) revalidatePath("/dashboard");
  return to("/dashboard", { shared: String(shared), skipped: String(skipped) });
}
