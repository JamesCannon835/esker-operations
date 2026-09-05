import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import {
  fmtBytes,
  folderPaths,
  DOC_SECTION_META,
  type LibFolder,
  type DocSection,
} from "@/lib/doc-library";
import { Upload } from "./upload";
import { NewFolder } from "./new-folder";
import { ItemActions } from "./item-actions";
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

export async function FolderView({
  section,
  folderId,
}: {
  section: DocSection;
  folderId: string | null;
}) {
  const supabase = await createClient();
  const meta = DOC_SECTION_META[section];
  const root = `/library/${meta.slug}`;

  const [{ data: allFolders }, { data: docs }] = await Promise.all([
    supabase
      .from("hs_folders")
      .select("id, name, parent_id, sort_order")
      .eq("section", section)
      .order("sort_order")
      .order("name"),
    (folderId
      ? supabase
          .from("hs_documents")
          .select("id, name, file_size, content_type, uploaded_at, folder_id")
          .eq("folder_id", folderId)
      : supabase
          .from("hs_documents")
          .select("id, name, file_size, content_type, uploaded_at, folder_id")
          .eq("section", section)
          .is("folder_id", null)
    )
      .eq("voided", false)
      .order("name"),
  ]);

  const folders = (allFolders ?? []) as LibFolder[];
  const byId = new Map(folders.map((f) => [f.id, f]));

  if (folderId && !byId.has(folderId)) notFound();

  const children = folders
    .filter((f) => f.parent_id === folderId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const crumbs: LibFolder[] = [];
  let cur = folderId ? byId.get(folderId) : undefined;
  while (cur) {
    crumbs.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }

  const moveTargets = folderPaths(folders);
  const documents = docs ?? [];

  return (
    <>
      <div className="page-head">
        <h1>{meta.title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <NewFolder action={createFolder.bind(null, section, folderId)} />
          <Upload
            prefix={meta.prefix}
            folderId={folderId}
            register={registerUpload.bind(null, section, folderId)}
          />
        </div>
      </div>

      <nav className="hs-crumbs">
        <Link href={root}>{meta.title}</Link>
        {crumbs.map((c) => (
          <span key={c.id}>
            {" › "}
            <Link href={`${root}/f/${c.id}`}>{c.name}</Link>
          </span>
        ))}
      </nav>

      <div className="card">
        {children.length === 0 && documents.length === 0 ? (
          <p className="empty">
            This folder is empty. Add a subfolder or upload files.
          </p>
        ) : (
          <table className="list-table">
            <tbody>
              {children.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`${root}/f/${f.id}`}>
                      <span className="hs-icon">📁</span> {f.name}
                    </Link>
                  </td>
                  <td className="muted" style={{ width: 90 }}>
                    folder
                  </td>
                  <td style={{ textAlign: "right", width: 44 }}>
                    <ItemActions
                      kind="folder"
                      name={f.name}
                      moveTargets={moveTargets.filter((t) => t.id !== f.id)}
                      currentTarget={folderId}
                      rename={renameFolder.bind(null, f.id)}
                      move={moveFolder.bind(null, f.id)}
                      remove={deleteFolder.bind(null, section, f.id)}
                    />
                  </td>
                </tr>
              ))}
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a
                      href={`${root}/document/${d.id}`}
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
                    <ItemActions
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
