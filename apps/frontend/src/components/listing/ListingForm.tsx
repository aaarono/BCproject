import { useState } from "react";

export type ListingFormValues = {
  title: string;
  description: string;
  price: string;
  type: "GOOD" | "SERVICE";
};

type Props = {
  initialValues?: ListingFormValues;
  submitLabel: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: ListingFormValues) => Promise<void> | void;
};

const defaultValues: ListingFormValues = {
  title: "",
  description: "",
  price: "",
  type: "GOOD",
};

export function ListingForm({
  initialValues = defaultValues,
  submitLabel,
  loading = false,
  error = null,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [price, setPrice] = useState(initialValues.price);
  const [type, setType] = useState<"GOOD" | "SERVICE">(initialValues.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ title, description, price, type });
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded p-4 space-y-4">
      <div>
        <label className="block text-sm mb-1">Title</label>
        <input
          className="border rounded p-2 w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Audi RS6 account"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea
          className="border rounded p-2 w-full min-h-[120px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the product or service..."
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Type</label>
        <select
          className="border rounded p-2 w-full"
          value={type}
          onChange={(e) => setType(e.target.value as "GOOD" | "SERVICE")}
        >
          <option value="GOOD">GOOD</option>
          <option value="SERVICE">SERVICE</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Price (in cents)</label>
        <input
          className="border rounded p-2 w-full"
          type="number"
          min="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 15000"
        />
        <div className="text-xs text-gray-500 mt-1">
          Example: 15000 = 150.00 Kč
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}