import { useState } from "react";

export type ListingFormValues = {
  title: string;
  description: string;
  price: string;
  type: "GOOD" | "SERVICE";
  category: "GAMES" | "ACCOUNTS" | "BOOSTING" | "MENTORING" | "GAME_CURRENCY" | "OTHER";
  tags: string;
  salePercent: string;
  saleStartsAt: string;
  saleEndsAt: string;
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
  category: "GAMES",
  tags: "",
  salePercent: "",
  saleStartsAt: "",
  saleEndsAt: "",
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
  const [category, setCategory] = useState(initialValues.category);
  const [tags, setTags] = useState(initialValues.tags);
  const [salePercent, setSalePercent] = useState(initialValues.salePercent);
  const [saleStartsAt, setSaleStartsAt] = useState(initialValues.saleStartsAt);
  const [saleEndsAt, setSaleEndsAt] = useState(initialValues.saleEndsAt);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      title,
      description,
      price,
      type,
      category,
      tags,
      salePercent,
      saleStartsAt,
      saleEndsAt,
    });
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
        <label className="block text-sm mb-1">Category</label>
        <select
          className="border rounded p-2 w-full"
          value={category}
          onChange={(e) =>
            setCategory(
              e.target.value as
                | "GAMES"
                | "ACCOUNTS"
                | "BOOSTING"
                | "MENTORING"
                | "GAME_CURRENCY"
                | "OTHER",
            )
          }
        >
          <option value="GAMES">Games</option>
          <option value="ACCOUNTS">Accounts</option>
          <option value="BOOSTING">Boosting</option>
          <option value="MENTORING">Mentoring</option>
          <option value="GAME_CURRENCY">Game currency</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Tags (comma-separated)</label>
        <input
          className="border rounded p-2 w-full"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. eu, alliance, rent"
        />
        <div className="text-xs text-gray-500 mt-1">Up to 8 tags.</div>
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

      <div className="border rounded p-3 space-y-3">
        <div className="text-sm font-medium">Flash Sale (optional)</div>

        <div>
          <label className="block text-sm mb-1">Discount percent</label>
          <input
            className="border rounded p-2 w-full"
            type="number"
            min="1"
            max="90"
            value={salePercent}
            onChange={(e) => setSalePercent(e.target.value)}
            placeholder="e.g. 20"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Sale starts at</label>
            <input
              className="border rounded p-2 w-full"
              type="datetime-local"
              value={saleStartsAt}
              onChange={(e) => setSaleStartsAt(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Sale ends at</label>
            <input
              className="border rounded p-2 w-full"
              type="datetime-local"
              value={saleEndsAt}
              onChange={(e) => setSaleEndsAt(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Fill all three fields to activate sale. Leave all empty to keep regular
          pricing.
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