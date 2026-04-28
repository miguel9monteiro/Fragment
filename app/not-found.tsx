import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container py-32 max-w-2xl">
      <p className="eyebrow-gold mb-4">404</p>
      <h1 className="font-serif text-5xl font-semibold tracking-tight leading-tight">
        Page not found.
      </h1>
      <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
        This page does not exist, or it was moved. Browse the library instead.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/modules">
            Modules <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pitches">Pitch archive</Link>
        </Button>
      </div>
    </section>
  );
}
