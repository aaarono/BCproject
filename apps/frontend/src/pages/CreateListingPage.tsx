import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http";
import { ListingForm, type ListingFormValues } from "../components/listing/ListingForm";

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

    setLoading(true);
    try {
      const res = await http.post<CreateListingResponse>("/listings", {
        title: values.title.trim(),
        description: values.description.trim(),
        price: parsedPrice,
        type: values.type,
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
      <ListingForm
        submitLabel="Create listing"
        loading={loading}
        error={err}
        onSubmit={submit}
      />
    </div>
  );
}