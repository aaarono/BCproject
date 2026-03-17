import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { ListingForm, type ListingFormValues } from "../components/listing/ListingForm";
import type { Listing } from "../types/listing";

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    http
      .get<Listing>(`/listings/${id}`)
      .then((r) => setListing(r.data))
      .catch((e) => setErr(e?.response?.data?.message ?? "Failed to load listing"))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(values: ListingFormValues) {
    if (!id) return;
    setErr(null);

    const parsedPrice = Number(values.price);

    if (!values.title.trim()) {
      setErr("Title is required");
      return;
    }

    if (!values.description.trim()) {
      setErr("Description is required");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
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

    setSaving(true);
    try {
      await http.patch(`/listings/${id}`, {
        title: values.title.trim(),
        description: values.description.trim(),
        price: parsedPrice,
        type: values.type,
        category: values.category,
        tags,
        salePercent,
        saleStartsAt,
        saleEndsAt,
      });

      nav(`/listings/${id}`);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to update listing");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err && !listing) return <div className="p-6 text-red-600">{err}</div>;
  if (!listing) return <div className="p-6 text-red-600">Listing not found</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit listing</h1>

      <ListingForm
        initialValues={{
          title: listing.title,
          description: listing.description,
          price: String(listing.price),
          type: listing.type,
          category: listing.category,
          tags: listing.tags.join(", "),
          salePercent:
            listing.salePercent !== undefined && listing.salePercent !== null
              ? String(listing.salePercent)
              : "",
          saleStartsAt: toDateTimeLocal(listing.saleStartsAt),
          saleEndsAt: toDateTimeLocal(listing.saleEndsAt),
        }}
        submitLabel="Save changes"
        loading={saving}
        error={err}
        onSubmit={submit}
      />
    </div>
  );
}