export interface BalSiteSection {
  h2: string;
  paras?: string[];
  steps?: [string, string][];
  list?: string[];
  doclinks?: [string, string, string | null][];
  code?: string;
  cta?: boolean;
  jsonLd?: null;
}

export interface BalSitePage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  ogTitle: string;
  ogDescription: string;
  sections: BalSiteSection[];
  jsonLd: Record<string, string> | null;
}

export declare const BAL_SITE_ORIGIN: string;
export declare const BAL_SITE_BASE: string;
export declare const BAL_NAV_LINKS: { href: string; label: string }[];
export declare const BAL_PAGES: BalSitePage[];
export declare const BAL_404: { title: string; description: string };
