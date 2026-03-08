import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http";

type CreateListingResponse = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  status: "ACTIVE" | "ARCHIVED";
};

export function CreateListingPage() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"GOOD" | "SERVICE">("GOOD");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const parsedPrice = Number(price);

    if (!title.trim()) {
      setErr("Title is required");
      return;
    }

    if (!description.trim()) {
      setErr("Description is required");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setErr("Price must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      const res = await http.post<CreateListingResponse>("/listings", {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        type,
      });

      nav(`/listings/${res.data.id}`);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to create listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create listing</h1>

      <form onSubmit={submit} className="border rounded p-4 space-y-4">
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

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create listing"}
        </button>
      </form>
    </div>
  );
}