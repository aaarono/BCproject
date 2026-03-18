import { useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <div className="text-sm text-slate-600">Basic information</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audi RS6 account"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <Textarea
              className="min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the product or service..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={type}
                onChange={(e) => setType(e.target.value as "GOOD" | "SERVICE")}
              >
                <option value="GOOD">GOOD</option>
                <option value="SERVICE">SERVICE</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tags (comma-separated)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. eu, alliance, rent"
            />
            <div className="mt-1 text-xs text-slate-500">Up to 8 tags.</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Price (in cents)</label>
            <Input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 15000"
            />
            <div className="mt-1 text-xs text-slate-500">Example: 15000 = 150.00 Kč</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-700">Flash Sale</div>
          <Badge variant="muted">Optional</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Discount percent</label>
            <Input
              type="number"
              min="1"
              max="90"
              value={salePercent}
              onChange={(e) => setSalePercent(e.target.value)}
              placeholder="e.g. 20"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sale starts at</label>
              <Input
                type="datetime-local"
                value={saleStartsAt}
                onChange={(e) => setSaleStartsAt(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sale ends at</label>
              <Input
                type="datetime-local"
                value={saleEndsAt}
                onChange={(e) => setSaleEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Fill all three fields to activate sale. Leave all empty to keep regular pricing.
          </div>
        </CardContent>
      </Card>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}