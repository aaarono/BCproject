import { useState } from "react";
import { http } from "../../api/http";
import { extractHttpErrorMessage } from "../../utils/httpError";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

export type ListingFormValues = {
  title: string;
  description: string;
  imageUrl: string;
  stockQuantity: string;
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
  imageUrl: "",
  stockQuantity: "",
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
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl);
  const [stockQuantity, setStockQuantity] = useState(initialValues.stockQuantity);
  const [price, setPrice] = useState(initialValues.price);
  const [type, setType] = useState<"GOOD" | "SERVICE">(initialValues.type);
  const [category, setCategory] = useState(initialValues.category);
  const [tags, setTags] = useState(initialValues.tags);
  const [salePercent, setSalePercent] = useState(initialValues.salePercent);
  const [saleStartsAt, setSaleStartsAt] = useState(initialValues.saleStartsAt);
  const [saleEndsAt, setSaleEndsAt] = useState(initialValues.saleEndsAt);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadListingImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are supported");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image is too large (max 5MB)");
      return;
    }

    setUploadError(null);
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await http.post<{ imageUrl: string }>(
        "/listings/upload-image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setImageUrl(response.data.imageUrl);
    } catch (error: unknown) {
      setUploadError(extractHttpErrorMessage(error, "Failed to upload image"));
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      title,
      description,
      imageUrl,
      stockQuantity,
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
          <div className="text-sm text-muted-foreground">Basic information</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audi RS6 account"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
            <Textarea
              className="min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the product or service..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Listing image</label>
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadListingImage(file);
                }}
                disabled={uploadingImage}
              />

              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />

              {uploadingImage && (
                <div className="text-xs text-muted-foreground">Uploading image...</div>
              )}

              {uploadError && (
                <div className="text-xs text-destructive">{uploadError}</div>
              )}

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Listing preview"
                  className="h-40 w-full rounded-lg border border-border object-cover"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Type</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={type}
                onChange={(e) => setType(e.target.value as "GOOD" | "SERVICE")}
              >
                <option value="GOOD">GOOD</option>
                <option value="SERVICE">SERVICE</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Category</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <label className="mb-1 block text-sm font-medium text-foreground">Tags (comma-separated)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. eu, alliance, rent"
            />
            <div className="mt-1 text-xs text-muted-foreground">Up to 8 tags.</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Price (USD)</label>
            <Input
              type="number"
              step="0.01"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 150.00"
            />
            <div className="mt-1 text-xs text-muted-foreground">Example: 150.00 = $150.00</div>
          </div>

          {type === "GOOD" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Quantity in stock</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="e.g. 50"
              />
              <div className="mt-1 text-xs text-muted-foreground">This field is required for goods listings.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground">Flash Sale</div>
          <Badge variant="muted">Optional</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Discount percent</label>
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
              <label className="mb-1 block text-sm font-medium text-foreground">Sale starts at</label>
              <Input
                type="datetime-local"
                value={saleStartsAt}
                onChange={(e) => setSaleStartsAt(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Sale ends at</label>
              <Input
                type="datetime-local"
                value={saleEndsAt}
                onChange={(e) => setSaleEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Fill all three fields to activate sale. Leave all empty to keep regular pricing.
          </div>
        </CardContent>
      </Card>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}