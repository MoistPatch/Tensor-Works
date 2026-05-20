import { ImportForm } from "./ImportForm";

export const metadata = { title: "Import Contacts — TensorWorks Admin" };

export default function ImportPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Import Contacts</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">
          Upload a CSV file to bulk-import subscribers. Each contact will be created in the database
          and synced to Mailchimp.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--tw-border)] p-6">
        <div className="mb-5 p-4 rounded-lg bg-[var(--tw-bg)] border border-[var(--tw-border)] text-sm">
          <p className="font-medium text-[var(--tw-dark)] mb-2">Required CSV columns</p>
          <code className="text-xs text-[var(--tw-mid)] font-mono">
            email, first_name, last_name, organisation, role_title, role_source_url,
            role_relevance_note
          </code>
        </div>

        <ImportForm />
      </div>
    </div>
  );
}
