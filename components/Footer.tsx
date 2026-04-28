import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="container py-12 grid gap-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-base font-semibold tracking-tight">
            Portfolio Management Club
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
            A learning resource by and for members of the Portfolio Management
            Club at Nova School of Business &amp; Economics.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:col-span-2 md:grid-cols-3">
          <FooterColumn
            heading="Library"
            links={[
              { href: "/modules", label: "Modules" },
              { href: "/pitches", label: "Pitch archive" },
              { href: "/glossary", label: "Glossary" },
            ]}
          />
          <FooterColumn
            heading="Contribute"
            links={[
              { href: "/contribute", label: "How it works" },
              {
                href: "https://github.com",
                label: "Repository",
                external: true,
              },
            ]}
          />
          <FooterColumn
            heading="Institution"
            links={[
              {
                href: "https://www.novasbe.unl.pt/",
                label: "Nova SBE",
                external: true,
              },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Portfolio Management Club, Nova SBE.
            Educational use only — not investment advice.
          </p>
          <p className="eyebrow">v0.1 · Tier 1</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p className="eyebrow mb-3">{heading}</p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-foreground/85 hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-sm text-foreground/85 hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
