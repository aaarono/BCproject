import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { ListingForm, type ListingFormValues } from "../components/listing/ListingForm";
import type { Listing, ListingDiscountPolicy } from "../types/listing";
import { extractHttpErrorMessage } from "../utils/httpError";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { centsToDollarsInput, dollarsToCents } from "../lib/currency";

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function isSaleStillRelevant(salePercent?: number | null, saleEndsAt?: string | null) {
  if (!salePercent || !saleEndsAt) return false;
  const endsAt = new Date(saleEndsAt).getTime();
  return Number.isFinite(endsAt) && endsAt > Date.now();
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flashSalePolicy, setFlashSalePolicy] = useState<ListingDiscountPolicy | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    http
      .get<Listing>(`/listings/${id}`)
      .then((r) => setListing(r.data))
      .catch((e) => setErr(e?.response?.data?.message ?? "Failed to load listing"))
      .finally(() => setLoading(false));

    http
      .get<ListingDiscountPolicy>(`/listings/${id}/discount-policy`)
      .then((r) => setFlashSalePolicy(r.data))
      .catch(() => setFlashSalePolicy(null));
  }, [id]);

  async function submit(values: ListingFormValues) {
    if (!id) return;
    setErr(null);

    const parsedPrice = Number(values.price);
    const parsedPriceCents = dollarsToCents(parsedPrice);
    const parsedStockQuantity = values.stockQuantity.trim() ? Number(values.stockQuantity) : NaN;

    if (!values.title.trim()) {
      setErr("Title is required");
      return;
    }

    if (!values.description.trim()) {
      setErr("Description is required");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPriceCents <= 0) {
      setErr("Price must be greater than 0");
      return;
    }

    if (values.type === "GOOD") {
      if (!Number.isInteger(parsedStockQuantity) || parsedStockQuantity < 0) {
        setErr("Quantity in stock must be a non-negative integer for goods");
        return;
      }
    }

    const tags = values.tags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 4);

    const salePercent = values.salePercent.trim()
      ? Number(values.salePercent)
      : undefined;
    const saleStartsAt = values.saleStartsAt.trim()
      ? new Date(values.saleStartsAt).toISOString()
      : undefined;
    const saleEndsAt = values.saleEndsAt.trim()
      ? new Date(values.saleEndsAt).toISOString()
      : undefined;

    const hasAnySaleField =
      salePercent !== undefined ||
      saleStartsAt !== undefined ||
      saleEndsAt !== undefined;

    if (hasAnySaleField) {
      if (
        !Number.isFinite(salePercent) ||
        salePercent === undefined ||
        salePercent < (flashSalePolicy?.discountPercentMin ?? 5) ||
        salePercent > (flashSalePolicy?.discountPercentMax ?? 70)
      ) {
        setErr(
          `Sale discount must be between ${flashSalePolicy?.discountPercentMin ?? 5} and ${flashSalePolicy?.discountPercentMax ?? 70}`,
        );
        return;
      }

      if (!saleStartsAt || !saleEndsAt) {
        setErr("Sale start and end datetime are required");
        return;
      }

      if (new Date(saleStartsAt) >= new Date(saleEndsAt)) {
        setErr("Sale start must be before sale end");
        return;
      }

      if (flashSalePolicy && (parsedPriceCents < flashSalePolicy.allowedMinBasePrice || parsedPriceCents > flashSalePolicy.allowedMaxBasePrice)) {
        setErr(
          `This listing does not meet flash-sale requirements. Allowed base price range: ${centsToDollarsInput(flashSalePolicy.allowedMinBasePrice)} - ${centsToDollarsInput(flashSalePolicy.allowedMaxBasePrice)} USD`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      await http.patch(`/listings/${id}`, {
        title: values.title.trim(),
        description: values.description.trim(),
        imageUrl: values.imageUrl.trim() || undefined,
        price: parsedPriceCents,
        stockQuantity: values.type === "GOOD" ? parsedStockQuantity : undefined,
        type: values.type,
        category: values.category,
        tags,
        salePercent,
        saleStartsAt,
        saleEndsAt,
      });

      nav(`/listings/${id}`);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to update listing"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState width="max-w-3xl" />;
  if (err && !listing) return <ErrorState width="max-w-3xl" message={err} />;
  if (!listing) return <ErrorState width="max-w-3xl" message="Listing not found" />;

  const flashSaleActiveByDefault = isSaleStillRelevant(
    listing.salePercent,
    listing.saleEndsAt,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit listing</h1>

      <ListingForm
        initialValues={{
          title: listing.title,
          description: listing.description,
          imageUrl: listing.imageUrl ?? "",
          stockQuantity: listing.stockQuantity !== undefined && listing.stockQuantity !== null ? String(listing.stockQuantity) : "",
          price: centsToDollarsInput(listing.price),
          type: listing.type,
          category: listing.category,
          tags: listing.tags,
          salePercent:
            flashSaleActiveByDefault && listing.salePercent !== undefined && listing.salePercent !== null
              ? String(listing.salePercent)
              : "",
          saleStartsAt: flashSaleActiveByDefault ? toDateTimeLocal(listing.saleStartsAt) : "",
          saleEndsAt: flashSaleActiveByDefault ? toDateTimeLocal(listing.saleEndsAt) : "",
        }}
        submitLabel="Save changes"
        loading={saving}
        error={err}
        flashSalePolicy={flashSalePolicy}
        onSubmit={submit}
      />
    </div>
  );
}