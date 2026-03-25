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
      if (!Number.isInteger(parsedStockQuantity) || parsedStockQuantity < 1) {
        setErr("Quantity in stock must be an integer greater than 0 for goods");
        return;
      }
    }

    const tags = values.tags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 4);

    setLoading(true);
    try {
      const res = await http.post<CreateListingResponse>("/listings", {
        title: values.title.trim(),
        description: values.description.trim(),
        imageUrl: values.imageUrl.trim() || undefined,
        price: parsedPriceCents,
        stockQuantity: values.type === "GOOD" ? parsedStockQuantity : undefined,
        type: values.type,
        category: values.category,
        tags,
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
        showFlashSale={false}
        onSubmit={submit}
      />
    </div>
  );
}