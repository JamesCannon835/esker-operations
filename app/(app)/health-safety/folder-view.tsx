import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { fmtBytes, folderPaths, type HsFolder } from "@/lib/health-safety";
import { HsUpload } from "./hs-upload";
import { NewFolder } from "./new-folder";
import { HsItemActions } from "./item-actions";
import {
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
  renameDocument,
  moveDocument,
  deleteDocument,
  registerUpload,
} from "./actions";

export async function HsFolderView({ folderId }: { folderId: string | null }) {
  const supabase = await createClient();

  const [{ data: allFolders }, { data: docs }] = await Promise.all([
    supabase
      .from("hs_folders")
      .select("id, name, parent_id, sort_order")
      .order("sort_order")
      .order("name"),
    folderId
      ? supabase
          .from("hs_documents")
          .select("id, name, file_size, content_type, uploaded_at, folder_id")
          .eq("folder_id", folderId)
          .eq("voided", false)
          .order("name")
      : supabase
          .from("hs_documents")
          .select("id, name, file_size, content_type, uploaded_at, folder_id")
          .is("folder_id", null)
          .eq("voided", false)
          .order("name"),
  ]);

  const folders = (allFolders ?? []) as HsFolder[];
  const byId = new Map(folders.map((f) => [f.id, f]));

  if (folderId && !byId.has(folderId)) notFound();

  const children = folders
    .filter((f) => f.parent_id === folderId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  // breadcrumb
  const crumbs: HsFolder[] = [];
  let cur = folderId ? byId.get(folderId) : undefined;
  while (cur) {
    crumbs.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }

  // move targets (exclude self + own subtree for folders is handled server-side)
  const moveTargets = folderPaths(folders);

  const documents = docs ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Health &amp; Safety</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <NewFolder action={createFolder.bind(null, folderId)} />
          <HsUpload
            folderId={folderId}
            register={registerUpload.bind(null, folderId)}
          />
        </div>
      </div>

      <nav className="hs-crumbs">
        <Link href="/health-safety">All documents</Link>
        {crumbs.map((c) => (
          <span key={c.id}>
            {" › "}
            <Link href={`/health-safety/f/${c.id}`}>{c.name}</Link>
          </span>
        ))}
      </nav>

      <div className="card">
        {children.length === 0 && documents.length === 0 ? (
          <p className="empty">This folder is empty. Add a subfolder or upload files.</p>
        ) : (
          <table className="list-table">
            <tbody>
              {children.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/health-safety/f/${f.id}`}>
                      <span className="hs-icon">📁</span> {f.name}
                    </Link>
                  </td>
                  <td className="muted" style={{ width: 90 }}>
                    folder
                  </td>
                  <td style={{ textAlign: "right", width: 44 }}>
                    <HsItemActions
                      kind="folder"
                      name={f.name}
                      moveTargets={moveTargets.filter((t) => t.id !== f.id)}
                      currentTarget={folderId}
                      rename={renameFolder.bind(null, f.id)}
                      move={moveFolder.bind(null, f.id)}
                      remove={deleteFolder.bind(null, f.id)}
                    />
                  </td>
                </tr>
              ))}
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a
                      href={`/health-safety/document/${d.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <span className="hs-icon">📄</span> {d.name}
                    </a>
                  </td>
                  <td className="muted" style={{ width: 90 }}>
                    {fmtBytes(d.file_size)}
                    <span className="hs-date"> · {fmtDate(d.uploaded_at)}</span>
                  </td>
                  <td style={{ textAlign: "right", width: 44 }}>
                    <HsItemActions
                      kind="doc"
                      name={d.name}
                      moveTargets={moveTargets}
                      currentTarget={folderId}
                      rename={renameDocument.bind(null, d.id)}
                      move={moveDocument.bind(null, d.id)}
                      remove={deleteDocument.bind(null, d.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
