import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { http } from "../../api/http";
import { extractHttpErrorMessage } from "../../utils/httpError";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatUsdFromCents } from "../../lib/currency";
import type { ListingDiscountPolicy } from "../../types/listing";

export type ListingFormValues = {
  title: string;
  description: string;
  imageUrl: string;
  stockQuantity: string;
  price: string;
  type: "GOOD" | "SERVICE";
  category: "GAMES" | "ACCOUNTS" | "BOOSTING" | "MENTORING" | "GAME_CURRENCY" | "OTHER";
  tags: string[];
  salePercent: string;
  saleStartsAt: string;
  saleEndsAt: string;
};

type Props = {
  initialValues?: ListingFormValues;
  submitLabel: string;
  loading?: boolean;
  error?: string | null;
  showFlashSale?: boolean;
  flashSalePolicy?: ListingDiscountPolicy | null;
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
  tags: [],
  salePercent: "",
  saleStartsAt: "",
  saleEndsAt: "",
};

export function ListingForm({
  initialValues = defaultValues,
  submitLabel,
  loading = false,
  error = null,
  showFlashSale = true,
  flashSalePolicy = null,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl);
  const [stockQuantity, setStockQuantity] = useState(initialValues.stockQuantity);
  const [price, setPrice] = useState(initialValues.price);
  const [type, setType] = useState<"GOOD" | "SERVICE">(initialValues.type);
  const [category, setCategory] = useState(initialValues.category);
  const [tags, setTags] = useState<string[]>(initialValues.tags);
  const [tagInput, setTagInput] = useState("");
  const [salePercent, setSalePercent] = useState(initialValues.salePercent);
  const [saleStartsAt, setSaleStartsAt] = useState(initialValues.saleStartsAt);
  const [saleEndsAt, setSaleEndsAt] = useState(initialValues.saleEndsAt);
  const [flashSaleEnabled, setFlashSaleEnabled] = useState(
    Boolean(initialValues.salePercent || initialValues.saleStartsAt || initialValues.saleEndsAt),
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [description]);

  function addTag(rawValue: string) {
    const value = rawValue.trim().toLowerCase();
    if (!value) return;

    setTags((prev) => {
      if (prev.includes(value) || prev.length >= 4) return prev;
      return [...prev, value];
    });
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((item) => item !== tag));
  }

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
      salePercent: flashSaleEnabled ? salePercent : "",
      saleStartsAt: flashSaleEnabled ? saleStartsAt : "",
      saleEndsAt: flashSaleEnabled ? saleEndsAt : "",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
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
              ref={descriptionRef}
              className="min-h-[120px] resize-none overflow-hidden"
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
            <label className="mb-1 block text-sm font-medium text-foreground">Tags</label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Type tag and press Enter"
            />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="inline-flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {type === "GOOD" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>

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
              </div>
            </div>
          ) : (
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
            </div>
          )}
        </CardContent>
      </Card>

      {showFlashSale && (
        <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            Flash Sale
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              title={
                flashSalePolicy
                  ? `Flash sale rules:\n• Base price must be within ${formatUsdFromCents(
                      flashSalePolicy.allowedMinBasePrice,
                    )} - ${formatUsdFromCents(flashSalePolicy.allowedMaxBasePrice)}\n• Discount range: ${flashSalePolicy.discountPercentMin}% - ${flashSalePolicy.discountPercentMax}%\n• Tolerance: ±${flashSalePolicy.tolerancePercent}% from 30d min base price`
                  : "Flash sale rules are loading..."
              }
              aria-label="Flash sale rules"
            >
              <Info className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFlashSaleEnabled((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
              flashSaleEnabled ? "border-primary bg-primary" : "border-border bg-muted-foreground"
            }`}
            aria-pressed={flashSaleEnabled}
            aria-label="Toggle flash sale"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                flashSaleEnabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </CardHeader>
        {flashSaleEnabled ? (
          <CardContent className="space-y-3">
            {flashSalePolicy && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Allowed base price range: <span className="font-semibold text-foreground">{formatUsdFromCents(flashSalePolicy.allowedMinBasePrice)} - {formatUsdFromCents(flashSalePolicy.allowedMaxBasePrice)}</span>
                <br />
                Discount range: <span className="font-semibold text-foreground">{flashSalePolicy.discountPercentMin}% - {flashSalePolicy.discountPercentMax}%</span>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Discount percent</label>
              <Input
                type="number"
                min={String(flashSalePolicy?.discountPercentMin ?? 5)}
                max={String(flashSalePolicy?.discountPercentMax ?? 70)}
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
              Fill all three fields to activate sale.
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="text-xs text-muted-foreground">Enable to configure discount and schedule.</div>
          </CardContent>
        )}
      </Card>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}