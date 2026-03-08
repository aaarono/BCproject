import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { ListingForm, type ListingFormValues } from "../components/listing/ListingForm";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  status: "ACTIVE" | "ARCHIVED";
  seller: {
    id: string;
    displayName: string;
    ratingAvg: number;
    ratingCount: number;
  };
};

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

    setSaving(true);
    try {
      await http.patch(`/listings/${id}`, {
        title: values.title.trim(),
        description: values.description.trim(),
        price: parsedPrice,
        type: values.type,
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
        }}
        submitLabel="Save changes"
        loading={saving}
        error={err}
        onSubmit={submit}
      />
    </div>
  );
}