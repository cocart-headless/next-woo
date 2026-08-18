"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getMyDownloads, type OrderDownload } from "@/lib/cocart-account";

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<OrderDownload[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyDownloads()
      .then(setDownloads)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load downloads")
      );
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Downloads</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!downloads && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {downloads && downloads.length === 0 && (
        <p className="text-muted-foreground">
          No downloads available yet on this account.
        </p>
      )}

      {downloads && downloads.length > 0 && (
        <div className="border rounded-lg divide-y">
          {downloads.map((download, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="font-medium">{download.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  {download.download_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {download.downloads_remaining} downloads remaining ·{" "}
                  {download.download_expires}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={download.file}>Download</a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
