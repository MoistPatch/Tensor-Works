export const metadata = { title: "Add Topic — TensorWorks Admin" };

export default function NewCalendarTopicPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Add Topic</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">
          Add a new topic to the editorial calendar.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--tw-border)] p-6">
        <p className="text-sm text-[var(--tw-muted)]">
          This form is under construction. Topics are currently managed via the worker service.
        </p>
      </div>
    </div>
  );
}
