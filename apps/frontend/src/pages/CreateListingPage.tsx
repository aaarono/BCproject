import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http";
import { ListingForm, type ListingFormValues } from "../components/listing/ListingForm";
import { extractHttpErrorMessage } from "../utils/httpError";
import { dollarsToCents } from "../lib/currency";

type CreateListingResponse = {
  id: string;
};

export function CreateListingPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(values: ListingFormValues) {
    setErr(null);

    const parsedPrice = Number(values.price);
    const parsedPriceCents = dollarsToCents(parsedPrice);

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

    const tags = values.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

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
        salePercent < 1 ||
        salePercent > 90
      ) {
        setErr("Sale discount must be between 1 and 90");
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
    }

    setLoading(true);
    try {
      const res = await http.post<CreateListingResponse>("/listings", {
        title: values.title.trim(),
        description: values.description.trim(),
        imageUrl: values.imageUrl.trim() || undefined,
        price: parsedPriceCents,
        type: values.type,
        category: values.category,
        tags,
        salePercent,
        saleStartsAt,
        saleEndsAt,
      });

      nav(`/listings/${res.data.id}`);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to create listing"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Create listing</h1>
      <ListingForm
        submitLabel="Create listing"
        loading={loading}
        error={err}
        onSubmit={submit}
      />
    </div>
  );
}